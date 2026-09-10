import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  HEATER_CATEGORIES,
  HEATER_DEAL_VOTES,
  HEATER_MARKETPLACES,
  type FeedResponse,
  type HeaterCategory,
  type HeaterDeal,
  type HeaterDealVote,
  type HeaterDealVoteSummary,
  type HeaterMarketplace,
  type HeaterDiscordConnection,
  type SessionResponse,
} from "./types";

const textEncoder = new TextEncoder();
const SESSION_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 90 * 24 * 60 * 60;
const SUBSCRIPTION_PRODUCT_ID = "com.pulsedeals.subscription.weekly";
const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
const DISCORD_API_BASE = "https://discord.com/api/v10";
const DISCORD_LINK_TTL_SECONDS = 10 * 60;

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

type DiscordConfig = {
  clientID: string;
  clientSecret: string;
  botToken: string;
  guildID: string;
  roleID: string;
  redirectURI: string;
  serverName: string;
};

type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
};

type DiscordGuildMember = {
  user?: DiscordUser;
  roles?: string[];
  pending?: boolean;
};

type DiscordLinkRow = {
  id: string;
  account_id: string;
  discord_user_id: string;
  username: string;
  global_name: string | null;
  avatar_hash: string | null;
  guild_id: string;
  membership_status: "member" | "pending" | "not_member" | "unknown";
  is_pending: boolean;
  has_access_role: boolean;
  access_granted: boolean;
  linked_at: string;
  updated_at: string;
  membership_checked_at?: string | null;
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

export async function isSupportedAppleProduct(admin: SupabaseClient, productID?: string): Promise<boolean> {
  if (!productID) return false;
  const result = await admin.from("heater_product_tiers").select("product_id").eq("product_id", productID).maybeSingle();
  if (result.error) throw result.error;
  return Boolean(result.data);
}

export function getDiscordConfig(): DiscordConfig {
  const required = [
    "HEATERDEALS_DISCORD_CLIENT_ID",
    "HEATERDEALS_DISCORD_CLIENT_SECRET",
    "HEATERDEALS_DISCORD_BOT_TOKEN",
    "HEATERDEALS_DISCORD_GUILD_ID",
    "HEATERDEALS_DISCORD_ROLE_ID",
  ];
  const missing = required.find((name) => !process.env[name]);
  if (missing) throw new Error(`Missing server configuration: ${missing}`);

  const paidRoles = [process.env.HEATERDEALS_DISCORD_PAID_ROLE_ID, process.env.HEATERDEALS_DISCORD_PRO_ROLE_ID].filter(Boolean);
  if (paidRoles.includes(process.env.HEATERDEALS_DISCORD_ROLE_ID)) throw new Error("Paid Discord roles must differ from the app access role");
  return {
    clientID: process.env.HEATERDEALS_DISCORD_CLIENT_ID!,
    clientSecret: process.env.HEATERDEALS_DISCORD_CLIENT_SECRET!,
    botToken: process.env.HEATERDEALS_DISCORD_BOT_TOKEN!,
    guildID: process.env.HEATERDEALS_DISCORD_GUILD_ID!,
    roleID: process.env.HEATERDEALS_DISCORD_ROLE_ID!,
    redirectURI: process.env.HEATERDEALS_DISCORD_REDIRECT_URI
      ?? "https://runsit.ca/heaterdeals/api/v1/discord/callback",
    serverName: process.env.HEATERDEALS_DISCORD_SERVER_NAME ?? "Pulse Deals",
  };
}

function discordBotHeaders(config: DiscordConfig, includeJSON = false): HeadersInit {
  return {
    authorization: `Bot ${config.botToken}`,
    ...(includeJSON ? { "content-type": "application/json" } : {}),
  };
}

async function discordJSON<T>(config: DiscordConfig, path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${DISCORD_API_BASE}${path}`, init);
  if (!response.ok) {
    console.error("Discord API request failed", response.status, path);
    throw new Error("Discord API request failed");
  }
  return (await response.json()) as T;
}

async function exchangeDiscordCode(config: DiscordConfig, code: string): Promise<string> {
  if (code.length < 8 || code.length > 500) throw new Error("Discord OAuth exchange failed");
  const response = await fetch(`${DISCORD_API_BASE}/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${btoa(`${config.clientID}:${config.clientSecret}`)}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.clientID,
      client_secret: config.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectURI,
    }),
  });
  if (!response.ok) {
    console.error("Discord OAuth token exchange failed", response.status);
    throw new Error("Discord OAuth exchange failed");
  }
  const payload = (await response.json()) as { access_token?: unknown };
  if (typeof payload.access_token !== "string" || !payload.access_token) {
    throw new Error("Discord OAuth exchange failed");
  }
  return payload.access_token;
}

async function revokeDiscordToken(config: DiscordConfig, accessToken: string): Promise<void> {
  try {
    await fetch(`${DISCORD_API_BASE}/oauth2/token/revoke`, {
      method: "POST",
      headers: {
        authorization: `Basic ${btoa(`${config.clientID}:${config.clientSecret}`)}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: config.clientID,
        client_secret: config.clientSecret,
        token: accessToken,
      }),
    });
  } catch (error) {
    console.error("Discord OAuth token revocation failed", error);
  }
}

async function getDiscordMember(
  config: DiscordConfig,
  discordUserID: string,
): Promise<DiscordGuildMember | null> {
  const path = `/guilds/${encodeURIComponent(config.guildID)}/members/${encodeURIComponent(discordUserID)}`;
  const response = await fetch(`${DISCORD_API_BASE}${path}`, {
    headers: discordBotHeaders(config),
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    console.error("Discord member lookup failed", response.status);
    throw new Error("Discord API request failed");
  }
  return (await response.json()) as DiscordGuildMember;
}

async function addDiscordMember(
  config: DiscordConfig,
  discordUserID: string,
  accessToken: string,
): Promise<void> {
  const path = `/guilds/${encodeURIComponent(config.guildID)}/members/${encodeURIComponent(discordUserID)}`;
  const response = await fetch(`${DISCORD_API_BASE}${path}`, {
    method: "PUT",
    headers: discordBotHeaders(config, true),
    body: JSON.stringify({ access_token: accessToken }),
  });
  if (response.status !== 201 && response.status !== 204) {
    console.error("Discord member provisioning failed", response.status);
    throw new Error("Discord server access could not be granted");
  }
}

async function addDiscordRole(config: DiscordConfig, discordUserID: string): Promise<void> {
  const path = `/guilds/${encodeURIComponent(config.guildID)}/members/${encodeURIComponent(discordUserID)}/roles/${encodeURIComponent(config.roleID)}`;
  const response = await fetch(`${DISCORD_API_BASE}${path}`, {
    method: "PUT",
    headers: discordBotHeaders(config),
  });
  if (!response.ok) {
    console.error("Discord access-role assignment failed", response.status);
    throw new Error("Discord server access could not be granted");
  }
}

async function removeDiscordRole(config: DiscordConfig, discordUserID: string): Promise<void> {
  const path = `/guilds/${encodeURIComponent(config.guildID)}/members/${encodeURIComponent(discordUserID)}/roles/${encodeURIComponent(config.roleID)}`;
  const response = await fetch(`${DISCORD_API_BASE}${path}`, {
    method: "DELETE",
    headers: discordBotHeaders(config),
  });
  if (response.status !== 404 && !response.ok) {
    console.error("Discord access-role removal failed", response.status);
    throw new Error("Discord access could not be revoked");
  }
}

export async function beginDiscordLink(
  admin: SupabaseClient,
  accountID: string,
): Promise<{ authorizationURL: string; state: string; expiresAt: string }> {
  const config = getDiscordConfig();
  const state = randomToken(32);
  const expiresAt = new Date(Date.now() + DISCORD_LINK_TTL_SECONDS * 1_000).toISOString();
  const stateHash = await sha256(state);
  const insert = await admin.from("heater_discord_link_states").insert({
    state_hash: stateHash,
    account_id: accountID,
    expires_at: expiresAt,
  });
  if (insert.error) throw insert.error;

  // Keep the state table bounded without touching any active authorization.
  await admin.from("heater_discord_link_states").delete().lt("expires_at", new Date().toISOString());

  const authorizationURL = new URL("https://discord.com/oauth2/authorize");
  authorizationURL.searchParams.set("response_type", "code");
  authorizationURL.searchParams.set("client_id", config.clientID);
  authorizationURL.searchParams.set("scope", "identify guilds.join");
  authorizationURL.searchParams.set("state", state);
  authorizationURL.searchParams.set("redirect_uri", config.redirectURI);
  authorizationURL.searchParams.set("prompt", "consent");

  return { authorizationURL: authorizationURL.toString(), state, expiresAt };
}

async function consumeDiscordLinkState(admin: SupabaseClient, state: string): Promise<string> {
  if (state.length < 20 || state.length > 200) throw new Error("Invalid or expired Discord link state");
  const stateHash = await sha256(state);
  const result = await admin
    .from("heater_discord_link_states")
    .update({ used_at: new Date().toISOString() })
    .eq("state_hash", stateHash)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("account_id")
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error("Invalid or expired Discord link state");
  return String(result.data.account_id);
}

export async function cancelDiscordLink(admin: SupabaseClient, state: string): Promise<void> {
  if (state.length < 20 || state.length > 200) return;
  await admin
    .from("heater_discord_link_states")
    .update({ used_at: new Date().toISOString() })
    .eq("state_hash", await sha256(state))
    .is("used_at", null);
}

async function ensureDiscordLinkAvailable(
  admin: SupabaseClient,
  accountID: string,
  discordUserID: string,
): Promise<void> {
  const accountLink = await admin
    .from("heater_discord_links")
    .select("account_id, discord_user_id")
    .eq("account_id", accountID)
    .maybeSingle();
  if (accountLink.error) throw accountLink.error;
  if (accountLink.data && accountLink.data.discord_user_id !== discordUserID) {
    throw new Error("A different Discord account is already linked");
  }

  const discordLink = await admin
    .from("heater_discord_links")
    .select("account_id")
    .eq("discord_user_id", discordUserID)
    .maybeSingle();
  if (discordLink.error) throw discordLink.error;
  if (discordLink.data && discordLink.data.account_id !== accountID) {
    throw new Error("This Discord account is already linked to another Pulse Deals account");
  }
}

function makeDiscordConnection(
  row: DiscordLinkRow,
  config: DiscordConfig,
  member: DiscordGuildMember | null,
  activeSubscription: boolean,
): HeaterDiscordConnection {
  const roles = member?.roles ?? [];
  const isMember = member !== null;
  const isPending = Boolean(member?.pending);
  const hasAccessRole = roles.includes(config.roleID);
  return {
    discordUserID: row.discord_user_id,
    username: row.username,
    globalName: row.global_name,
    serverName: config.serverName,
    isMember,
    isPending,
    hasAccessRole,
    accessGranted: Boolean(activeSubscription && isMember && !isPending && hasAccessRole),
    linkedAt: row.linked_at,
  };
}

async function saveDiscordLink(
  admin: SupabaseClient,
  accountID: string,
  config: DiscordConfig,
  user: DiscordUser,
  member: DiscordGuildMember,
  activeSubscription: boolean,
): Promise<HeaterDiscordConnection> {
  const roles = member.roles ?? [];
  const row = await admin
    .from("heater_discord_links")
    .upsert({
      account_id: accountID,
      discord_user_id: user.id,
      username: user.username,
      global_name: user.global_name ?? null,
      avatar_hash: user.avatar ?? null,
      guild_id: config.guildID,
      membership_status: member.pending ? "pending" : "member",
      is_pending: Boolean(member.pending),
      has_access_role: roles.includes(config.roleID),
      access_granted: Boolean(activeSubscription && !member.pending && roles.includes(config.roleID)),
      updated_at: new Date().toISOString(),
    }, { onConflict: "account_id" })
    .select("id, account_id, discord_user_id, username, global_name, avatar_hash, guild_id, membership_status, is_pending, has_access_role, access_granted, linked_at, updated_at")
    .single();
  if (row.error) {
    if (row.error.code === "23505") {
      throw new Error("This Discord account is already linked to another Pulse Deals account");
    }
    throw row.error;
  }
  return makeDiscordConnection(row.data as DiscordLinkRow, config, member, activeSubscription);
}

export async function completeDiscordLink(
  admin: SupabaseClient,
  state: string,
  code: string,
): Promise<HeaterDiscordConnection> {
  const accountID = await consumeDiscordLinkState(admin, state);
  const config = getDiscordConfig();

  let accessToken: string | null = null;
  try {
    accessToken = await exchangeDiscordCode(config, code);
    const user = await discordJSON<DiscordUser>(config, "/users/@me", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!user.id || !user.username) throw new Error("Discord profile could not be read");
    await ensureDiscordLinkAvailable(admin, accountID, user.id);

    await addDiscordMember(config, user.id, accessToken);
    let member = await getDiscordMember(config, user.id);
    if (!member) throw new Error("Discord server access could not be granted");

    const active = await hasActiveSubscription(admin, accountID) || paidDiscordTier(member) !== null;
    if (active && !member.pending && !(member.roles ?? []).includes(config.roleID)) {
      await addDiscordRole(config, user.id);
      member = { ...member, roles: [...(member.roles ?? []), config.roleID] };
    }

    await saveDiscordLink(admin, accountID, config, user, member, active);
    return (await getDiscordConnection(admin, accountID))!;
  } finally {
    if (accessToken) await revokeDiscordToken(config, accessToken);
  }
}

export type Membership = { tier: "none" | "standard" | "pro"; source: "none" | "apple" | "discord"; primaryMarketplace: HeaterMarketplace | null; expiresAt: string | null };

export function paidDiscordTier(member: DiscordGuildMember | null): "standard" | "pro" | null {
  if (!member || member.pending) return null;
  const roles = member.roles ?? [];
  const accessRole = process.env.HEATERDEALS_DISCORD_ROLE_ID;
  const proRole = process.env.HEATERDEALS_DISCORD_PRO_ROLE_ID;
  const paidRole = process.env.HEATERDEALS_DISCORD_PAID_ROLE_ID;
  if (proRole && proRole !== accessRole && roles.includes(proRole)) return "pro";
  if (paidRole && paidRole !== accessRole && roles.includes(paidRole)) return "standard";
  return null;
}

async function readMembership(admin: SupabaseClient, accountID: string): Promise<Membership> {
  const result = await admin.rpc("heater_membership", { p_account_id: accountID });
  if (result.error) throw result.error;
  const row = result.data?.[0];
  if (!row) throw new Error("Account not found");
  return { tier: row.tier, source: row.source, primaryMarketplace: row.primary_marketplace, expiresAt: row.expires_at };
}

export async function getMembership(admin: SupabaseClient, accountID: string, forceDiscord = false): Promise<Membership> {
  const link = await admin.from("heater_discord_links").select("membership_checked_at").eq("account_id", accountID).maybeSingle();
  if (link.error) throw link.error;
  if (link.data && (forceDiscord || !link.data.membership_checked_at || Date.parse(link.data.membership_checked_at) < Date.now()-300_000)) {
    try { await getDiscordConnection(admin, accountID); }
    catch { /* Use only the bounded grant already verified; outages never extend it. */ }
  }
  return readMembership(admin, accountID);
}

export async function hasActiveSubscription(admin: SupabaseClient, accountID: string): Promise<boolean> {
  return (await readMembership(admin, accountID)).tier !== "none";
}

export async function requireMarketplaceAccess(admin: SupabaseClient, accountID: string, marketplace: string): Promise<Membership> {
  if (!(HEATER_MARKETPLACES as readonly string[]).includes(marketplace)) throw new Error("Invalid marketplace");
  const membership = await requireActiveSubscription(admin, accountID);
  if (membership.tier !== "pro" && membership.primaryMarketplace !== marketplace) throw new Error("Your membership includes your selected country");
  return membership;
}

export async function refreshDiscordMemberships(admin: SupabaseClient): Promise<void> {
  const result = await admin.from("heater_discord_links").select("account_id")
    .or(`membership_checked_at.is.null,membership_checked_at.lt.${new Date(Date.now()-300_000).toISOString()}`)
    .order("membership_checked_at", { ascending: true, nullsFirst: true }).limit(100);
  if (result.error) throw result.error;
  for (const row of result.data ?? []) {
    try { await getDiscordConnection(admin, row.account_id); }
    catch { /* A failed check cannot renew a paid grant. Retry on the next scheduled sync. */ }
  }
}

export async function getDiscordConnection(
  admin: SupabaseClient,
  accountID: string,
): Promise<HeaterDiscordConnection | null> {
  const result = await admin
    .from("heater_discord_links")
    .select("id, account_id, discord_user_id, username, global_name, avatar_hash, guild_id, membership_status, is_pending, has_access_role, access_granted, linked_at, updated_at")
    .eq("account_id", accountID)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) return null;

  const config = getDiscordConfig();
  const row = result.data as DiscordLinkRow;
  let member = await getDiscordMember(config, row.discord_user_id);
  const paidTier = paidDiscordTier(member);
  const grant = await admin.from("heater_discord_links").update({
    paid_tier: paidTier, paid_access_expires_at: paidTier ? new Date(Date.now()+600_000).toISOString() : null,
    membership_checked_at: new Date().toISOString(),
    membership_status: member ? (member.pending ? "pending" : "member") : "not_member",
    is_pending: Boolean(member?.pending),
  }).eq("id", row.id);
  if (grant.error) throw grant.error;
  const activeSubscription = await hasActiveSubscription(admin, accountID);
  if (member) {
    const hasRole = (member.roles ?? []).includes(config.roleID);
    if (activeSubscription && !member.pending && !hasRole) {
      await addDiscordRole(config, row.discord_user_id);
      member = { ...member, roles: [...(member.roles ?? []), config.roleID] };
    } else if (!activeSubscription && hasRole) {
      await removeDiscordRole(config, row.discord_user_id);
      member = { ...member, roles: (member.roles ?? []).filter((role) => role !== config.roleID) };
    }
  }

  const connection = makeDiscordConnection(row, config, member, activeSubscription);
  const updated = await admin.from("heater_discord_links").update({
    guild_id: config.guildID,
    membership_status: member ? (member.pending ? "pending" : "member") : "not_member",
    is_pending: Boolean(member?.pending),
    has_access_role: connection.hasAccessRole,
    access_granted: connection.accessGranted,
    updated_at: new Date().toISOString(),
  }).eq("id", row.id);
  if (updated.error) throw updated.error;
  return connection;
}

export async function syncDiscordAccess(admin: SupabaseClient, accountID: string): Promise<void> {
  await getDiscordConnection(admin, accountID);
}

export async function unlinkDiscord(admin: SupabaseClient, accountID: string): Promise<void> {
  const result = await admin
    .from("heater_discord_links")
    .select("discord_user_id")
    .eq("account_id", accountID)
    .maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) return;

  const config = getDiscordConfig();
  const member = await getDiscordMember(config, result.data.discord_user_id);
  if (member && (member.roles ?? []).includes(config.roleID)) {
    await removeDiscordRole(config, result.data.discord_user_id);
  }
  const deleted = await admin.from("heater_discord_links").delete().eq("account_id", accountID);
  if (deleted.error) throw deleted.error;
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
  const bundleID = process.env.HEATERDEALS_BUNDLE_ID ?? "com.pulsedeals.app";
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

export async function requireActiveSubscription(admin: SupabaseClient, accountID: string): Promise<Membership> {
  const membership = await getMembership(admin, accountID);
  if (membership.tier === "none") throw new Error("Active subscription required");
  return membership;
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
    imageURL: typeof row.image_url === "string" ? row.image_url : null,
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

function emptyDealVoteSummary(): HeaterDealVoteSummary {
  return {
    goodVotes: 0,
    boughtVotes: 0,
    badVotes: 0,
    myVote: null,
    updatedAt: null,
  };
}

export async function getDealVoteSummaries(
  admin: SupabaseClient,
  accountID: string,
  asins: string[],
): Promise<Record<string, HeaterDealVoteSummary>> {
  const uniqueASINs = Array.from(
    new Set(asins.map((asin) => asin.trim().toUpperCase()).filter(Boolean)),
  ).slice(0, 50);
  const membership = await requireActiveSubscription(admin, accountID);
  const allowedQuery = admin.from("heater_deals").select("asin").in("asin", uniqueASINs);
  if (membership.tier !== "pro") allowedQuery.eq("marketplace", membership.primaryMarketplace ?? "unselected");
  const allowedResult = await allowedQuery;
  if (allowedResult.error) throw allowedResult.error;
  const allowed = new Set((allowedResult.data ?? []).map(row => row.asin));
  const accessibleASINs = uniqueASINs.filter(asin => allowed.has(asin));
  const summaries: Record<string, HeaterDealVoteSummary> = {};
  for (const asin of accessibleASINs) summaries[asin] = emptyDealVoteSummary();
  if (!accessibleASINs.length) return summaries;

  const result = await admin
    .from("heater_deal_votes")
    .select("account_id, asin, vote, updated_at")
    .in("asin", accessibleASINs);
  if (result.error) throw result.error;

  for (const row of (result.data ?? []) as Array<Record<string, unknown>>) {
    const asin = String(row.asin ?? "").toUpperCase();
    const summary = summaries[asin];
    const vote = row.vote as HeaterDealVote;
    if (!summary || !(HEATER_DEAL_VOTES as readonly string[]).includes(vote)) continue;

    switch (vote) {
      case "good": summary.goodVotes += 1; break;
      case "bought": summary.boughtVotes += 1; break;
      case "bad": summary.badVotes += 1; break;
    }
    if (String(row.account_id) === accountID) summary.myVote = vote;

    const updatedAt = row.updated_at ? String(row.updated_at) : null;
    if (updatedAt && (!summary.updatedAt || updatedAt > summary.updatedAt)) {
      summary.updatedAt = updatedAt;
    }
  }

  return summaries;
}

export async function submitDealVote(
  admin: SupabaseClient,
  accountID: string,
  asin: string,
  vote: HeaterDealVote,
): Promise<HeaterDealVoteSummary> {
  const normalizedASIN = asin.trim().toUpperCase();
  if (!/^[A-Z0-9]{6,32}$/.test(normalizedASIN)) throw new Error("Invalid deal ASIN");
  if (!(HEATER_DEAL_VOTES as readonly string[]).includes(vote)) throw new Error("Invalid deal vote");

  const membership = await requireActiveSubscription(admin, accountID);
  const dealQuery = admin
    .from("heater_deals")
    .select("asin")
    .eq("asin", normalizedASIN)
    .eq("status", "live")
    .limit(1);
  if (membership.tier !== "pro") dealQuery.eq("marketplace", membership.primaryMarketplace ?? "unselected");
  const deal = await dealQuery;
  if (deal.error) throw deal.error;
  if (!deal.data?.length) throw new Error("Deal not found");

  const updatedAt = new Date().toISOString();
  const result = await admin.from("heater_deal_votes").upsert({
    account_id: accountID,
    asin: normalizedASIN,
    vote,
    updated_at: updatedAt,
  }, { onConflict: "account_id,asin" });
  if (result.error) throw result.error;

  const summaries = await getDealVoteSummaries(admin, accountID, [normalizedASIN]);
  return summaries[normalizedASIN] ?? emptyDealVoteSummary();
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
  if (message === "Your membership includes your selected country") {
    return apiError(request, 403, "country_restricted", "Your membership includes one selected country. Pro includes multiple countries.");
  }
  if (message === "Invalid marketplace") return apiError(request, 422, "invalid_marketplace", "Choose a supported country.");
  if (message === "Active subscription required") {
    return apiError(request, 403, "subscription_required", "An active HeaterDeals subscription is required.");
  }
  if (message === "Invalid deal ASIN" || message === "Invalid deal vote") {
    return apiError(request, 422, "invalid_request", "Choose a valid vote for this deal.");
  }
  if (message === "Deal not found") {
    return apiError(request, 404, "deal_not_found", "This deal is no longer available.");
  }
  if (message === "A different Discord account is already linked" || message.includes("Discord account is already linked")) {
    return apiError(request, 409, "discord_account_conflict", "Disconnect the existing Discord account before linking another one.");
  }
  if (message === "Invalid or expired Discord link state") {
    return apiError(request, 400, "discord_link_expired", "This Discord link has expired. Start the link again.");
  }
  if (message.includes("Missing server configuration: HEATERDEALS_DISCORD")) {
    return apiError(request, 503, "discord_not_configured", "Discord linking is not configured yet.");
  }
  if (message.includes("Discord server access") || message.includes("Discord OAuth") || message.includes("Discord API") || message.includes("Discord access") || message.includes("Discord profile")) {
    return apiError(request, 502, "discord_unavailable", "Discord could not grant server access right now.");
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
