import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { paidDiscordTier } from "../../src/lib/heaterdeals/server";

const account = "11111111-1111-1111-1111-111111111111";
const other = "22222222-2222-2222-2222-222222222222";
async function database() {
  const db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role;");
  for (const file of ["20260807160000_heaterdeals_backend.sql", "20260904000000_heaterdeals_discord.sql", "20260910000000_heaterdeals_push.sql", "20260910010000_heaterdeals_memberships.sql"]) {
    await db.exec((await readFile(`supabase/migrations/${file}`, "utf8")).replace("create extension if not exists pgcrypto;", ""));
  }
  await db.query("insert into heater_accounts(id,apple_sub,app_account_token) values ($1,'member',$1),($2,'other',$2)", [account, other]);
  return db;
}
function transaction(patch = {}) {
  return { productId: "com.pulsedeals.subscription.weekly", originalTransactionId: "original", transactionId: "first", appAccountToken: account,
    environment: "Sandbox", expiresDate: Date.now()+604_800_000, signedDate: 1000, ...patch };
}
async function record(db: PGlite, payload: object, status = "active", owner = account) {
  await db.query("select record_heater_apple_entitlement($1,$2::jsonb,$3)", [owner, JSON.stringify(payload), status]);
}
async function membership(db: PGlite, owner = account) {
  return (await db.query<{ tier: string; source: string; primary_marketplace: string | null }>("select * from heater_membership($1)", [owner])).rows[0];
}

test("paid Discord roles are distinct from free app access and membership screening", () => {
  const names = ["HEATERDEALS_DISCORD_ROLE_ID", "HEATERDEALS_DISCORD_PAID_ROLE_ID", "HEATERDEALS_DISCORD_PRO_ROLE_ID"];
  const previous = names.map(name => process.env[name]);
  try {
    ["app-access", "paid", "pro"].forEach((value, index) => { process.env[names[index]] = value; });
    assert.equal(paidDiscordTier(null), null);
    assert.equal(paidDiscordTier({ roles: ["app-access"] }), null);
    assert.equal(paidDiscordTier({ roles: ["paid"], pending: true }), null);
    assert.equal(paidDiscordTier({ roles: ["paid"] }), "standard");
    assert.equal(paidDiscordTier({ roles: ["paid", "pro"] }), "pro");
    process.env.HEATERDEALS_DISCORD_PAID_ROLE_ID = "app-access";
    assert.equal(paidDiscordTier({ roles: ["app-access"] }), null);
  } finally { names.forEach((name, i) => { if (previous[i] === undefined) delete process.env[name]; else process.env[name] = previous[i]; }); }
});

test("weekly access locks one country, legacy preserves Pro, signed replay cannot undo revocation", async () => {
  const db = await database();
  try {
    assert.equal((await membership(db)).tier, "none");
    await assert.rejects(db.query("select claim_heater_marketplace($1,'ca')", [account]), /Active subscription/);
    await record(db, transaction());
    assert.equal((await membership(db)).tier, "standard");
    await db.query("select claim_heater_marketplace($1,'ca')", [account]);
    await db.query("select claim_heater_marketplace($1,'ca')", [account]);
    await assert.rejects(db.query("select claim_heater_marketplace($1,'us')", [account]), /selected country/);
    assert.equal((await membership(db)).primary_marketplace, "ca");
    assert.equal((await membership(db, other)).tier, "none");
    await assert.rejects(record(db, transaction(), "active", other), /another account/);
    await assert.rejects(record(db, transaction({ productId: "unconfigured-pro" })), /Invalid product/);
    // Same original transaction can change products inside the subscription group.
    await record(db, transaction({ productId: "com.pulsedeals.subscription.monthly", transactionId: "upgrade", signedDate: 2000 }));
    assert.equal((await membership(db)).tier, "pro");
    await record(db, transaction({ transactionId: "downgrade", signedDate: 3000 }));
    assert.equal((await membership(db)).tier, "standard");
    assert.equal((await membership(db)).primary_marketplace, "ca");
    await record(db, transaction({ transactionId: "downgrade", revocationDate: Date.now(), signedDate: 4000 }), "revoked");
    await record(db, transaction({ transactionId: "downgrade", signedDate: 3000 }));
    assert.equal((await membership(db)).tier, "none");
    await record(db, transaction({ transactionId: "expired", expiresDate: Date.now()-1000, signedDate: 5000 }), "active");
    assert.equal((await membership(db)).tier, "none");
  } finally { await db.close(); }
});

test("Discord grant expires or unlinks independently; queues enforce country for either payment source", async () => {
  const db = await database();
  try {
    await db.query(`insert into heater_discord_links(account_id,discord_user_id,username,guild_id,paid_tier,paid_access_expires_at)
      values ($1,'discord-member','member','guild','standard',now()+interval '10 minutes')`, [account]);
    assert.equal((await membership(db)).source, "discord");
    await db.query("select claim_heater_marketplace($1,'ca')", [account]);
    await db.query("insert into heater_push_devices(account_id,token,environment) values ($1,'test','sandbox')", [account]);
    await db.query(`insert into heater_alerts(account_id,name,marketplace,min_discount,min_heat)
      values ($1,'Local','ca',0,0),($1,'Other country','us',0,0)`, [account]);
    await db.exec(`insert into heater_deals(asin,marketplace,title,category,current_price,reference_price,score) values
      ('B09XS7JWHH','ca','Home essential','home',10,50,90),('B09XS7JWHH','us','Home essential','home',10,50,90);`);
    const enqueue = async (market: string) => (await db.query<{ n: number }>("select enqueue_heater_push_matches($1,'ignored') n", [market])).rows[0].n;
    assert.equal(await enqueue("ca"), 1);
    assert.equal(await enqueue("us"), 0);
    await db.exec("update heater_discord_links set paid_tier='pro'");
    assert.equal((await membership(db)).tier, "pro");
    assert.equal(await enqueue("us"), 1);
    await db.exec("update heater_discord_links set paid_access_expires_at=now()-interval '1 second'");
    assert.equal((await membership(db)).tier, "none");
    await db.exec("update heater_deals set current_price=9");
    assert.equal(await enqueue("ca"), 0);
    // Losing Discord access never cancels a valid Apple subscription.
    await record(db, transaction());
    assert.equal((await membership(db)).source, "apple");
    await db.exec("delete from heater_discord_links");
    assert.equal((await membership(db)).tier, "standard");
    assert.equal(await enqueue("ca"), 1);
    assert.equal(await enqueue("us"), 0);
    await db.exec("update heater_entitlements set status='revoked'");
    assert.equal((await membership(db)).tier, "none");
  } finally { await db.close(); }
});
