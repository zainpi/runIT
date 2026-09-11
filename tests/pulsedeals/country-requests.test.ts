import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHmac } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { normalizeRequestedCountry } from "../../src/lib/pulsedeals/country-requests";
import { POST } from "../../src/app/pulsedeals/api/v1/country-requests/route";

test("requests accept future countries and reject live or invalid country codes", () => {
  for (const code of ["CA", "US", "NL", "BE", "AU", "IN"]) assert.equal(normalizeRequestedCountry(` ${code.toLowerCase()} `), code);
  for (const code of [null, {}, [], "", "ZZ", "EU", "USA", "DE", "UK", "GB", "ES", "FR", "IT"]) assert.equal(normalizeRequestedCountry(code), null);
});

test("country requests persist once per account, stay private and are deleted with the account", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated; create role service_role;");
    for (const file of ["20260807160000_heaterdeals_backend.sql", "20260904000000_heaterdeals_discord.sql", "20260910000000_heaterdeals_push.sql", "20260910010000_heaterdeals_memberships.sql", "20260910020000_pulsedeals_rename.sql", "20260911010000_pulsedeals_country_requests.sql"]) {
      await db.exec((await readFile(`supabase/migrations/${file}`, "utf8")).replace("create extension if not exists pgcrypto;", ""));
    }
    await db.exec(`insert into pulsedeals_accounts(id,apple_sub,app_account_token) values
      ('11111111-1111-4111-8111-111111111111','first',gen_random_uuid()),
      ('22222222-2222-4222-8222-222222222222','second',gen_random_uuid());`);
    const insert = () => db.exec("insert into pulsedeals_country_requests(account_id,country_code) select id,'CA' from pulsedeals_accounts on conflict (account_id,country_code) do nothing;");
    await insert(); await insert();
    assert.equal((await db.query("select * from pulsedeals_country_requests")).rows.length, 2);
    assert.equal((await db.query("select * from pulsedeals_entitlements")).rows.length, 0);
    for (const country of ["DE", "GB", "UK", "ES", "FR", "IT", "ca", "USA"]) {
      await assert.rejects(db.query("insert into pulsedeals_country_requests(account_id,country_code) values ('11111111-1111-4111-8111-111111111111',$1)", [country]), /check constraint/);
    }
    await assert.rejects(db.exec("insert into pulsedeals_country_requests(account_id,country_code) values ('33333333-3333-4333-8333-333333333333','US')"), /foreign key/);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query("select * from pulsedeals_country_requests"), /permission denied/);
      await db.exec("reset role");
    }
    await db.exec("delete from pulsedeals_accounts where apple_sub='first'");
    assert.equal((await db.query("select * from pulsedeals_country_requests")).rows.length, 1);
  } finally { await db.close(); }
});

test("country request API requires sign-in, uses the session owner, deduplicates and rate-limits without billing", async () => {
  const names = ["PULSEDEALS_SESSION_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const previous = names.map(name => process.env[name]);
  const originalFetch = globalThis.fetch;
  try {
    process.env.PULSEDEALS_SESSION_SECRET = "test-only-country-request-secret";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://country-requests.example.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-service-key";
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: "11111111-1111-4111-8111-111111111111", exp: Date.now()/1000+600, typ: "pulsedeals-session" })).toString("base64url");
    const signed = `${header}.${payload}`;
    const token = `${signed}.${createHmac("sha256", process.env.PULSEDEALS_SESSION_SECRET).update(signed).digest("base64url")}`;
    const calls: Request[] = [];
    let limited = false;
    globalThis.fetch = async (input, init) => {
      const req = new Request(input, init); calls.push(req.clone());
      const url = new URL(req.url);
      assert.equal(url.hostname, "country-requests.example.test");
      if (url.pathname.endsWith("/rpc/consume_pulsedeals_rate_limit")) {
        return Response.json([{ allowed: !limited, remaining: 10, retry_after_seconds: 60 }]);
      }
      assert.equal(url.pathname, "/rest/v1/pulsedeals_country_requests");
      assert.ok(req.headers.get("prefer")?.includes("resolution=ignore-duplicates"));
      assert.deepEqual(await req.json(), { account_id: "11111111-1111-4111-8111-111111111111", country_code: "CA" });
      return new Response(null, { status: 201 });
    };
    const request = (body: string, auth = true) => new Request("https://runsit.ca/pulsedeals/api/v1/country-requests", {
      method: "POST", headers: auth ? { authorization: `Bearer ${token}` } : {}, body,
    });
    assert.equal((await POST(request('{"countryCode":"CA"}', false))).status, 401);
    assert.equal((await POST(request('{"countryCode":"GB"}'))).status, 422);
    assert.equal((await POST(request('null'))).status, 422);
    assert.equal((await POST(request('broken-json'))).status, 400);
    assert.equal((await POST(request(' '.repeat(513)))).status, 413);
    assert.equal(calls.length, 0);
    const result = await POST(request('{"countryCode":"ca","account_id":"someone-else"}'));
    assert.equal(result.status, 200); assert.deepEqual(await result.json(), { ok: true });
    assert.equal(calls.length, 2);
    limited = true;
    const limit = await POST(request('{"countryCode":"CA"}'));
    assert.equal(limit.status, 429); assert.equal(limit.headers.get("retry-after"), "60");
    assert.equal(calls.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((name, i) => { if (previous[i] === undefined) delete process.env[name]; else process.env[name] = previous[i]; });
  }
});
