import { Buffer } from "node:buffer";
import {
  Environment,
  SignedDataVerifier,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from "@apple/app-store-server-library";

const APPLE_ROOT_CERT_URLS = [
  "https://www.apple.com/certificateauthority/AppleRootCA-G3.cer",
  "https://www.apple.com/certificateauthority/AppleRootCA-G2.cer",
];

let rootCertificatesPromise: Promise<Buffer[]> | null = null;

function decodeJwsPayload<T>(jws: string): T {
  const payload = jws.split(".")[1];
  if (!payload) throw new Error("Malformed Apple signed payload");
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as T;
}

async function rootCertificates(): Promise<Buffer[]> {
  if (!rootCertificatesPromise) {
    rootCertificatesPromise = (async () => {
      const configured = process.env.APPLE_ROOT_CA_G3_BASE64;
      if (configured) return [Buffer.from(configured, "base64")];
      const certificates = await Promise.all(
        APPLE_ROOT_CERT_URLS.map(async (url) => {
          const response = await fetch(url, { headers: { accept: "application/x-x509-ca-cert" } });
          if (!response.ok) throw new Error(`Apple root certificate unavailable: ${response.status}`);
          return Buffer.from(await response.arrayBuffer());
        }),
      );
      return certificates;
    })();
  }
  return rootCertificatesPromise;
}

function environmentFor(value: unknown): Environment {
  return value === Environment.SANDBOX ? Environment.SANDBOX : Environment.PRODUCTION;
}

async function verifierFor(environment: Environment): Promise<SignedDataVerifier> {
  const bundleID = process.env.HEATERDEALS_BUNDLE_ID ?? "com.heaterdeals.app";
  const appAppleID = process.env.HEATERDEALS_APPLE_ID
    ? Number(process.env.HEATERDEALS_APPLE_ID)
    : undefined;
  if (environment === Environment.PRODUCTION && !appAppleID) {
    throw new Error("Missing server configuration: HEATERDEALS_APPLE_ID");
  }
  return new SignedDataVerifier(
    await rootCertificates(),
    true,
    environment,
    bundleID,
    environment === Environment.PRODUCTION ? appAppleID : undefined,
  );
}

export async function verifyTransaction(jws: string): Promise<JWSTransactionDecodedPayload> {
  const unverified = decodeJwsPayload<{ environment?: string }>(jws);
  const environment = environmentFor(unverified.environment);
  return (await verifierFor(environment)).verifyAndDecodeTransaction(jws);
}

export async function verifyNotification(jws: string): Promise<ResponseBodyV2DecodedPayload> {
  const unverified = decodeJwsPayload<{ data?: { environment?: string } }>(jws);
  const environment = environmentFor(unverified.data?.environment);
  return (await verifierFor(environment)).verifyAndDecodeNotification(jws);
}

export function entitlementStatus(
  transaction: JWSTransactionDecodedPayload,
  notificationType?: string,
): "active" | "expired" | "revoked" | "billing_retry" | "grace_period" {
  if (transaction.revocationDate) return "revoked";
  if (notificationType === "GRACE_PERIOD_EXPIRED") return "expired";
  if (notificationType === "DID_FAIL_TO_RENEW" || notificationType === "BILLING_RETRY") return "billing_retry";
  const expiresAt = transaction.expiresDate ?? 0;
  return expiresAt > Date.now() ? "active" : "expired";
}

export function asEnvironment(value: unknown): "Sandbox" | "Production" {
  return value === Environment.SANDBOX ? "Sandbox" : "Production";
}
