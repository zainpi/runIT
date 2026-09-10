import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { TOTP } from "otpauth";
import { uid } from "../../src/lib/neutronium/model";
import { encrypt } from "../../src/lib/neutronium/providers";
import { verifyMfaSession } from "../../src/lib/neutronium/mfa";
test("MFA enrollment, replay denial, single-use recovery and session revocation are atomic", async () => {
  const db = new PGlite();
  try {
    for (const f of [
      "001_initial.sql",
      "002_social_auth.sql",
      "003_pilot.sql",
      "004_mfa.sql",
    ])
      await db.exec(
        await readFile(`deploy/neutronium/migrations/${f}`, "utf8"),
      );
    process.env.NEUTRONIUM_ENCRYPTION_KEYS = JSON.stringify({
      v1: Buffer.alloc(32, 7).toString("base64"),
    });
    const id = uid(),
      secret = "JBSWY3DPEHPK3PXP",
      encrypted = encrypt(secret, id);
    await db.query(
      "insert into neutronium_users(id,email,verified) values($1,'mfa@example.test',true)",
      [id],
    );
    await db.query(
      "insert into neutronium_sessions(token_hash,user_id,expires_at) values('current',$1,now()+interval '1 hour'),('other',$1,now()+interval '1 hour')",
      [id],
    );
    await db.query(
      "insert into neutronium_mfa(user_id,ciphertext,key_version,pending_until) values($1,$2,$3,now()+interval '10 minutes')",
      [id, encrypted.ciphertext, encrypted.key_version],
    );
    const client = {
      query: async (sql: string, values?: any[]) => {
        const r = await db.query(sql, values);
        return { rows: r.rows, rowCount: r.affectedRows ?? r.rows.length };
      },
    };
    const token = new TOTP({ secret }).generate();
    const enrolled = await verifyMfaSession(client, id, "current", token);
    assert.equal(enrolled.recoveryCodes?.length, 10);
    await assert.rejects(
      verifyMfaSession(client, id, "other", token),
      /already used/,
    );
    const codes = enrolled.recoveryCodes!;
    await verifyMfaSession(client, id, "current", codes[0]);
    assert.equal(
      (await db.query("select * from neutronium_sessions")).rows.length,
      1,
    );
    await assert.rejects(
      verifyMfaSession(client, id, "current", codes[0]),
      /invalid/,
    );
    const stored = (await db.query("select * from neutronium_mfa"))
      .rows[0] as any;
    assert(!JSON.stringify(stored).includes(codes[0]));
    assert.equal(stored.recovery_hashes.length, 9);
    assert.equal(
      (await db.query("select * from neutronium_account_audit")).rows.length,
      2,
    );
    const dump = await db.dumpDataDir();
    const restored = new PGlite({ loadDataDir: dump });
    try {
      assert.equal(
        (await restored.query("select * from neutronium_account_audit")).rows
          .length,
        2,
      );
      assert.equal(
        (await restored.query("select * from neutronium_mfa")).rows.length,
        1,
      );
    } finally {
      await restored.close();
    }
  } finally {
    await db.close();
  }
});
