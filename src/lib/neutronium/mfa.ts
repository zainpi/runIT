import { TOTP, Secret } from "otpauth";
import { randomBytes, createHash } from "node:crypto";
import { postgres } from "./postgres";
import { encrypt, decrypt } from "./providers";
import { DomainError } from "./model";
import { currentUser, currentSessionHash } from "./accounts";
import { rateLimit } from "./auth";
export function validateTotp(
  secret: string,
  token: string,
  lastCounter: number,
  timestamp = Date.now(),
) {
  if (!/^\d{6}$/.test(token)) return null;
  const totp = new TOTP({
    secret: Secret.fromBase32(secret),
    issuer: "Neutronium",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });
  const delta = totp.validate({ token, window: 1, timestamp });
  const counter = Math.floor(timestamp / 30000) + (delta || 0);
  return delta !== null && counter > lastCounter ? counter : null;
}
export const recoveryDigest = (value: string) =>
  createHash("sha256").update(value.trim()).digest("hex");
export async function mfaStatus() {
  const user = await currentUser();
  if (!user) throw new DomainError("Sign in first.", 401);
  return {
    enabled: user.mfa_enabled === true,
    verified: !!user.mfa_verified_at,
    required: user.mfa_required === true,
  };
}
export async function enrollMfa() {
  const user = await currentUser();
  if (!user) throw new DomainError("Sign in first.", 401);
  await rateLimit(`mfa-enroll:${user.id}`, 5, 3600);
  const secret = new Secret({ size: 20 });
  const secured = encrypt(secret.base32, user.id);
  const result = await postgres().query(
    "insert into neutronium_mfa(user_id,ciphertext,key_version,pending_until) values($1,$2,$3,now()+interval '10 minutes') on conflict(user_id) do update set ciphertext=excluded.ciphertext,key_version=excluded.key_version,pending_until=excluded.pending_until where not neutronium_mfa.enabled returning user_id",
    [user.id, secured.ciphertext, secured.key_version],
  );
  if (!result.rowCount) throw new DomainError("MFA is already enrolled.");
  return {
    secret: secret.base32,
    uri: new TOTP({
      issuer: "Neutronium",
      label: user.email,
      secret,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
    }).toString(),
  };
}
export async function challengeMfa(token: string) {
  const user = await currentUser();
  if (!user) throw new DomainError("Sign in first.", 401);
  await rateLimit(`mfa:${user.id}`, 5, 300);
  const sessionHash = await currentSessionHash();
  const client = await postgres().connect();
  try {
    return await verifyMfaSession(client, user.id, sessionHash, token);
  } finally {
    client.release();
  }
}
export async function verifyMfaSession(
  client: {
    query: (
      sql: string,
      values?: any[],
    ) => Promise<{ rows: any[]; rowCount: number | null }>;
  },
  userId: string,
  sessionHash: string,
  token: string,
) {
  try {
    await client.query("begin");
    const row = (
      await client.query(
        "select * from neutronium_mfa where user_id=$1 for update",
        [userId],
      )
    ).rows[0];
    if (!row || (!row.enabled && Date.parse(row.pending_until) < Date.now()))
      throw new DomainError("Start MFA enrollment again.");
    const hashes: string[] = row.recovery_hashes;
    const hash = recoveryDigest(token);
    const recovery = row.enabled && hashes.includes(hash);
    const counter = recovery
      ? null
      : validateTotp(
          decrypt(row.ciphertext, row.key_version, userId),
          token,
          Number(row.last_counter),
        );
    if (!recovery && counter === null)
      throw new DomainError("Code is invalid, expired or already used.", 401);
    let codes: string[] | undefined;
    if (!row.enabled)
      codes = Array.from({ length: 10 }, () => randomBytes(16).toString("hex"));
    await client.query(
      "update neutronium_mfa set enabled=true,last_counter=$2,recovery_hashes=$3,pending_until=null where user_id=$1",
      [
        userId,
        counter ?? row.last_counter,
        JSON.stringify(
          codes
            ? codes.map(recoveryDigest)
            : recovery
              ? hashes.filter((h) => h !== hash)
              : hashes,
        ),
      ],
    );
    if (recovery)
      await client.query(
        "delete from neutronium_sessions where user_id=$1 and token_hash<>$2",
        [userId, sessionHash],
      );
    const verified = await client.query(
      "update neutronium_sessions set mfa_verified_at=now() where user_id=$1 and token_hash=$2 and expires_at>now()",
      [userId, sessionHash],
    );
    if (!verified.rowCount) throw new DomainError("Session expired.", 401);
    await client.query(
      "insert into neutronium_account_audit(user_id,action) values($1,$2)",
      [
        userId,
        !row.enabled
          ? "MFA enrolled"
          : recovery
            ? "MFA recovery code used; other sessions revoked"
            : "MFA challenge completed",
      ],
    );
    await client.query("commit");
    return { ok: true, recoveryCodes: codes };
  } catch (e) {
    await client.query("rollback");
    throw e;
  }
}
export async function listSessions() {
  const user = await currentUser();
  if (!user) throw new DomainError("Sign in first.", 401);
  if (user.mfa_required && !user.mfa_verified_at)
    throw new DomainError("Complete MFA first.", 403);
  const hash = await currentSessionHash();
  return (
    await postgres().query(
      "select id,created_at,expires_at,mfa_verified_at,(token_hash=$2) as current from neutronium_sessions where user_id=$1 and expires_at>now() order by created_at desc",
      [user.id, hash],
    )
  ).rows;
}
export async function revokeSession(id: string) {
  const user = await currentUser();
  if (!user) throw new DomainError("Sign in first.", 401);
  if (user.mfa_required && !user.mfa_verified_at)
    throw new DomainError("Complete MFA first.", 403);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw new DomainError("Invalid session.");
  await postgres().query(
    "delete from neutronium_sessions where user_id=$1 and id=$2",
    [user.id, id],
  );
  await postgres().query(
    "insert into neutronium_account_audit(user_id,action) values($1,'Session revoked')",
    [user.id],
  );
}
export async function resetMfa(token: string) {
  await challengeMfa(token);
  const user = await currentUser();
  if (!user) throw new DomainError("Sign in first.", 401);
  const client = await postgres().connect();
  try {
    await client.query("begin");
    await client.query("delete from neutronium_mfa where user_id=$1", [
      user.id,
    ]);
    await client.query("delete from neutronium_sessions where user_id=$1", [
      user.id,
    ]);
    await client.query(
      "insert into neutronium_account_audit(user_id,action) values($1,'MFA reset with fresh second factor; all sessions revoked')",
      [user.id],
    );
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
