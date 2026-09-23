import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { bundlePrice, TEMPLATE_VERSION, type TemplateCurrency, type TemplateId } from "../../src/lib/templates/catalog";
import { TEMPLATE_STORE, tokenHash } from "../../src/lib/templates/payment";
import * as checkout from "../../src/app/api/templates/checkout/route";
import * as config from "../../src/app/api/templates/config/route";
import * as referral from "../../src/app/api/templates/referral/route";
import * as library from "../../src/app/api/templates/library/route";
import * as webhook from "../../src/app/api/templates/webhook/route";
import * as ai from "../../src/app/api/templates/ai/route";
import * as icons from "../../src/app/api/templates/icon/route";

process.env.TEMPLATES_STRIPE_KEY = "sk_test_synthetic_route_key";
process.env.TEMPLATES_STRIPE_WEBHOOK_SECRET = "whsec_synthetic_route_secret";
process.env.TEMPLATES_SITE_URL = "https://shop.example";

const origin = "https://shop.example";
const accessToken = "ab".repeat(32);
const wrongToken = "cd".repeat(32);
const paidId = "cs_test_paidroute123456789";
const unpaidId = "cs_test_unpaidroute123456789";
const addOnId = "cs_test_addonroute123456789";
const skillTreeId = "cs_test_skillroute123456789";
const appIconId = "cs_test_iconroute123456789";
const ids = ["discord-bot", "roblox-game"] satisfies TemplateId[];

type StoredSession = Record<string, any>;
const sessions = new Map<string, StoredSession>();
const stripeCalls: Array<{ url: string; method: string; headers: Headers; body: string }> = [];

function session(id: string, selected: TemplateId[], paid = true, subagents?: boolean, skillTree?: boolean, appIcon?: boolean): StoredSession {
  return {
    id,
    object: "checkout.session",
    mode: "payment",
    status: paid ? "complete" : "open",
    payment_status: paid ? "paid" : "unpaid",
    currency: "usd",
    amount_subtotal: bundlePrice(selected.length, subagents === true, skillTree === true, appIcon === true),
    amount_total: bundlePrice(selected.length, subagents === true, skillTree === true, appIcon === true),
    metadata: {
      store: TEMPLATE_STORE,
      version: TEMPLATE_VERSION,
      templates: selected.join(","),
      access_hash: tokenHash(accessToken),
      ...(subagents === undefined ? {} : { subagents: String(subagents) }),
      ...(skillTree === undefined ? {} : { skill_tree: String(skillTree) }),
      ...(appIcon === undefined ? {} : { app_icon: String(appIcon) }),
    },
    payment_intent: paid ? {
      id: `pi_${id}`,
      object: "payment_intent",
      latest_charge: { id: `ch_${id}`, object: "charge", refunded: false, amount_refunded: 0, disputed: false },
    } : null,
  };
}

function installStripeMock() {
  Reflect.set(globalThis, Symbol.for("__cloudflare-context__"), { env: { TEMPLATES_AI_ENABLED: "true", TEMPLATES_AI_MODEL: "synthetic-model", TEMPLATES_OPENAI_API_KEY: "synthetic-key", TEMPLATES_ICON_ENABLED: "true", TEMPLATES_ICON_MODEL: "gpt-image-2.5-flare-2026-09-08", TEMPLATES_AI_ORDERS: { getByName() { throw new Error("AI storage was not expected in a payment test"); } } } });
  sessions.clear();
  sessions.set(paidId, session(paidId, ids));
  sessions.set(unpaidId, session(unpaidId, ["discord-bot"], false));
  sessions.set(addOnId, session(addOnId, ids, true, true));
  sessions.set(skillTreeId, session(skillTreeId, ids, true, false, true));
  sessions.set(appIconId, session(appIconId, ids, true, false, false, true));
  stripeCalls.length = 0;
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith("https://api.stripe.com/v1/")) throw new Error(`Unexpected network request to ${new URL(url).origin}`);
    const requestHeaders = new Headers(input instanceof Request ? input.headers : init?.headers);
    const method = (input instanceof Request ? input.method : init?.method || "GET").toUpperCase();
    const rawBody = input instanceof Request ? await input.clone().text() : typeof init?.body === "string" ? init.body : init?.body instanceof URLSearchParams ? init.body.toString() : "";
    stripeCalls.push({ url, method, headers: requestHeaders, body: rawBody });

    const parsed = new URL(url);
    if (method === "POST" && parsed.pathname === "/v1/checkout/sessions") {
      const fields = new URLSearchParams(rawBody);
      // Reproduce an account with Managed Payments enabled by default.
      if (fields.has("custom_text[submit][message]") && fields.get("managed_payments[enabled]") !== "false") {
        return Response.json({ error: { type: "invalid_request_error", message: "custom_text cannot be used with Managed Payments, which is enabled by default on your account." } }, { status: 400 });
      }
      const selected = (fields.get("metadata[templates]") || "").split(",") as TemplateId[];
      const created = session("cs_test_createdroute123456", selected, false, fields.get("metadata[subagents]") === "true", fields.get("metadata[skill_tree]") === "true", fields.get("metadata[app_icon]") === "true");
      created.currency = fields.get("metadata[currency]");
      created.metadata.currency = fields.get("metadata[currency]");
      created.metadata.pricing_origin = fields.get("metadata[pricing_origin]");
      created.status = "open";
      created.payment_status = "unpaid";
      created.url = "https://checkout.stripe.example/synthetic";
      sessions.set(created.id, created);
      return Response.json(created);
    }
    const match = parsed.pathname.match(/^\/v1\/checkout\/sessions\/([^/]+)$/);
    if (match && method === "GET") {
      const stored = sessions.get(decodeURIComponent(match[1]));
      return stored ? Response.json(stored) : Response.json({ error: { message: "missing" } }, { status: 404 });
    }
    if (match && method === "POST") {
      const stored = sessions.get(decodeURIComponent(match[1]));
      if (!stored) return Response.json({ error: { message: "missing" } }, { status: 404 });
      const fields = new URLSearchParams(rawBody);
      if (fields.get("metadata[delivery]")) stored.metadata.delivery = fields.get("metadata[delivery]");
      return Response.json(stored);
    }
    throw new Error(`Unexpected Stripe request ${method} ${parsed.pathname}`);
  };
}

function jsonRequest(pathname: string, value: unknown, extraHeaders: Record<string, string> = {}, requestOrigin = origin) {
  return new Request(`${requestOrigin}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: requestOrigin, ...extraHeaders },
    body: typeof value === "string" ? value : JSON.stringify(value),
  });
}

async function body(response: Response): Promise<any> { return response.json(); }

test.beforeEach(() => installStripeMock());

test("AI routes reject cross-origin, invalid, unpaid and refunded purchase access before using storage", async () => {
  for (const values of [
    { sessionId: paidId, accessToken: wrongToken },
    { sessionId: unpaidId, accessToken },
    { sessionId: "malformed", accessToken },
  ]) {
    const response = await ai.POST(jsonRequest("/api/templates/ai", { action: "load", ...values }));
    assert.ok([403, 409].includes(response.status));
  }
  assert.equal((await ai.POST(jsonRequest("/api/templates/ai", { action: "load", sessionId: paidId, accessToken }, { origin: "https://evil.example" }))).status, 403);
  sessions.get(paidId)!.payment_intent.latest_charge.refunded = true;
  const response = await ai.POST(jsonRequest("/api/templates/ai", { action: "load", sessionId: paidId, accessToken }));
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("new checkout pauses when included AI is not configured, while paid downloads remain available", async () => {
  Reflect.set(globalThis, Symbol.for("__cloudflare-context__"), { env: {} });
  assert.equal((await body(await config.GET(new Request(`${origin}/api/templates/config`)))).available, false);
  assert.equal((await checkout.POST(jsonRequest("/api/templates/checkout", { templates: ids, accessToken }))).status, 503);
  assert.equal((await library.POST(jsonRequest("/api/templates/library", { sessionId: paidId, accessToken }))).status, 200);
});

test("config exposes request-host currency only for validated storefront origins", async () => {
  for (const [requestOrigin, currency] of [
    ["https://runsit.ca", "cad"],
    ["https://www.runsit.ca", "cad"],
    ["https://runs-it.com", "usd"],
    ["https://www.runs-it.com", "usd"],
    [origin, "cad"],
  ] satisfies Array<[string, TemplateCurrency]>) {
    const response = await config.GET(new Request(`${requestOrigin}/api/templates/config`));
    assert.equal(response.status, 200);
    const text = await response.text();
    assert.deepEqual(JSON.parse(text), { available: true, appIconAvailable: true, testMode: true, currency });
    assert.doesNotMatch(text, /synthetic_route/);
  }

  const unsupported = await config.GET(new Request("https://evil.example/api/templates/config"));
  assert.equal(unsupported.status, 200);
  assert.deepEqual(await body(unsupported), { available: false, appIconAvailable: false, testMode: true, currency: "cad" });
});

test("checkout rejects malformed, oversized, foreign-origin, and duplicate carts", async () => {
  let response = await checkout.POST(jsonRequest("/api/templates/checkout", "{"));
  assert.equal(response.status, 400);

  response = await checkout.POST(jsonRequest("/api/templates/checkout", { templates: ["discord-bot"], accessToken, padding: "x".repeat(9_000) }));
  assert.equal(response.status, 413);

  response = await checkout.POST(new Request(`${origin}/api/templates/checkout`, {
    method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" },
    body: JSON.stringify({ templates: ["discord-bot"], accessToken }),
  }));
  assert.equal(response.status, 403);

  response = await checkout.POST(new Request("https://runsit.ca/api/templates/checkout", {
    method: "POST", headers: { "content-type": "application/json", origin: "https://runs-it.com" },
    body: JSON.stringify({ templates: ["discord-bot"], accessToken }),
  }));
  assert.equal(response.status, 403, "even two allowed origins must not be mixed");

  response = await checkout.POST(new Request("https://www.runs-it.com.evil.example/api/templates/checkout", {
    method: "POST", headers: { "content-type": "application/json", origin: "https://www.runs-it.com.evil.example" },
    body: JSON.stringify({ templates: ["discord-bot"], accessToken }),
  }));
  assert.equal(response.status, 403);

  response = await checkout.POST(jsonRequest("/api/templates/checkout", { templates: ["discord-bot", "discord-bot"], accessToken }));
  assert.equal(response.status, 400);
  assert.equal(stripeCalls.length, 0);
});

test("checkout works with Managed Payments enabled by default and retries with a new request version", async () => {
  const cart = { templates: ids, accessToken, subagents: false, skillTree: false };
  const first = await checkout.POST(jsonRequest("/api/templates/checkout", cart));
  assert.equal(first.status, 200);
  const retry = await checkout.POST(jsonRequest("/api/templates/checkout", cart));
  assert.equal(retry.status, 200);
  const [firstCall, retryCall] = stripeCalls;
  const firstKey = firstCall.headers.get("idempotency-key");
  assert.equal(retryCall.headers.get("idempotency-key"), firstKey);
  assert.equal(retryCall.body, firstCall.body);
  const legacyKey = `templates-standard-v1-${tokenHash(`${accessToken}:${ids.join(",")}:${origin}:cad:false:false:none`)}`;
  assert.notEqual(firstKey, legacyKey, "changed parameters must not reuse a previous Checkout request's key");
  const fields = new URLSearchParams(firstCall.body);
  assert.equal(fields.get("managed_payments[enabled]"), "false");
  assert.equal(fields.get("adaptive_pricing[enabled]"), "false");
  assert.match(fields.get("custom_text[submit][message]") || "", /save your unique purchase URL/);
});

test("checkout ignores client price/currency and derives CAD metadata from its validated origin", async () => {
  const response = await checkout.POST(jsonRequest("/api/templates/checkout", {
    templates: ids,
    accessToken,
    price: 1,
    currency: "xxx",
    brief: "private client text must not reach Stripe",
  }));
  assert.equal(response.status, 200);
  assert.equal((await body(response)).url, "https://checkout.stripe.example/synthetic");
  assert.equal(stripeCalls.length, 1);
  const call = stripeCalls[0];
  assert.equal(call.method, "POST");
  assert.match(call.headers.get("idempotency-key") || "", /^templates-standard-v2-[a-f0-9]{64}$/);
  const posted = new URLSearchParams(call.body);
  assert.equal(posted.get("line_items[0][price_data][unit_amount]"), "999");
  assert.equal(posted.get("line_items[1][price_data][unit_amount]"), "500");
  assert.equal(posted.get("line_items[0][price_data][currency]"), "cad");
  assert.equal(posted.get("metadata[currency]"), "cad");
  assert.equal(posted.get("metadata[pricing_origin]"), origin);
  assert.equal(posted.get("payment_intent_data[metadata][currency]"), "cad");
  assert.equal(posted.get("payment_intent_data[metadata][pricing_origin]"), origin);
  assert.equal(posted.get("adaptive_pricing[enabled]"), "false");
  assert.doesNotMatch(call.body, /private.client.text|currency=xxx|unit_amount=1/);
});

test("founder referrals validate independently and checkout applies ten percent", async () => {
  let response = await referral.POST(jsonRequest("/api/templates/referral", { code: "zain-runit-10" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await body(response), { discountPercent: 10, founder: "Zain Piyarali" });
  response = await referral.POST(jsonRequest("/api/templates/referral", { code: "not-real" }));
  assert.equal(response.status, 400);
  response = await referral.POST(jsonRequest("/api/templates/referral", { code: "ZAIN-RUNIT-10" }, { origin: "https://evil.example" }));
  assert.equal(response.status, 403);

  response = await checkout.POST(jsonRequest("/api/templates/checkout", { templates: ids, accessToken, referralCode: "ZAIN-RUNIT-10" }));
  assert.equal(response.status, 200);
  const posted = new URLSearchParams(stripeCalls.at(-1)!.body);
  assert.deepEqual([0, 1].map((index) => Number(posted.get(`line_items[${index}][price_data][unit_amount]`))), [899, 450]);
  assert.equal(posted.get("metadata[referral_founder]"), "zainpi");
  assert.equal(posted.get("metadata[referral_discount_percent]"), "10");
  assert.equal(posted.get("payment_intent_data[metadata][referral_founder]"), "zainpi");
});

test("checkout prices dot-ca in CAD and dot-com in USD with currency-specific idempotency", async () => {
  const cases = [
    ["https://runsit.ca", "cad"],
    ["https://www.runsit.ca", "cad"],
    ["https://runs-it.com", "usd"],
    ["https://www.runs-it.com", "usd"],
  ] satisfies Array<[string, TemplateCurrency]>;
  const keys = new Map<string, string>();

  for (const [requestOrigin, currency] of cases) {
    const response = await checkout.POST(jsonRequest("/api/templates/checkout", {
      templates: ids, accessToken, subagents: true, skillTree: true,
    }, {}, requestOrigin));
    assert.equal(response.status, 200, requestOrigin);
    const call = stripeCalls.at(-1)!;
    const posted = new URLSearchParams(call.body);
    keys.set(requestOrigin, call.headers.get("idempotency-key") || "");
    for (let index = 0; index < 4; index += 1) assert.equal(posted.get(`line_items[${index}][price_data][currency]`), currency);
    assert.deepEqual([0, 1, 2, 3].map((index) => Number(posted.get(`line_items[${index}][price_data][unit_amount]`))), [999, 500, 500, 1000]);
    assert.equal(posted.get("metadata[currency]"), currency);
    assert.equal(posted.get("metadata[pricing_origin]"), requestOrigin);
    assert.equal(posted.get("payment_intent_data[metadata][currency]"), currency);
    assert.equal(posted.get("payment_intent_data[metadata][pricing_origin]"), requestOrigin);
    assert.equal(posted.get("adaptive_pricing[enabled]"), "false");
  }

  assert.notEqual(keys.get("https://runsit.ca"), keys.get("https://runs-it.com"));
  assert.notEqual(keys.get("https://www.runsit.ca"), keys.get("https://www.runs-it.com"));
});

test("checkout validates add-on type, charges it once, and separates idempotency", async () => {
  let response = await checkout.POST(jsonRequest("/api/templates/checkout", { templates: ids, accessToken, subagents: "true" }));
  assert.equal(response.status, 400);
  assert.equal(stripeCalls.length, 0);

  response = await checkout.POST(jsonRequest("/api/templates/checkout", { templates: ids, accessToken, subagents: false }));
  assert.equal(response.status, 200);
  const without = stripeCalls.at(-1)!;
  const withoutKey = without.headers.get("idempotency-key");

  response = await checkout.POST(jsonRequest("/api/templates/checkout", { templates: ids, accessToken, subagents: true }));
  assert.equal(response.status, 200);
  const withAddOn = stripeCalls.at(-1)!;
  const posted = new URLSearchParams(withAddOn.body);
  assert.notEqual(withAddOn.headers.get("idempotency-key"), withoutKey);
  assert.equal(posted.get("metadata[subagents]"), "true");
  assert.equal(posted.get("line_items[2][quantity]"), "1");
  assert.equal(posted.get("line_items[2][price_data][unit_amount]"), "500");
  assert.equal(posted.get("line_items[3][price_data][unit_amount]"), null);
});

test("checkout validates and independently prices every skill-tree combination", async () => {
  let response = await checkout.POST(jsonRequest("/api/templates/checkout", { templates: ids, accessToken, skillTree: 1 }));
  assert.equal(response.status, 400);
  assert.equal(stripeCalls.length, 0);

  const keys = new Set<string>();
  for (const [subagents, skillTree, expected] of [
    [false, false, [999, 500]],
    [true, false, [999, 500, 500]],
    [false, true, [999, 500, 1000]],
    [true, true, [999, 500, 500, 1000]],
  ] as const) {
    response = await checkout.POST(jsonRequest("/api/templates/checkout", { templates: ids, accessToken, subagents, skillTree }));
    assert.equal(response.status, 200);
    const call = stripeCalls.at(-1)!;
    keys.add(call.headers.get("idempotency-key") || "");
    const posted = new URLSearchParams(call.body);
    assert.equal(posted.get("metadata[subagents]"), String(subagents));
    assert.equal(posted.get("metadata[skill_tree]"), String(skillTree));
    assert.deepEqual(expected.map((_, index) => Number(posted.get(`line_items[${index}][price_data][unit_amount]`))), expected);
    assert.equal(posted.get(`line_items[${expected.length}][price_data][unit_amount]`), null);
  }
  assert.equal(keys.size, 4);
});

test("library gates exact paid prompts by private token and paid state", async () => {
  let response = await library.POST(jsonRequest("/api/templates/library", { sessionId: paidId, accessToken: wrongToken }));
  assert.equal(response.status, 403);

  response = await library.POST(jsonRequest("/api/templates/library", { sessionId: unpaidId, accessToken }));
  const unpaidBody = await body(response);
  assert.equal(response.status, 409, JSON.stringify(unpaidBody));

  response = await library.POST(jsonRequest("/api/templates/library", { sessionId: paidId, accessToken, appIcon: true }));
  assert.equal(response.status, 200);
  const result = await body(response);
  assert.deepEqual(result.templates.map((item: any) => item.id), ids);
  assert.ok(result.templates.every((item: any) => typeof item.foundation === "string" && item.foundation.length > 5_000));
  assert.equal(result.subagents, false);
  assert.equal(result.subagentInstructions, undefined);
  assert.equal(result.skillTree, false);
  assert.equal(result.skillTreeInstructions, undefined);
  assert.equal(result.appIcon, false);
  assert.equal(result.appIconInstructions, undefined);
  assert.equal(sessions.get(paidId)?.metadata.delivery, "available");

  response = await library.POST(jsonRequest("/api/templates/library", { sessionId: addOnId, accessToken, subagents: false }));
  assert.equal(response.status, 200);
  const entitled = await body(response);
  assert.equal(entitled.subagents, true);
  assert.ok(typeof entitled.subagentInstructions === "string" && entitled.subagentInstructions.length > 500);

  response = await library.POST(jsonRequest("/api/templates/library", { sessionId: skillTreeId, accessToken, skillTree: false }));
  assert.equal(response.status, 200);
  const skilled = await body(response);
  assert.equal(skilled.subagents, false);
  assert.equal(skilled.subagentInstructions, undefined);
  assert.equal(skilled.skillTree, true);
  assert.ok(typeof skilled.skillTreeInstructions === "string" && skilled.skillTreeInstructions.length > 500);

  response = await library.POST(jsonRequest("/api/templates/library", { sessionId: appIconId, accessToken, appIcon: false }));
  assert.equal(response.status, 200);
  const icon = await body(response);
  assert.equal(icon.appIcon, true);
  assert.equal(icon.appIconInstructions, undefined, "the purchased icon is generated on the site, not delivered as a prompt");
  assert.equal(icon.subagentInstructions, undefined);
  assert.equal(icon.skillTreeInstructions, undefined);
});

test("checkout validates app icon selection and separates changed carts while preserving retries", async () => {
  for (const appIcon of ["true", 1, null, {}]) {
    const response = await checkout.POST(jsonRequest("/api/templates/checkout", { templates: ids, accessToken, appIcon }));
    assert.equal(response.status, 400);
  }
  assert.equal(stripeCalls.length, 0);
  for (const appIcon of [false, true, true]) {
    const response = await checkout.POST(jsonRequest("/api/templates/checkout", { templates: ids, accessToken, appIcon }));
    assert.equal(response.status, 200);
  }
  const [without, withIcon, retry] = stripeCalls;
  assert.notEqual(without.headers.get("idempotency-key"), withIcon.headers.get("idempotency-key"));
  assert.equal(withIcon.headers.get("idempotency-key"), retry.headers.get("idempotency-key"));
  assert.equal(withIcon.body, retry.body);
  const posted = new URLSearchParams(withIcon.body);
  assert.equal(posted.get("metadata[app_icon]"), "true");
  assert.equal(posted.get("payment_intent_data[metadata][app_icon]"), "true");
  assert.equal(posted.get("line_items[2][price_data][unit_amount]"), "500");
  assert.equal(posted.get("line_items[2][quantity]"), "1");
  assert.equal(posted.get("line_items[3][price_data][unit_amount]"), null);
});

test("icon generation and downloads require a valid paid add-on and private token", async () => {
  for (const action of ["load", "generate", "download", "delete"]) {
    for (const access of [
      { sessionId: paidId, accessToken, appIcon: true },
      { sessionId: unpaidId, accessToken, appIcon: true },
      { sessionId: appIconId, accessToken: wrongToken },
      { sessionId: `trial_${"a".repeat(64)}`, accessToken },
    ]) {
      assert.ok([403, 409].includes((await icons.POST(jsonRequest("/api/templates/icon", { action, ...access }))).status));
    }
  }
  assert.equal((await icons.POST(jsonRequest("/api/templates/icon", { action: "load", sessionId: appIconId, accessToken }, { origin: "https://evil.example" }))).status, 403);
  sessions.get(appIconId)!.payment_intent.latest_charge.refunded = true;
  assert.equal((await icons.POST(jsonRequest("/api/templates/icon", { action: "download", sessionId: appIconId, accessToken }))).status, 403);
});

test("checkout refuses the icon add-on when image generation is disabled", async () => {
  const context = Reflect.get(globalThis, Symbol.for("__cloudflare-context__"));
  context.env.TEMPLATES_ICON_ENABLED = "false";
  const availability = await body(await config.GET(new Request(`${origin}/api/templates/config`)));
  assert.equal(availability.available, true);
  assert.equal(availability.appIconAvailable, false);
  assert.equal((await checkout.POST(jsonRequest("/api/templates/checkout", { templates: ids, accessToken, appIcon: true }))).status, 503);
  assert.equal(stripeCalls.length, 0);
  assert.equal((await checkout.POST(jsonRequest("/api/templates/checkout", { templates: ids, accessToken, appIcon: false }))).status, 200);
});

function signedWebhook(payload: string, valid = true): Request {
  const timestamp = Math.floor(Date.now() / 1000);
  const secret = valid ? process.env.TEMPLATES_STRIPE_WEBHOOK_SECRET! : "whsec_wrong_secret";
  const digest = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return new Request(`${origin}/api/templates/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": `t=${timestamp},v1=${digest}` },
    body: payload,
  });
}

test("webhook rejects invalid signatures and safely deduplicates repeated fulfillment", async () => {
  const event = JSON.stringify({
    id: "evt_synthetic_duplicate",
    object: "event",
    api_version: "2025-12-15.clover",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    type: "checkout.session.completed",
    data: { object: sessions.get(paidId) },
  });
  let response = await webhook.POST(signedWebhook(event, false));
  assert.equal(response.status, 400);
  assert.equal(stripeCalls.length, 0);

  response = await webhook.POST(signedWebhook(event));
  assert.equal(response.status, 200);
  assert.deepEqual(await body(response), { received: true });
  response = await webhook.POST(signedWebhook(event));
  assert.equal(response.status, 200);

  const updates = stripeCalls.filter((call) => call.method === "POST" && call.url.includes(`/${paidId}`));
  assert.equal(updates.length, 1, `duplicate webhook must not repeat delivery mutation: ${JSON.stringify(stripeCalls.map(({ method, url }) => ({ method, url })))}`);
});
