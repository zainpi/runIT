import assert from "node:assert/strict";
import test from "node:test";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import {
  APPLE_ISSUER,
  DEFAULT_APPLE_AUDIENCES,
  createAppleNotificationHandler,
  parseAppleEvent,
  type AppleSignInEvent,
} from "../../src/lib/the-last-echo/apple-notifications";

const SUB = "001234.0123456789abcdef0123456789abcdef.0123";

async function fixture(record?: (event: AppleSignInEvent) => Promise<string>) {
  const apple = await generateKeyPair("RS256");
  const attacker = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(apple.publicKey)), kid: "apple-key", alg: "RS256" };
  const received: AppleSignInEvent[] = [];
  const handler = createAppleNotificationHandler({
    appleKeys: createLocalJWKSet({ keys: [jwk] }),
    audiences: DEFAULT_APPLE_AUDIENCES,
    recordEvent: record ?? (async (event) => {
      received.push(event);
      return "signed_out";
    }),
  });
  const sign = (claims: Record<string, unknown>, options: { key?: CryptoKey; iss?: string; aud?: string } = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: "RS256", kid: "apple-key" })
      .setIssuer(options.iss ?? APPLE_ISSUER)
      .setAudience(options.aud ?? DEFAULT_APPLE_AUDIENCES[0])
      .setIssuedAt()
      .setExpirationTime("10m")
      .sign(options.key ?? apple.privateKey);
  return { handler, sign, received, attackerKey: attacker.privateKey };
}

const post = (body: unknown) => new Request("https://runs-it.com/the-last-echo/api/apple/notifications", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

const events = (type: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ type, sub: SUB, event_time: 1759651200, ...extra });

test("a signed consent-revoked notification is recorded", async () => {
  const { handler, sign, received } = await fixture();
  const res = await handler(post({ payload: await sign({ jti: "n-1", events: events("consent-revoked") }) }));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, outcome: "signed_out" });
  assert.equal(received.length, 1);
  assert.equal(received[0].sub, SUB);
  assert.equal(received[0].type, "consent-revoked");
  assert.equal(received[0].eventTime.toISOString(), "2025-10-05T08:00:00.000Z");
  assert.match(received[0].eventId, /^[0-9a-f]{64}$/);
});

test("forged, foreign-audience and wrong-issuer tokens are rejected before the database", async () => {
  const { handler, sign, received, attackerKey } = await fixture();
  for (const token of [
    await sign({ events: events("account-delete") }, { key: attackerKey }),
    await sign({ events: events("account-delete") }, { aud: "com.someone.else" }),
    await sign({ events: events("account-delete") }, { iss: "https://example.com" }),
    "not-a-jwt",
  ]) {
    assert.equal((await handler(post({ payload: token }))).status, 401);
  }
  assert.equal(received.length, 0);
});

test("malformed requests and events are rejected", async () => {
  const { handler, sign, received } = await fixture();
  assert.equal((await handler(post("{"))).status, 400);
  assert.equal((await handler(post({}))).status, 400);
  assert.equal((await handler(post({ payload: await sign({ events: events("password-reset") }) }))).status, 400);
  assert.equal((await handler(post({ payload: await sign({ events: "{" }) }))).status, 400);
  assert.equal((await handler(post({ payload: "x".repeat(20_000) }))).status, 413);
  assert.equal(received.length, 0);
});

test("a database failure returns 503 so Apple redelivers", async () => {
  const { handler, sign } = await fixture(async () => {
    throw new Error("down");
  });
  const res = await handler(post({ payload: await sign({ events: events("account-delete") }) }));
  assert.equal(res.status, 503);
});

test("redeliveries map to the same event id", () => {
  const first = parseAppleEvent({ jti: "same", events: events("account-delete") });
  const again = parseAppleEvent({ jti: "same", events: events("account-delete") });
  const other = parseAppleEvent({ jti: "other", events: events("account-delete") });
  const noJti = parseAppleEvent({ events: events("account-delete") });
  assert.ok(first && again && other && noJti);
  assert.equal(first.eventId, again.eventId);
  assert.notEqual(first.eventId, other.eventId);
  assert.equal(noJti.eventId, parseAppleEvent({ events: events("account-delete") })?.eventId);
  // Object-form events and millisecond timestamps are accepted too.
  const objectForm = parseAppleEvent({ events: { type: "email-enabled", sub: SUB, event_time: 1759651200000 } });
  assert.equal(objectForm?.eventTime.toISOString(), "2025-10-05T08:00:00.000Z");
});
