import { cookies } from "next/headers";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createRemoteJWKSet } from "jose";
import { verifyIdentityToken } from "./identity-token";
import { postgres } from "./postgres";
import { currentUser, issueSession, sendLink } from "./accounts";
import { DomainError } from "./model";
const hash = (v: string) => createHash("sha256").update(v).digest("base64url");
const cookie = "neutronium_oauth";
function provider(name: string) {
  if (!["google", "microsoft"].includes(name))
    throw new DomainError("Unknown sign-in provider.");
  const prefix = `NEUTRONIUM_${name.toUpperCase()}_LOGIN_`;
  const clientId = process.env[`${prefix}CLIENT_ID`];
  const secret = process.env[`${prefix}CLIENT_SECRET`];
  if (!clientId || !secret)
    throw new DomainError(`${name} sign-in is not configured.`, 503);
  const tenant = process.env.NEUTRONIUM_MICROSOFT_LOGIN_TENANT_ID || "";
  if (
    name === "microsoft" &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      tenant,
    )
  )
    throw new DomainError("Configure the Microsoft sign-in tenant ID.", 503);
  return name === "google"
    ? {
        clientId,
        secret,
        issuer: "https://accounts.google.com",
        authorize: "https://accounts.google.com/o/oauth2/v2/auth",
        token: "https://oauth2.googleapis.com/token",
        jwks: "https://www.googleapis.com/oauth2/v3/certs",
      }
    : {
        clientId,
        secret,
        issuer: `https://login.microsoftonline.com/${tenant}/v2.0`,
        authorize: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
        token: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
        jwks: `https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`,
      };
}
export function socialProviders() {
  return ["google", "microsoft"].filter((name) => {
    try {
      provider(name);
      return true;
    } catch {
      return false;
    }
  });
}
export async function startSocial(name: string, origin: string, role: string) {
  const p = provider(name);
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const user = await currentUser();
  await postgres().query(
    "insert into neutronium_login_states values($1,$2,$3,$4,$5,$6,now()+interval '10 minutes')",
    [
      hash(state),
      verifier,
      nonce,
      name,
      role === "admin" ? "admin" : "employee",
      user?.id || null,
    ],
  );
  (await cookies()).set(cookie, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/neutronium",
    maxAge: 600,
  });
  const url = new URL(p.authorize);
  url.search = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: `${origin}/neutronium/api/auth/social/${name}/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: hash(verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return url.toString();
}
export async function finishSocial(
  name: string,
  origin: string,
  state: string,
  code: string,
) {
  const jar = await cookies();
  if (!state || jar.get(cookie)?.value !== state)
    throw new DomainError("Sign-in request expired. Try again.", 403);
  jar.delete(cookie);
  const saved = (
    await postgres().query(
      "delete from neutronium_login_states where id=$1 and provider=$2 and expires_at>now() returning *",
      [hash(state), name],
    )
  ).rows[0];
  if (!saved || !code)
    throw new DomainError("Sign-in was cancelled or expired.", 403);
  const p = provider(name);
  const response = await fetch(p.token, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: p.clientId,
      client_secret: p.secret,
      redirect_uri: `${origin}/neutronium/api/auth/social/${name}/callback`,
      code_verifier: saved.verifier,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new DomainError("Provider sign-in failed.", 401);
  const token = await response.json();
  const payload = await verifyIdentityToken(
    token.id_token,
    createRemoteJWKSet(new URL(p.jwks)),
    { issuer: p.issuer, audience: p.clientId, nonce: saved.nonce },
  );
  const subject = `${payload.iss}|${payload.sub}`;
  const linked = (
    await postgres().query(
      "select u.id,u.verified,u.email from neutronium_users u join neutronium_social_identities i on i.user_id=u.id where i.provider=$1 and i.subject=$2",
      [name, subject],
    )
  ).rows[0];
  if (linked) {
    if (!linked.verified) {
      await sendLink(linked.id, linked.email, "signup");
      return "confirmation";
    }
    await issueSession(linked.id);
    return;
  }
  const email = String(payload.email || "")
    .trim()
    .toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new DomainError(
      "The provider did not share an email. Use email signup.",
    );
  const user = await currentUser();
  if (saved.link_user_id && user?.id !== saved.link_user_id)
    throw new DomainError("Sign in again before linking an account.", 403);
  const existing = (
    await postgres().query("select id from neutronium_users where email=$1", [
      email,
    ])
  ).rows[0];
  if (
    existing &&
    (!user || user.id !== existing.id || saved.link_user_id !== user.id)
  )
    throw new DomainError(
      "This email already has an account. Sign in with your password or invitation, then link this provider from your profile.",
      409,
    );
  if (user && user.email !== email)
    throw new DomainError(
      "Choose the provider account with your Neutronium email.",
      403,
    );
  const id = user?.id || randomUUID();
  const verified =
    !!user || (name === "google" && payload.email_verified === true);
  const client = await postgres().connect();
  try {
    await client.query("begin");
    if (!user)
      await client.query(
        "insert into neutronium_users(id,email,verified,signup_role) values($1,$2,$3,$4)",
        [id, email, verified, saved.signup_role],
      );
    await client.query(
      "insert into neutronium_social_identities values($1,$2,$3)",
      [name, subject, id],
    );
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
  if (!verified) {
    await sendLink(id, email, "signup");
    return "confirmation";
  }
  await issueSession(id);
}
