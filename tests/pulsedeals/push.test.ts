import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { stillMatches } from "../../scripts/pulsedeals/dispatch";

test("delivery rechecks ownership, pauses, price, market, keyword, Prime and subscription", () => {
  const delivery = { account_id: "a", price: 25, expires_at: "2030-01-01T00:00:00Z" };
  const device = { account_id: "a", enabled: true };
  const rule = { account_id: "a", is_enabled: true, marketplace: "de", categories: ["tech"],
    min_discount: 50, min_heat: 70, min_price: 20, max_price: 30, prime_only: true, keyword: "sony headphones" };
  const deal = { title: "Sony wireless Headphones", asin: "B09XS7JWHH", category: "tech", marketplace: "de",
    current_price: 25, reference_price: 100, score: 95, status: "live", is_prime: true };
  assert.equal(stillMatches(delivery, device, rule, deal, true), true);
  assert.equal(stillMatches(delivery, device, rule, deal, false), false);
  for (const patch of [{ account_id: "b" }, { enabled: false }]) assert.equal(stillMatches(delivery, { ...device, ...patch }, rule, deal, true), false);
  for (const patch of [{ is_enabled: false }, { max_price: 24 }, { min_price: 26 }, { min_discount: 80 },
    { min_heat: 99 }, { keyword: "bose" }, { categories: ["toys"] }, { account_id: "b" }]) {
    assert.equal(stillMatches(delivery, device, { ...rule, ...patch }, deal, true), false);
  }
  for (const patch of [{ current_price: 24 }, { status: "burnedOut" }, { marketplace: "uk" }, { is_prime: false }]) {
    assert.equal(stillMatches(delivery, device, rule, { ...deal, ...patch }, true), false);
  }
  assert.equal(stillMatches({ ...delivery, expires_at: "2020-01-01T00:00:00Z" }, device, rule, deal, true), false);
});

test("real queue migration: matching, deduplication, cadence, leases and account isolation", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role;");
    for (const file of ["20260807160000_heaterdeals_backend.sql", "20260904000000_heaterdeals_discord.sql", "20260904010000_heaterdeals_votes.sql", "20260910000000_heaterdeals_push.sql", "20260910010000_heaterdeals_memberships.sql", "20260910020000_pulsedeals_rename.sql"]) {
      await db.exec((await readFile(`supabase/migrations/${file}`, "utf8")).replace("create extension if not exists pgcrypto;", ""));
    }
    await db.exec(`
      insert into pulsedeals_accounts(id,apple_sub,app_account_token) values
        ('11111111-1111-1111-1111-111111111111','test',gen_random_uuid()),
        ('22222222-2222-2222-2222-222222222222','no-sub',gen_random_uuid());
      insert into pulsedeals_entitlements(account_id,product_id,original_transaction_id,environment,expires_at)
        values ('11111111-1111-1111-1111-111111111111','com.pulsedeals.subscription.pro.weekly','test-tx','Sandbox',now()+interval '1 day');
      insert into pulsedeals_push_devices(account_id,token,environment) select id,id::text,'sandbox' from pulsedeals_accounts;
      insert into pulsedeals_alerts(account_id,name,marketplace,categories,min_discount,min_heat,cadence,keyword,prime_only)
        select id,'Headphones','de',array['tech'],50,70,'instant','sony headphones',true from pulsedeals_accounts;
      insert into pulsedeals_deals(asin,marketplace,title,category,current_price,reference_price,score,is_prime) values
        ('B09XS7JWHH','de','Sony wireless headphones','tech',25,100,95,true),
        ('B09XS7JWHH','uk','Sony wireless headphones','tech',25,100,95,true),
        ('B09XS7JWHA','de','Sony wireless headphones','tech',80,100,95,true),
        ('B09XS7JWHB','de','Sony wireless headphones','tech',25,100,95,false),
        ('B09XS7JWHC','de','Other headphones','tech',25,100,95,true),
        ('B09XS7JWHD','de','Sony wireless headphones','tech',25,0,95,true);
    `);
    const enqueue = async () => (await db.query<{ count: number }>("select enqueue_pulsedeals_push_matches('de','com.pulsedeals.subscription.pro.weekly') count")).rows[0].count;
    assert.equal(await enqueue(), 1);
    assert.equal(await enqueue(), 0);
    await db.exec("insert into pulsedeals_alerts(account_id,name,marketplace,categories,min_discount,min_heat,keyword,prime_only) select account_id,'Duplicate','de',categories,min_discount,min_heat,keyword,prime_only from pulsedeals_alerts limit 1;");
    assert.equal(await enqueue(), 0);
    const firstClaim = await db.query("select * from claim_pulsedeals_push_deliveries(5)");
    assert.equal(firstClaim.rows.length, 1);
    assert.equal((await db.query("select * from claim_pulsedeals_push_deliveries(5)")).rows.length, 0);
    await db.exec("update pulsedeals_push_deliveries set lease_until=now()-interval '1 second';");
    const retry = await db.query<{ attempts: number; lease_token: string }>("select * from claim_pulsedeals_push_deliveries(5)");
    assert.equal(retry.rows[0].attempts, 2);
    assert.notEqual(retry.rows[0].lease_token, (firstClaim.rows[0] as any).lease_token);
    // A lower price is a new event. Non-instant rules hold it until their window elapses.
    await db.exec("update pulsedeals_alerts set cadence='digest'; update pulsedeals_deals set current_price=20 where asin='B09XS7JWHH' and marketplace='de'; delete from pulsedeals_alerts where name='Duplicate';");
    assert.equal(await enqueue(), 0);
    await db.exec("update pulsedeals_push_deliveries set created_at=now()-interval '25 hours';");
    assert.equal(await enqueue(), 1);
    const payload = (await db.query<{ payload: any }>("select payload from pulsedeals_push_deliveries limit 1")).rows[0].payload;
    assert.equal(payload.asin, "B09XS7JWHH"); assert.equal(payload.aps.category, "PULSE_DEAL");
    assert.equal(payload.marketplace, "de"); assert.ok(payload.expiresAt.endsWith("Z"));
    await db.exec("delete from pulsedeals_accounts where apple_sub='test';");
    assert.equal((await db.query("select * from pulsedeals_push_deliveries")).rows.length, 0);
  } finally { await db.close(); }
});
