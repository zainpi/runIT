// Sign in with Apple server-to-server notification endpoint for The Last Echo.
// Register https://runs-it.com/the-last-echo/api/apple/notifications in Apple
// Developer > Identifiers > com.ancienthorizon.game > Sign In with Apple.
//
// Server-only configuration (Cloudflare secrets, never committed):
//   LAST_ECHO_SUPABASE_SERVICE_ROLE_KEY  service-role key of the game's Supabase project
//   LAST_ECHO_SUPABASE_URL               optional; defaults to NEXT_PUBLIC_SUPABASE_URL
//   LAST_ECHO_APPLE_AUDIENCES            optional comma list; defaults to the bundle ID
import { createClient } from "@supabase/supabase-js";
import { createRemoteJWKSet } from "jose";
import {
  APPLE_JWKS_URL,
  DEFAULT_APPLE_AUDIENCES,
  createAppleNotificationHandler,
} from "@/lib/the-last-echo/apple-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const appleKeys = createRemoteJWKSet(new URL(APPLE_JWKS_URL));

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

function audiences(): string[] {
  const configured = (process.env.LAST_ECHO_APPLE_AUDIENCES ?? "")
    .split(",").map((value) => value.trim()).filter(Boolean);
  return configured.length > 0 ? configured : DEFAULT_APPLE_AUDIENCES;
}

const handler = createAppleNotificationHandler({
  appleKeys,
  get audiences() {
    return audiences();
  },
  async recordEvent(event) {
    const url = process.env.LAST_ECHO_SUPABASE_URL?.trim() || requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    const admin = createClient(url, requiredEnv("LAST_ECHO_SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.rpc("handle_apple_signin_event", {
      p_event_id: event.eventId,
      p_sub: event.sub,
      p_type: event.type,
      p_event_time: event.eventTime.toISOString(),
    });
    if (error) throw new Error("apple_signin_event_failed");
    return typeof data?.outcome === "string" ? data.outcome : "recorded";
  },
});

export async function POST(request: Request) {
  return handler(request);
}
