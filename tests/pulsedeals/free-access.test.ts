import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { GET as feed } from "../../src/app/pulsedeals/api/v1/feed/route";
import { GET as detail } from "../../src/app/pulsedeals/api/v1/deals/[id]/route";
import { GET as votes, POST as vote } from "../../src/app/pulsedeals/api/v1/votes/route";
import { PULSE_MARKETPLACES } from "../../src/lib/pulsedeals/types";

test("free accounts can load all markets, open live deals and vote without any billing lookup", async () => {
  const names = ["PULSEDEALS_SESSION_SECRET", "PULSEDEALS_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const previous = names.map(name => process.env[name]);
  const originalFetch = globalThis.fetch;
  const accountID = "11111111-1111-4111-8111-111111111111";
  const asin = "B09XS7JWHH";
  let limited = false;
  let savedVote: string | null = null;
  const calls: string[] = [];
  try {
    process.env.PULSEDEALS_SESSION_SECRET = "free-access-test-only-secret";
    process.env.PULSEDEALS_SUPABASE_URL = "https://free-deals.example.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "free-access-test-only-key";
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: accountID, exp: Date.now()/1000+600, typ: "pulsedeals-session" })).toString("base64url");
    const signed = `${header}.${payload}`;
    const token = `${signed}.${createHmac("sha256", process.env.PULSEDEALS_SESSION_SECRET).update(signed).digest("base64url")}`;
    globalThis.fetch = async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      calls.push(url.pathname);
      assert.equal(url.hostname, "free-deals.example.test");
      if (url.pathname.endsWith("/rpc/consume_pulsedeals_rate_limit")) {
        return Response.json([{ allowed: !limited, remaining: 10, retry_after_seconds: 60 }]);
      }
      if (url.pathname === "/rest/v1/pulsedeals_deals") {
        // Membership and single-country filters must never be attached to vote queries.
        const market = url.searchParams.get("marketplace")?.replace(/^eq\./, "") ?? "fr";
        const row = { id: "deal", asin, marketplace: market, title: "Free live deal", category: "tech", current_price: 25, reference_price: 100, score: 90, status: "live" };
        return Response.json(request.headers.get("accept")?.includes("object") ? row : [row]);
      }
      if (url.pathname === "/rest/v1/pulsedeals_deal_votes") {
        if (request.method === "POST") {
          const body = await request.json();
          assert.equal(body.account_id, accountID);
          assert.equal(body.asin, asin);
          savedVote = body.vote;
          return new Response(null, { status: 201 });
        }
        return Response.json(savedVote ? [{ account_id: accountID, asin, vote: savedVote }] : []);
      }
      throw new Error(`Unexpected backend lookup: ${url.pathname}`);
    };
    const request = (path: string, auth = true, body?: object) => new Request(`https://runsit.ca/pulsedeals/api/v1/${path}`, {
      method: body ? "POST" : "GET",
      headers: auth ? { authorization: `Bearer ${token}` } : {},
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert.equal((await feed(request("feed?marketplace=uk", false))).status, 401);
    assert.equal(calls.length, 0);
    for (const marketplace of PULSE_MARKETPLACES) {
      const response = await feed(request(`feed?marketplace=${marketplace}`));
      assert.equal(response.status, 200);
      assert.equal((await response.json()).data[0].marketplace, marketplace);
    }
    assert.equal((await detail(request(`deals/${asin}?marketplace=fr`), { params: Promise.resolve({ id: asin }) })).status, 200);
    assert.equal((await votes(request(`votes?asins=${asin}`))).status, 200);
    const result = await vote(request("votes", true, { asin, vote: "good", account_id: "someone-else" }));
    assert.equal(result.status, 200);
    assert.equal((await result.json()).data.myVote, "good");
    assert.ok(calls.every(path => !/membership|entitlement|product_tiers|discord/.test(path)));
    limited = true;
    assert.equal((await feed(request("feed?marketplace=uk"))).status, 429);
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((name, i) => { if (previous[i] === undefined) delete process.env[name]; else process.env[name] = previous[i]; });
  }
});
