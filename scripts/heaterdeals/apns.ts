import { connect } from "node:http2";
import { importPKCS8, SignJWT } from "jose";

let cachedToken: { jwt: string; until: number } | undefined;
export type PushResult = { status: number; reason?: string };
export type PushRequest = {
  token: string; environment: "sandbox" | "production"; payload: unknown;
  id: string; expiresAt: string;
};

async function providerToken(): Promise<string> {
  if (cachedToken && cachedToken.until > Date.now()) return cachedToken.jwt;
  const keyID = process.env.HEATERDEALS_APNS_KEY_ID;
  const teamID = process.env.HEATERDEALS_APNS_TEAM_ID;
  const pem = process.env.HEATERDEALS_APNS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!keyID || !teamID || !pem) throw new Error("APNs signing configuration is missing");
  const key = await importPKCS8(pem, "ES256");
  const jwt = await new SignJWT({}).setProtectedHeader({ alg: "ES256", kid: keyID })
    .setIssuer(teamID).setIssuedAt().sign(key);
  cachedToken = { jwt, until: Date.now() + 40 * 60_000 };
  return jwt;
}

// Native HTTP/2 is required by APNs. Run this dispatcher in Node, separately
// from the Cloudflare request worker; do not substitute an HTTP/1 fetch client.
export async function sendPush(request: PushRequest): Promise<PushResult> {
  const jwt = await providerToken();
  const host = request.environment === "sandbox" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
  return new Promise((resolve, reject) => {
    const session = connect(`https://${host}`);
    const finish = () => session.close();
    session.on("error", (error) => { session.destroy(); reject(error); });
    session.setTimeout(12_000, () => { session.destroy(); reject(new Error("APNs request timed out")); });
    const stream = session.request({
      ":method": "POST", ":path": `/3/device/${request.token}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": process.env.HEATERDEALS_BUNDLE_ID ?? "com.pulsedeals.app",
      "apns-push-type": "alert", "apns-priority": "10",
      "apns-expiration": String(Math.floor(new Date(request.expiresAt).getTime() / 1000)),
      "apns-id": request.id, "apns-collapse-id": request.id,
      "content-type": "application/json",
    });
    let status = 0;
    let body = "";
    stream.setEncoding("utf8");
    stream.on("response", (headers) => { status = Number(headers[":status"]); });
    stream.on("data", (chunk: string) => { if (body.length < 4_096) body += chunk; });
    stream.on("error", (error) => { finish(); reject(error); });
    stream.on("end", () => {
      finish();
      let reason: string | undefined;
      try { reason = JSON.parse(body).reason; } catch { /* A successful response has no body. */ }
      if (reason === "ExpiredProviderToken") cachedToken = undefined;
      resolve({ status, reason });
    });
    stream.end(JSON.stringify(request.payload));
  });
}
