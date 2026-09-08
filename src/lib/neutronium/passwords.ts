import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (err, key) => err ? reject(err) : resolve(key)));
}
export async function hashPassword(password: string) {
  if (password.length < 12 || password.length > 128) throw new Error("Use a password between 12 and 128 characters.");
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await derive(password, salt)).toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string | null) {
  if (password.length > 128) return false;
  const [salt, hash] = (encoded || `${"0".repeat(32)}:${"0".repeat(128)}`).split(":");
  const derived = await derive(password, salt);
  const expected = Buffer.from(hash, "hex");
  return !!encoded && derived.length === expected.length && timingSafeEqual(derived, expected);
}
