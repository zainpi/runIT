import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  HEATER_CATEGORIES,
  HEATER_MARKETPLACES,
  type FeedResponse,
  type HeaterCategory,
  type HeaterDeal,
  type HeaterMarketplace,
  type SessionResponse,
} from "./types";

const textEncoder = new TextEncoder();
const SESSION_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 90 * 24 * 60 * 60;
const SUBSCRIPTION_PRODUCT_ID = "com.heaterdeals.subscription.monthly";
const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";

type AppleIdentity = {
  sub: string;
  email?: string;
};

type SessionClaims = {
  sub: string;
  iat: number;
  exp: number;
  typ: "heater-session";
};

type AccountRow = {
  id: string;
  apple_sub: string;
  app_account_token: string;
  email: string | null;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
};

type AppleJwk = JsonWebKey & { kid?: string };

let appleKeysCache: { expiresAt: number; keys: AppleJwk[] } | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

export function getProductID(): string {
  return process.env.HEATERDEALS_PRODUCT_ID ?? SUBSCRIPTION_PRODUCT_ID;
}

export function getAdminClient(): SupabaseClient {
  return createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
}

function base64urlEncode(value: Uint8Array | string): string {
  const bytes = typeof value === "string" ? textEncoder.encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64urlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64urlEncode(bytes);
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(value));
  return base64urlEncode(new Uint8Array(digest));
}

function decodeJsonPart<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(base64urlDecode(value))) as T;
}

function decodeJwt<T>(token: string): { header: Record<string, unknown>; payload: T; signingInput: string; signature: Uint8Array } {
  const pieces = token.split(".");
  if (pieces.length !== 3) throw new Error("Malformed signed token");
  return {
    header: decodeJsonPart<Record<string, unknown>>(pieces[0]),
    payload: decodeJsonPart<T>(pieces[1]),
    signingInput: `${pieces[0]}.${pieces[1]}`,
    signature: base64urlDecode(pieces[2]),
  };
}

async function signSession(claims: SessionClaims): Promise<string> {
  const secret = getRequiredEnv("HEATERDEALS_SESSION_SECRET");
  const header = base64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64urlEncode(JSON.stringify(claims));
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(signingInput));
  return `${signingInput}.${base64urlEncode(new Uint8Array(signature))}`;
}

async function verifySession(token: string): Promise<SessionClaims> {
  const secret = getRequiredEnv("HEATERDEALS_SESSION_SECRET");
  const decoded = decodeJwt<SessionClaims>(token);
  if (decoded.header.alg !== "HS256" || decoded.payload.typ !== "heater-session") {
    throw new Error("Invalid session token");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    decoded.signature as unknown as BufferSource,
    textEncoder.encode(decoded.signingInput),
  );
  if (!valid || decoded.payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error("Expired session token");
  }
  return decoded.payload;
}

async function getAppleKeys(): Promise<AppleJwk[]> {
  if (appleKeysCache && appleKeysCache.expiresAt > Date.now()) return appleKeysCache.keys;
  const response = await fetch(APPLE_JWKS_URL, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("Apple identity keys unavailable");
  const body = (await response.json()) as { keys?: AppleJwk[] };
  if (!body.keys?.length) throw new Error("Apple identity keys missing");
  appleKeysCache = { keys: body.keys, expiresAt: Date.now() + 6 * 60 * 60 * 1000 };
  return body.keys;
}

export async function verifyAppleIdentityToken(token: string): Promise<AppleIdentity> {
  const decoded = decodeJwt<{ iss?: string; aud?: string | string[]; exp?: number; sub?: string; email?: string }>(token);
  if (decoded.header.alg !== "RS256" || typeof decoded.header.kid !== "string") {
    throw new Error("Invalid Apple identity token header");
  }
  const key = (await getAppleKeys()).find((candidate) => candidate.kid === decoded.header.kid);
  if (!key) throw new Error("Unknown Apple identity key");
  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    key,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    decoded.signature as unknown as BufferSource,
    textEncoder.encode(decoded.signingInput) as unknown as BufferSource,
  );
  const audience = Array.isArray(decoded.payload.aud) ? decoded.payload.aud : [decoded.payload.aud];
  const bundleID = process.env.HEATERDEALS_BUNDLE_ID ?? "com.heaterdeals.app";
  if (
    !valid ||
    decoded.payload.iss !== APPLE_ISSUER ||
    !audience.includes(bundleID) ||
    !decoded.payload.exp ||
    decoded.payload.exp <= Math.floor(Date.now() / 1000) ||
    !decoded.payload.sub
  ) {
    throw new Error("Apple identity token failed verification");
  }
  return { sub: decoded.payload.sub, email: decoded.payload.email };
}

export async function createOrGetAccount(
  admin: SupabaseClient,
  identity: AppleIdentity,
  requestedAppAccountToken: string,
): Promise<AccountRow> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedAppAccountToken)) {
    throw new Error("Invalid app account token");
  }

  const tokenLookup = await admin
    .from("heater_accounts")
    .select("id, apple_sub, app_account_token, email")
    .eq("app_account_token", requestedAppAccountToken)
    .maybeSingle();
  if (tokenLookup.error) throw tokenLookup.error;
  if (tokenLookup.data && tokenLookup.data.apple_sub !== identity.sub) {
    throw new Error("App account token is already linked");
  }

  const subLookup = await admin
    .from("heater_accounts")
    .select("id, apple_sub, app_account_token, email")
    .eq("apple_sub", identity.sub)
    .maybeSingle();
  if (subLookup.error) throw subLookup.error;
  if (subLookup.data) {
    const update: Record<string, string> = { updated_at: new Date().toISOString() };
    if (identity.email && !subLookup.data.email) update.email = identity.email;
    if (subLookup.data.app_account_token !== requestedAppAccountToken) {
      const entitlementLookup = await admin
        .from("heater_entitlements")
        .select("id")
        .eq("account_id", subLookup.data.id)
        .limit(1);
      if (entitlementLookup.error) throw entitlementLookup.error;
      if (!entitlementLookup.data?.length) update.app_account_token = requestedAppAccountToken;
    }
    const updated = await admin
      .from("heater_accounts")
      .update(update)
      .eq("id", subLookup.data.id)
      .select("id, apple_sub, app_account_token, email")
      .single();
    if (updated.error) throw updated.error;
    return updated.data as AccountRow;
  }

  const inserted = await admin
    .from("heater_accounts")
    .insert({
      apple_sub: identity.sub,
      app_account_token: requestedAppAccountToken,
      email: identity.email ?? null,
    })
    .select("id, apple_sub, app_account_token, email")
    .single();
  if (inserted.error) throw inserted.error;
  return inserted.data as AccountRow;
}

export async function issueSession(admin: SupabaseClient, account: AccountRow): Promise<SessionResponse> {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = new Date((now + SESSION_TTL_SECONDS) * 1000).toISOString();
  const refreshToken = randomToken();
  const refreshInsert = await admin.from("heater_refresh_tokens").insert({
    account_id: account.id,
    token_hash: await sha256(refreshToken),
    expires_at: new Date((now + REFRESH_TTL_SECONDS) * 1000).toISOString(),
  });
  if (refreshInsert.error) throw refreshInsert.error;
  return {
    accessToken: await signSession({ sub: account.id, iat: now, exp: now + SESSION_TTL_SECONDS, typ: "heater-session" }),
    refreshToken,
    expiresAt,
    accountId: account.id,
    appAccountToken: account.app_account_token,
  };
}

export async function refreshSession(admin: SupabaseClient, refreshToken: string): Promise<SessionResponse> {
  if (refreshToken.length < 32 || refreshToken.length > 300) throw new Error("Invalid refresh token");
  const tokenHash = await sha256(refreshToken);
  const lookup = await admin
    .from("heater_refresh_tokens")
    .select("id, account_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (lookup.error) throw lookup.error;
  if (!lookup.data || lookup.data.revoked_at || new Date(lookup.data.expires_at).getTime() <= Date.now()) {
    throw new Error("Invalid refresh token");
  }
  const revoked = await admin
    .from("heater_refresh_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", lookup.data.id)
    .is("revoked_at", null)
    .select("id");
  if (revoked.error) throw revoked.error;
  if (!revoked.data?.length) throw new Error("Invalid refresh token");
  const account = await admin
    .from("heater_accounts")
    .select("id, apple_sub, app_account_token, email")
    .eq("id", lookup.data.account_id)
    .single();
  if (account.error) throw account.error;
  return issueSession(admin, account.data as AccountRow);
}

export async function requireSession(request: Request): Promise<SessionClaims> {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error("Missing bearer token");
  return verifySession(match[1]);
}

export async function requireActiveSubscription(admin: SupabaseClient, accountID: string): Promise<Record<string, unknown>> {
  const result = await admin
    .from("heater_entitlements")
    .select("product_id, status, expires_at, environment")
    .eq("account_id", accountID)
    .eq("product_id", getProductID())
    .in("status", ["active", "grace_period"])
    .gt("expires_at", new Date().toISOString())
    .is("revoked_at", null)
    .limit(1)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error("Active subscription required");
  return result.data as Record<string, unknown>;
}

export async function consumeRateLimit(
  admin: SupabaseClient,
  bucketKey: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const result = await admin.rpc("consume_heater_rate_limit", {
    p_bucket_key: bucketKey,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (result.error) throw result.error;
  const value = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!value) throw new Error("Rate limiter returned no result");
  return value as RateLimitResult;
}

export async function claimIdempotency(
  admin: SupabaseClient,
  accountID: string,
  route: string,
  request: Request,
): Promise<boolean> {
  const key = request.headers.get("idempotency-key");
  if (!key) return true;
  if (key.length < 8 || key.length > 160) throw new Error("Invalid Idempotency-Key");
  const result = await admin.rpc("claim_heater_idempotency", {
    p_account_id: accountID,
    p_route: route,
    p_idempotency_key: key,
  });
  if (result.error) throw result.error;
  return Boolean(result.data);
}

export function normalizeMarketplace(value: string | null): HeaterMarketplace {
  if (value && (HEATER_MARKETPLACES as readonly string[]).includes(value)) return value as HeaterMarketplace;
  return "us";
}

export function normalizeCategory(value: string | null): HeaterCategory | null {
  if (value && (HEATER_CATEGORIES as readonly string[]).includes(value)) return value as HeaterCategory;
  return null;
}

export function parseNumber(value: string | null, fallback: number, min: number, max: number): number {
  if (value === null || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function parseBoolean(value: string | null): boolean {
  return value === "1" || value === "true" || value === "yes";
}

export function mapDeal(row: Record<string, unknown>): HeaterDeal {
  return {
    asin: String(row.asin),
    title: String(row.title ?? "Amazon deal"),
    marketplace: normalizeMarketplace(String(row.marketplace ?? "us")),
    category: normalizeCategory(String(row.category ?? "tech")) ?? "tech",
    currentPrice: Number(row.current_price ?? 0),
    referencePrice: Number(row.reference_price ?? 0),
    average90DayPrice: Number(row.average90_day_price ?? 0),
    score: Number(row.score ?? 0),
    confidence: Number(row.confidence ?? 0),
    reasoning: String(row.reasoning ?? ""),
    minutesAgo: Number(row.minutes_ago ?? 0),
    seller: String(row.seller ?? "Amazon"),
    sellerRating: Number(row.seller_rating ?? 0),
    isFBA: Boolean(row.is_fba),
    isPrime: Boolean(row.is_prime),
    status: row.status === "burnedOut" ? "burnedOut" : "live",
    iconName: String(row.icon_name ?? "flame.fill"),
    priceHistory: Array.isArray(row.price_history) ? (row.price_history as Array<{ date: string; price: number }>) : [],
    offerListingID: row.offer_listing_id ? String(row.offer_listing_id) : null,
  };
}

export async function getFeed(
  admin: SupabaseClient,
  params: URLSearchParams,
): Promise<FeedResponse> {
  const marketplace = normalizeMarketplace(params.get("marketplace"));
  const category = normalizeCategory(params.get("category"));
  const page = Math.min(100, Math.max(0, Math.floor(parseNumber(params.get("page"), 0, 0, 100))));
  const pageSize = Math.min(50, Math.max(1, Math.floor(parseNumber(params.get("pageSize"), 20, 1, 50))));
  const minHeat = Math.floor(parseNumber(params.get("minHeat"), 0, 0, 100));
  const minDiscount = Math.floor(parseNumber(params.get("minDiscount"), 0, 0, 100));
  const minPrice = parseNumber(params.get("minPrice"), 0, 0, 100000);
  const maxPrice = parseNumber(params.get("maxPrice"), 100000, 0, 100000);
  const fbaOnly = parseBoolean(params.get("fbaOnly"));

  let query = admin
    .from("heater_deals")
    .select("*")
    .eq("marketplace", marketplace)
    .eq("status", "live")
    .gte("score", minHeat)
    .gte("current_price", minPrice)
    .lte("current_price", Math.max(minPrice, maxPrice))
    .gte("reference_price", 0)
    .order("score", { ascending: false })
    .order("observed_at", { ascending: false })
    .range(page * pageSize, page * pageSize + pageSize);
  if (category) query = query.eq("category", category);
  if (fbaOnly) query = query.eq("is_fba", true);

  const result = await query;
  if (result.error) throw result.error;
  const rows = (result.data ?? []) as Array<Record<string, unknown>>;
  const deals = rows.filter((row) => {
    const reference = Number(row.reference_price ?? 0);
    const current = Number(row.current_price ?? 0);
    const discount = reference > 0 ? ((reference - current) / reference) * 100 : 0;
    return discount >= minDiscount;
  });
  const fetchedAt = rows.length
    ? rows.reduce((latest, row) => {
        const candidate = String(row.keepa_updated_at ?? row.observed_at ?? "");
        return candidate > latest ? candidate : latest;
      }, "")
    : null;
  return {
    data: deals.slice(0, pageSize).map(mapDeal),
    page,
    pageSize,
    hasMore: rows.length === pageSize + 1,
    fetchedAt: fetchedAt || null,
  };
}

export function apiHeaders(request: Request): Headers {
  const headers = new Headers({
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  });
  const origin = request.headers.get("origin");
  const allowedOrigins = new Set([
    "https://runs-it.com",
    "https://runsit.ca",
    "https://www.runsit.ca",
    "http://localhost:3000",
  ]);
  if (origin && allowedOrigins.has(origin)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-headers", "authorization, content-type, idempotency-key, x-app-attest");
    headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
    headers.set("vary", "Origin");
  }
  return headers;
}

export function apiJson(request: Request, body: unknown, status = 200, extra?: HeadersInit): Response {
  const headers = apiHeaders(request);
  if (extra) new Headers(extra).forEach((value, key) => headers.set(key, value));
  return new Response(JSON.stringify(body), { status, headers });
}

export function apiError(request: Request, status: number, code: string, message: string, extra?: HeadersInit): Response {
  return apiJson(request, { ok: false, error: { code, message } }, status, extra);
}

export function handleApiError(request: Request, error: unknown): Response {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  if (
    message === "Missing bearer token" ||
    message.includes("session token") ||
    message === "Invalid refresh token"
  ) {
    return apiError(request, 401, "unauthorized", "A valid session is required.");
  }
  if (message.includes("Apple identity")) {
    return apiError(request, 401, "invalid_identity", "The Apple sign-in could not be verified.");
  }
  if (message === "Invalid app account token") {
    return apiError(request, 400, "invalid_request", "The app account token is invalid.");
  }
  if (message === "Active subscription required") {
    return apiError(request, 403, "subscription_required", "An active HeaterDeals subscription is required.");
  }
  if (message === "App account token is already linked") {
    return apiError(request, 409, "account_token_conflict", "This app account token is already linked to another account.");
  }
  if (message.includes("Missing server configuration")) {
    return apiError(request, 503, "not_configured", "The HeaterDeals API is not configured yet.");
  }
  console.error("HeaterDeals API error:", error);
  return apiError(request, 500, "server_error", "HeaterDeals could not complete that request.");
}

export function checkBodySize(request: Request, maxBytes = 128_000): Response | null {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes) return apiError(request, 413, "payload_too_large", "Request body is too large.");
  return null;
}

export function getClientKey(request: Request, accountID: string): string {
  return `${accountID}:${getRequestIP(request)}`;
}

export function getRequestIP(request: Request): string {
  const forwarded = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "unknown";
  return forwarded.split(",")[0].trim().slice(0, 80) || "unknown";
}

export async function enforceRateLimit(
  request: Request,
  admin: SupabaseClient,
  bucketKey: string,
  limit: number,
  windowSeconds: number,
): Promise<Response | null> {
  const result = await consumeRateLimit(admin, bucketKey, limit, windowSeconds);
  if (result.allowed) return null;
  return apiError(
    request,
    429,
    "rate_limited",
    "Too many requests. Try again shortly.",
    { "retry-after": String(result.retry_after_seconds), "x-ratelimit-remaining": "0" },
  );
}
