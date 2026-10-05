// Sign in with Apple server-to-server notifications for The Last Echo.
//
// Apple POSTs {"payload": "<JWT>"} when a player changes how their Apple ID works with
// the game. The JWT is signed by Apple; its "events" claim is a JSON string such as
// {"type":"consent-revoked","sub":"001234.abcd...","event_time":1508184845}.
// We verify the signature, issuer and audience, then hand the event to the game's
// Supabase (migration 061 in the AncientHorizon repo, handle_apple_signin_event),
// which signs the player out or queues an Apple-only account for deletion.
// Dependencies are injected so every path is testable without Apple or Supabase.
import { createHash } from "node:crypto";
import { jwtVerify, type JWTVerifyGetKey } from "jose";

export const APPLE_ISSUER = "https://appleid.apple.com";
export const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
// The game's bundle ID: the client_id native Sign in with Apple tokens are issued to.
export const DEFAULT_APPLE_AUDIENCES = ["com.ancienthorizon.game"];
const MAX_BODY_BYTES = 16_384;
const MAX_SUB_LENGTH = 255;
const EVENT_TYPES = new Set(["email-disabled", "email-enabled", "consent-revoked", "account-delete"]);
// Apple documents event_time in seconds; accept milliseconds defensively.
const MILLISECOND_EPOCH_THRESHOLD = 1e12;

export type AppleEventType = "email-disabled" | "email-enabled" | "consent-revoked" | "account-delete";

export interface AppleSignInEvent {
  eventId: string;
  sub: string;
  type: AppleEventType;
  eventTime: Date;
}

export interface AppleNotificationDependencies {
  appleKeys: JWTVerifyGetKey;
  audiences: string[];
  // Resolves to the stored outcome; throws when the database is unreachable so Apple retries.
  recordEvent(event: AppleSignInEvent): Promise<string>;
}

function reply(status: number, payload: object): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export function parseAppleEvent(claims: Record<string, unknown>): AppleSignInEvent | null {
  const raw = claims.events;
  let events: unknown = raw;
  if (typeof raw === "string") {
    try {
      events = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!events || typeof events !== "object" || Array.isArray(events)) return null;
  const { type, sub, event_time: eventTime } = events as Record<string, unknown>;
  if (typeof type !== "string" || !EVENT_TYPES.has(type)) return null;
  if (typeof sub !== "string" || sub.length === 0 || sub.length > MAX_SUB_LENGTH) return null;
  const seconds = typeof eventTime === "number" ? eventTime
    : typeof eventTime === "string" && /^\d+$/.test(eventTime) ? Number(eventTime) : NaN;
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const millis = seconds >= MILLISECOND_EPOCH_THRESHOLD ? seconds : seconds * 1000;
  // A redelivered notification keeps its jti, so it maps to the same event id.
  const jti = typeof claims.jti === "string" && claims.jti ? claims.jti : null;
  const eventId = createHash("sha256")
    .update(jti ? `jti:${jti}` : `event:${sub}|${type}|${millis}`)
    .digest("hex");
  return { eventId, sub, type: type as AppleEventType, eventTime: new Date(millis) };
}

export function createAppleNotificationHandler(deps: AppleNotificationDependencies) {
  return async (request: Request): Promise<Response> => {
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (declared > MAX_BODY_BYTES) return reply(413, { ok: false, error: "body_too_large" });
    const body = await request.text();
    if (body.length > MAX_BODY_BYTES) return reply(413, { ok: false, error: "body_too_large" });

    let payload: unknown;
    try {
      payload = (JSON.parse(body) as Record<string, unknown> | null)?.payload;
    } catch {
      return reply(400, { ok: false, error: "invalid_json" });
    }
    if (typeof payload !== "string" || payload.length === 0) {
      return reply(400, { ok: false, error: "invalid_request" });
    }

    let claims: Record<string, unknown>;
    try {
      ({ payload: claims } = await jwtVerify(payload, deps.appleKeys, {
        issuer: APPLE_ISSUER,
        audience: deps.audiences,
        algorithms: ["RS256"],
      }));
    } catch {
      return reply(401, { ok: false, error: "invalid_signature" });
    }

    const event = parseAppleEvent(claims);
    if (!event) return reply(400, { ok: false, error: "invalid_event" });

    try {
      const outcome = await deps.recordEvent(event);
      return reply(200, { ok: true, outcome });
    } catch {
      // Non-2xx makes Apple redeliver; the event id keeps the retry idempotent.
      return reply(503, { ok: false, error: "unavailable" });
    }
  };
}
