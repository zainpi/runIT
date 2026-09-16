import "server-only";
import Stripe from "stripe";
import { site } from "../site";
import { StoreError } from "./payment";

async function environment(): Promise<Record<string, unknown>> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    return { ...process.env, ...getCloudflareContext().env };
  } catch { return process.env; }
}

export async function storeConfiguration() {
  const env = await environment();
  const key = typeof env.TEMPLATES_STRIPE_KEY === "string" ? env.TEMPLATES_STRIPE_KEY : "";
  const webhookSecret = typeof env.TEMPLATES_STRIPE_WEBHOOK_SECRET === "string" ? env.TEMPLATES_STRIPE_WEBHOOK_SECRET : "";
  const configuredOrigin = typeof env.TEMPLATES_SITE_URL === "string" ? env.TEMPLATES_SITE_URL : site.url;
  let origin = site.url as string;
  let validOrigin = false;
  try {
    const url = new URL(configuredOrigin);
    validOrigin = !url.username && !url.password && (url.protocol === "https:" || (process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)));
    if (validOrigin) origin = url.origin;
  } catch { /* A malformed deployment setting keeps checkout unavailable. */ }
  const ready = validOrigin && /^(sk|rk)_(test|live)_/.test(key) && webhookSecret.startsWith("whsec_");
  const testMode = /^(sk|rk)_test_/.test(key);
  return { key, webhookSecret, origin, ready, testMode };
}

export async function stripeForStore() {
  const config = await storeConfiguration();
  if (!config.ready) throw new StoreError("Checkout is not available yet. Please try again later or email us.", 503);
  const stripe = new Stripe(config.key, { httpClient: Stripe.createFetchHttpClient(), maxNetworkRetries: 2, timeout: 15000 });
  return { stripe, ...config };
}

export function storeRequestOrigin(request: Request, configuredOrigin: string) {
  const url = new URL(request.url);
  const local = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && ["http:", "https:"].includes(url.protocol);
  const allowed = [configuredOrigin, "https://runsit.ca", "https://www.runsit.ca", "https://runs-it.com", "https://www.runs-it.com"];
  if (url.username || url.password || (!local && !allowed.includes(url.origin))) throw new StoreError("Please open the store and try again.", 403);
  return url.origin;
}

export function assertSameOrigin(request: Request, origin: string) {
  const requestOrigin = storeRequestOrigin(request, origin);
  if (request.headers.get("origin") !== requestOrigin || request.headers.get("sec-fetch-site") === "cross-site") throw new StoreError("Please open the store and try again.", 403);
  return requestOrigin;
}

export async function readBody(request: Request, maxBytes = 8192): Promise<string> {
  if (!request.body) throw new StoreError("A request body is required.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new StoreError("The request is too large.", 413); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new StoreError("Send a JSON request.", 415);
  const raw = await readBody(request);
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new StoreError("The request could not be read."); }
}

export function jsonResponse(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
}
export function errorResponse(error: unknown): Response {
  if (error instanceof StoreError) return jsonResponse({ error: error.message }, error.status);
  // Provider errors may contain personal information or credentials; don't return/log them.
  return jsonResponse({ error: "We could not reach the payment service. Please retry in a moment. If you already paid, keep your receipt and use My templates." }, 502);
}
