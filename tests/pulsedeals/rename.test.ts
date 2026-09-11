import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { NextRequest } from "next/server";
import { middleware } from "../../src/middleware";
import { getCronSecretHeader, getPulseDealsEnv } from "../../src/lib/pulsedeals/compatibility";
import { requireSession } from "../../src/lib/pulsedeals/server";

test("old API requests retain method, credentials, body and query; public links redirect", async () => {
  for (const [method, path] of [["POST", "billing/apple/transaction"], ["PUT", "alerts"], ["GET", "discord/callback"]]) {
    const request = new NextRequest(`https://runsit.ca/heaterdeals/api/v1/${path}/?state=example&code=test-code`, {
      method, headers: { authorization: "Bearer example" }, ...(method === "GET" ? {} : { body: '{"example":true}' }),
    });
    const response = await middleware(request);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("location"), null);
    assert.equal(response.headers.get("x-middleware-rewrite"), `https://runsit.ca/pulsedeals/api/v1/${path}/?state=example&code=test-code`);
    assert.equal(request.method, method);
    assert.equal(request.headers.get("authorization"), "Bearer example");
    if (method !== "GET") assert.equal(await request.text(), '{"example":true}');
  }
  for (const path of ["", "/", "/privacy", "/privacy.html", "/terms/", "/support/"]) {
    const response = await middleware(new NextRequest(`https://runsit.ca/heaterdeals${path}?from=bookmark`));
    assert.equal(response.status, 308);
    assert.equal(response.headers.get("location"), `https://runsit.ca/pulsedeals${path}?from=bookmark`);
  }
  const legal = await middleware(new NextRequest("https://runsit.ca/pulsedeals/privacy/"));
  assert.equal(legal.headers.get("x-middleware-rewrite"), "https://runsit.ca/pulsedeals/privacy.html");
  const api = await middleware(new NextRequest("https://runsit.ca/pulsedeals/api/v1/feed/"));
  assert.equal(api.headers.get("x-middleware-next"), "1");
  assert.equal(api.headers.get("set-cookie"), null);
});

test("configured secrets and cron callers can transition independently", () => {
  assert.equal(getPulseDealsEnv("PULSEDEALS_CRON_SECRET", { HEATERDEALS_CRON_SECRET: "old" }), "old");
  assert.equal(getPulseDealsEnv("PULSEDEALS_CRON_SECRET", { HEATERDEALS_CRON_SECRET: "old", PULSEDEALS_CRON_SECRET: "new" }), "new");
  assert.equal(getPulseDealsEnv("PULSEDEALS_PUSH_ENABLED", { HEATERDEALS_PUSH_ENABLED: "true", PULSEDEALS_PUSH_ENABLED: "false" }), "false");
  assert.equal(getPulseDealsEnv("PULSEDEALS_SESSION_SECRET", {}), undefined);
  assert.equal(getCronSecretHeader(new Headers({ "x-heater-cron-secret": "old" })), "old");
  assert.equal(getCronSecretHeader(new Headers({ "x-heater-cron-secret": "old", "x-pulsedeals-cron-secret": "new" })), "new");
});

test("previously issued sessions still verify; renamed sessions reject expiry and bad signatures", async () => {
  const names = ["PULSEDEALS_SESSION_SECRET", "HEATERDEALS_SESSION_SECRET"];
  const previous = names.map(name => process.env[name]);
  const secret = "local-test-secret-only-not-a-real-credential";
  try {
    delete process.env.PULSEDEALS_SESSION_SECRET;
    process.env.HEATERDEALS_SESSION_SECRET = secret;
    const session = (typ: string, expires = Date.now() / 1000 + 600, key = secret) => {
      const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
      const claims = Buffer.from(JSON.stringify({ sub: "existing-account", iat: 0, exp: expires, typ })).toString("base64url");
      const value = `${header}.${claims}`;
      const signature = createHmac("sha256", key).update(value).digest("base64url");
      return new Request("https://runsit.ca/pulsedeals/api/v1/feed", { headers: { authorization: `Bearer ${value}.${signature}` } });
    };
    assert.equal((await requireSession(session("heater-session"))).sub, "existing-account");
    process.env.PULSEDEALS_SESSION_SECRET = secret;
    assert.equal((await requireSession(session("pulsedeals-session"))).sub, "existing-account");
    await assert.rejects(requireSession(session("unknown-session")), /Invalid session/);
    await assert.rejects(requireSession(session("heater-session", 0)), /Expired session/);
    await assert.rejects(requireSession(session("pulsedeals-session", Date.now() / 1000 + 600, "wrong")), /Expired session/);
  } finally {
    names.forEach((name, i) => { if (previous[i] === undefined) delete process.env[name]; else process.env[name] = previous[i]; });
  }
});

test("database upgrade retains every table and row, RPC behavior, RLS and purchase identity", async () => {
  const db = new PGlite();
  const migrate = async (file: string) => db.exec((await readFile(`supabase/migrations/${file}`, "utf8")).replace("create extension if not exists pgcrypto;", ""));
  try {
    await db.exec("create role anon; create role authenticated; create role service_role;");
    for (const file of ["20260807160000_heaterdeals_backend.sql", "20260904000000_heaterdeals_discord.sql", "20260904010000_heaterdeals_votes.sql", "20260910000000_heaterdeals_push.sql", "20260910010000_heaterdeals_memberships.sql"]) await migrate(file);
    await db.exec(`
      insert into heater_accounts(id,apple_sub,app_account_token,primary_marketplace)
        values ('11111111-1111-1111-1111-111111111111','existing-apple-user','22222222-2222-4222-8222-222222222222','de');
      insert into heater_entitlements(account_id,product_id,original_transaction_id,transaction_id,app_account_token,environment,expires_at)
        select id,'com.pulsedeals.subscription.weekly','original-purchase','current-purchase',app_account_token,'Sandbox',now()+interval '7 days' from heater_accounts;
      insert into heater_discord_links(account_id,discord_user_id,username,guild_id,has_access_role) select id,'discord-id','member','guild',true from heater_accounts;
      insert into heater_refresh_tokens(account_id,token_hash,expires_at) select id,'existing-hash',now()+interval '1 day' from heater_accounts;
      insert into heater_alerts(account_id,name,marketplace) select id,'Saved alert','de' from heater_accounts;
      insert into heater_push_devices(account_id,token,environment) select id,'existing-device-token','sandbox' from heater_accounts;
      insert into heater_deals(asin,marketplace,title,current_price,reference_price,score) values ('B09XS7JWHH','de','Headphones',25,100,90);
      insert into heater_deal_snapshots(deal_id,current_price) select id,current_price from heater_deals;
      insert into heater_deal_votes(account_id,asin,vote) select id,'B09XS7JWHH','good' from heater_accounts;
      select enqueue_heater_push_matches('de','ignored');
      select claim_heater_idempotency('11111111-1111-1111-1111-111111111111','alerts','existing-key');
      select claim_heater_sync_lock('de',60);
    `);
    const tables = (await db.query<{ oid: number; relname: string }>("select oid,relname from pg_class where relnamespace='public'::regnamespace and relkind='r' and relname ~ '^heater_' order by relname")).rows;
    const contents = new Map<string, unknown>();
    for (const table of tables) contents.set(table.relname, (await db.query(`select * from ${table.relname} order by 1`)).rows);
    await migrate("20260910020000_pulsedeals_rename.sql");
    for (const table of tables) {
      const name = table.relname.replace(/^heater_/, "pulsedeals_");
      const metadata = (await db.query<{ oid: number; relname: string; relrowsecurity: boolean }>("select oid,relname,relrowsecurity from pg_class where oid=$1", [table.oid])).rows[0];
      assert.equal(metadata.relname, name);
      assert.equal(metadata.relrowsecurity, true);
      assert.deepEqual((await db.query(`select * from ${name} order by 1`)).rows, contents.get(table.relname));
      assert.equal((await db.query<{ allowed: boolean }>("select has_table_privilege('anon',$1,'SELECT') allowed", [name])).rows[0].allowed, false);
      assert.equal((await db.query<{ allowed: boolean }>("select has_table_privilege('service_role',$1,'SELECT,INSERT,UPDATE,DELETE') allowed", [name])).rows[0].allowed, true);
    }
    assert.equal((await db.query("select oid from pg_class where relnamespace='public'::regnamespace and relname ~ '^heater_'")).rows.length, 0);
    assert.equal((await db.query("select oid from pg_constraint where connamespace='public'::regnamespace and conname ~ '^heater_'")).rows.length, 0);
    const functions = (await db.query<{ oid: number; body: string }>("select oid,pg_get_functiondef(oid) body from pg_proc where pronamespace='public'::regnamespace and proname ~ '(^|_)pulsedeals_'")).rows;
    assert.equal(functions.length, 9);
    for (const fn of functions) {
      assert.doesNotMatch(fn.body, /heater_/);
      assert.equal((await db.query<{ allowed: boolean }>("select has_function_privilege('anon',$1::oid,'EXECUTE') allowed", [fn.oid])).rows[0].allowed, false);
      assert.equal((await db.query<{ allowed: boolean }>("select has_function_privilege('service_role',$1::oid,'EXECUTE') allowed", [fn.oid])).rows[0].allowed, true);
    }
    assert.equal((await db.query<{ tier: string }>("select * from pulsedeals_membership('11111111-1111-1111-1111-111111111111')")).rows[0].tier, "standard");
    assert.equal((await db.query<{ value: boolean }>("select claim_pulsedeals_idempotency('11111111-1111-1111-1111-111111111111','alerts','existing-key') value")).rows[0].value, false);
    assert.equal((await db.query<{ value: boolean }>("select claim_pulsedeals_sync_lock('de',60) value")).rows[0].value, false);
    await db.exec("select release_pulsedeals_sync_lock('de');");
    assert.equal((await db.query<{ value: boolean }>("select claim_pulsedeals_sync_lock('de',60) value")).rows[0].value, true);
    assert.equal((await db.query<{ allowed: boolean }>("select * from consume_pulsedeals_rate_limit('test',1,60)")).rows[0].allowed, true);
    assert.equal((await db.query<{ allowed: boolean }>("select * from consume_pulsedeals_rate_limit('test',1,60)")).rows[0].allowed, false);
    assert.equal((await db.query("select * from claim_pulsedeals_push_deliveries(5)")).rows.length, 1);
    await db.exec("insert into pulsedeals_deal_snapshots(deal_id,current_price) select id,20 from pulsedeals_deals;");
    assert.equal((await db.query("select distinct id from pulsedeals_deal_snapshots")).rows.length, 2);
    await db.exec("delete from pulsedeals_accounts;");
    assert.equal((await db.query("select * from pulsedeals_push_deliveries")).rows.length, 0);
  } finally { await db.close(); }
});
