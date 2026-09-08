// Run inside the app container. Prints credentials only to the operator's terminal.
// Redirect output into a chmod-600 file rather than deployment logs.
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import pg from 'pg';
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Pass the owner email');
const password = randomBytes(24).toString('base64url');
const salt = randomBytes(16).toString('hex');
const hash = `${salt}:${scryptSync(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('hex')}`;
const db = new pg.Client({ connectionString: process.env.NEUTRONIUM_DATABASE_URL });
await db.connect();
try {
  const result = await db.query('insert into neutronium_users(id,email,password_hash,verified) values($1,$2,$3,true) on conflict(email) do nothing returning id', [randomUUID(), email, hash]);
  if (!result.rowCount) throw new Error('Account already exists; no credentials changed');
  console.log(`URL: ${process.env.NEUTRONIUM_APP_URL}/neutronium/\nEmail: ${email}\nPassword: ${password}\nSign in, create your organization, then change the password in My profile.`);
} finally { await db.end(); }
