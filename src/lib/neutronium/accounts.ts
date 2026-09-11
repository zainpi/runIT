import { cookies } from "next/headers";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { postgres } from "./postgres";
import { hashPassword, verifyPassword } from "./passwords";
import { DomainError } from "./model";
import { emailConfigured, sendEmail } from "./email";
import { safeAuthReturn } from "./onboarding-link";
const sessionCookie = "neutronium_session";
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/neutronium",
};
export async function currentSessionHash() {
  return digest((await cookies()).get(sessionCookie)?.value || "");
}
export async function currentUser() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) return null;
  const { rows } = await postgres().query(
    "select u.id,u.email,u.signup_role,s.mfa_verified_at,coalesce(m.enabled,false) as mfa_enabled,(coalesce(m.enabled,false) or exists(select 1 from neutronium_memberships mm where mm.user_id=u.id and mm.active and mm.role in ('ORG_OWNER','ORG_ADMIN','HR_ADMIN')) or exists(select 1 from neutronium_platform_members pm where pm.user_id=u.id)) as mfa_required from neutronium_users u join neutronium_sessions s on s.user_id=u.id left join neutronium_mfa m on m.user_id=u.id where s.token_hash=$1 and s.expires_at>now() and u.verified",
    [digest(token)],
  );
  return rows[0] || null;
}
export async function issueSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await postgres().query(
    "insert into neutronium_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '8 hours')",
    [digest(token), userId],
  );
  (await cookies()).set(sessionCookie, token, {
    ...cookieOptions,
    maxAge: 8 * 3600,
  });
}
export async function endSession() {
  const jar = await cookies();
  const token = jar.get(sessionCookie)?.value;
  if (token)
    await postgres().query(
      "delete from neutronium_sessions where token_hash=$1",
      [digest(token)],
    );
  jar.set(sessionCookie, "", { ...cookieOptions, maxAge: 0 });
}
export async function sendLink(
  userId: string,
  email: string,
  kind: "signup" | "invite",
  returnTo?: string,
) {
  const from = process.env.NEUTRONIUM_EMAIL_FROM;
  const origin = process.env.NEUTRONIUM_APP_URL;
  if (!emailConfigured() || !from || !origin)
    throw new DomainError(
      "Configure email delivery and NEUTRONIUM_APP_URL before creating accounts.",
      503,
    );
  const token = randomBytes(32).toString("base64url");
  await postgres().query(
    "insert into neutronium_auth_tokens(token_hash,user_id,kind,expires_at,return_to) values($1,$2,$3,now()+interval '24 hours',$4)",
    [digest(token), userId, kind, safeAuthReturn(returnTo)],
  );
  const link = new URL("/neutronium/api/auth/confirm/", origin);
  link.searchParams.set("token_hash", token);
  link.searchParams.set("type", kind);
  try {
    await sendEmail({
      from,
      to: [email],
      subject:
        kind === "invite"
          ? "You’re invited to Neutronium"
          : "Confirm your Neutronium account",
      text: `${kind === "invite" ? "Open this link to accept your invitation and sign in. You can set your password in My profile." : "Open this link to confirm your email and continue to Neutronium. Your password is the one you chose when creating your account."} This link expires in 24 hours and can be used once.\n\n${link}`,
    });
  } catch (error) {
    await postgres().query(
      "delete from neutronium_auth_tokens where token_hash=$1",
      [digest(token)],
    );
    if (error instanceof DomainError) throw error;
    throw new DomainError(
      "Authentication email could not be sent. Please retry.",
      503,
    );
  }
}
export async function inviteAccount(email: string) {
  const { rows } = await postgres().query(
    "insert into neutronium_users(id,email) values($1,$2) on conflict(email) do update set email=excluded.email returning id,email,verified",
    [randomUUID(), email.toLowerCase()],
  );
  // Existing users sign in normally; invitations must not become password-reset links.
  if (!rows[0].verified) {
    await postgres().query(
      "update neutronium_users set password_hash=null where id=$1 and not verified",
      [rows[0].id],
    );
    await sendLink(rows[0].id, rows[0].email, "invite");
  }
  return rows[0];
}
export async function accountById(id: string) {
  return (
    (
      await postgres().query(
        "select id,email from neutronium_users where id=$1 and verified",
        [id],
      )
    ).rows[0] || null
  );
}
export async function accountAuth() {
  return {
    auth: {
      getUser: async () => ({ data: { user: await currentUser() } }),
      signOut: endSession,
      async signUp({
        email,
        password,
        signupRole = "employee",
        returnTo,
      }: {
        email: string;
        password: string;
        signupRole?: string;
        returnTo?: string;
      }) {
        email = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
          throw new DomainError("Enter a valid email.");
        const hash = await hashPassword(password);
        const { rows } = await postgres().query(
          "insert into neutronium_users(id,email,password_hash,signup_role) values($1,$2,$3,$4) on conflict(email) do nothing returning id",
          [
            randomUUID(),
            email,
            hash,
            signupRole === "admin" ? "admin" : "employee",
          ],
        );
        // Retrying failed delivery preserves the original password.
        const user =
          rows[0] ||
          (
            await postgres().query(
              "select id from neutronium_users where email=$1 and not verified",
              [email],
            )
          ).rows[0];
        if (!user) {
          const existing = (
            await postgres().query(
              "select password_hash from neutronium_users where email=$1 and verified",
              [email],
            )
          ).rows[0];
          if (
            existing &&
            (await verifyPassword(password, existing.password_hash))
          )
            return {
              data: { session: null, existingAccount: true },
              error: null,
            };
        }
        if (user) await sendLink(user.id, email, "signup", returnTo);
        return { data: { session: null }, error: null };
      },
      async signInWithPassword({
        email,
        password,
      }: {
        email: string;
        password: string;
      }) {
        const user = (
          await postgres().query(
            "select * from neutronium_users where email=$1",
            [email.trim().toLowerCase()],
          )
        ).rows[0];
        if (
          !(await verifyPassword(password, user?.password_hash || null)) ||
          !user?.verified
        )
          return { data: { session: null }, error: true };
        await issueSession(user.id);
        return { data: { session: true }, error: null };
      },
      async verifyOtp({
        token_hash,
        type,
      }: {
        token_hash: string;
        type: string;
      }) {
        const client = await postgres().connect();
        let userId: string;
        let returnTo: string;
        try {
          await client.query("begin");
          const { rows } = await client.query(
            "delete from neutronium_auth_tokens where token_hash=$1 and kind=$2 and expires_at>now() returning user_id,return_to",
            [digest(token_hash), type],
          );
          if (!rows[0]) {
            await client.query("rollback");
            return { error: true };
          }
          userId = rows[0].user_id;
          returnTo = safeAuthReturn(rows[0].return_to);
          await client.query(
            "update neutronium_users set verified=true where id=$1",
            [userId],
          );
          await client.query(
            "delete from neutronium_auth_tokens where user_id=$1",
            [userId],
          );
          await client.query("commit");
        } catch (error) {
          await client.query("rollback");
          throw error;
        } finally {
          client.release();
        }
        await issueSession(userId);
        return { error: null, returnTo };
      },
      async updateUser({ password }: { password: string }) {
        const user = await currentUser();
        if (!user) return { error: true };
        const hash = await hashPassword(password);
        const client = await postgres().connect();
        try {
          await client.query("begin");
          await client.query(
            "update neutronium_users set password_hash=$1 where id=$2",
            [hash, user.id],
          );
          await client.query(
            "delete from neutronium_sessions where user_id=$1",
            [user.id],
          );
          await client.query(
            "delete from neutronium_auth_tokens where user_id=$1",
            [user.id],
          );
          await client.query("commit");
        } catch (error) {
          await client.query("rollback");
          throw error;
        } finally {
          client.release();
        }
        await issueSession(user.id);
        return { error: null };
      },
    },
  };
}

export async function resendConfirmation(email: string, returnTo?: string) {
  email = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new DomainError("Enter a valid email address.");
  const user = (
    await postgres().query(
      "select id from neutronium_users where email=$1 and not verified",
      [email],
    )
  ).rows[0];
  if (user) await sendLink(user.id, email, "signup", returnTo);
}
