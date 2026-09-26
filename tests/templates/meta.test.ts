import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import { checkoutParameters, TEMPLATE_STORE, tokenHash } from "../../src/lib/templates/payment";
import { TEMPLATE_VERSION } from "../../src/lib/templates/catalog";
import { metaBrowserIds, purchaseEvent, sendMetaPurchase } from "../../src/lib/templates/meta-capi";
import { isPrivateLocation, metaValue } from "../../src/lib/meta-pixel";

const accessToken = "ab".repeat(32);

function session(overrides: Partial<Stripe.Checkout.Session> = {}): Stripe.Checkout.Session {
  return {
    id: "cs_live_1234567890abcdef",
    livemode: true,
    mode: "payment",
    currency: "cad",
    amount_subtotal: 1499,
    amount_total: 1499,
    customer_details: { email: " Buyer@Example.com ", address: { country: "CA" } },
    metadata: { store: TEMPLATE_STORE, version: TEMPLATE_VERSION, templates: "mobile-app,discord-bot", access_hash: tokenHash(accessToken), subagents: "false", skill_tree: "false", app_icon: "false", currency: "cad", pricing_origin: "https://runsit.ca", meta_fbp: "fb.1.1727000000000.123456789", meta_fbc: "fb.1.1727000000000.AbCdEf" },
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
}

test("the pixel stays silent on private order and trial links", () => {
  assert.equal(isPrivateLocation({ pathname: "/templates/", hash: "", search: "?utm_source=facebook" }), false);
  assert.equal(isPrivateLocation({ pathname: "/templates/", hash: "#bundle", search: "" }), false);
  assert.equal(isPrivateLocation({ pathname: "/templates/library/", hash: "", search: "" }), true);
  assert.equal(isPrivateLocation({ pathname: "/templates/trial/", hash: "", search: "" }), true);
  assert.equal(isPrivateLocation({ pathname: "/templates/", hash: `#session_id=cs_1&access=${accessToken}`, search: "" }), true);
  assert.deepEqual(metaValue(999, "cad"), { value: 9.99, currency: "CAD" });
});

test("checkout keeps only well-formed Meta browser IDs for attribution", () => {
  const request = new Request("https://runsit.ca/api/templates/checkout/", { headers: { cookie: "a=1; _fbp=fb.1.1727000000000.123456789; _fbc=javascript:alert(1)" } });
  assert.deepEqual(metaBrowserIds(request), { meta_fbp: "fb.1.1727000000000.123456789" });
  const params = checkoutParameters(["mobile-app"], accessToken, "https://runsit.ca", false, false, undefined, false, metaBrowserIds(request));
  assert.equal(params.metadata?.meta_fbp, "fb.1.1727000000000.123456789");
  assert.equal(params.metadata?.meta_fbc, undefined);
});

test("purchase events carry the verified order value and hashed buyer data only", () => {
  const event = purchaseEvent(session(), 1727000000);
  assert.equal(event.event_id, "cs_live_1234567890abcdef");
  assert.equal(event.event_source_url, "https://runsit.ca/templates/");
  assert.deepEqual(event.custom_data, { value: 14.99, currency: "CAD", content_ids: ["discord-bot", "mobile-app"], content_type: "product", num_items: 2 });
  assert.match(event.user_data.em![0], /^[a-f0-9]{64}$/);
  assert.notEqual(event.user_data.em![0], "buyer@example.com");
  assert.equal(event.user_data.fbp, "fb.1.1727000000000.123456789");
  assert.ok(!JSON.stringify(event).includes(accessToken));
});

test("sending is off without configuration, for free orders and for test checkouts", async () => {
  const calls: { url: string; body: string; auth: string }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: String(init.body), auth: String((init.headers as Record<string, string>).Authorization) });
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
  const env = { NEXT_PUBLIC_META_PIXEL_ID: "1234567890", META_CONVERSIONS_API_TOKEN: "token" };
  assert.equal(await sendMetaPurchase({}, session(), 1, fetchImpl), false);
  assert.equal(await sendMetaPurchase(env, session({ livemode: false }), 1, fetchImpl), false);
  assert.equal(await sendMetaPurchase(env, session({ amount_total: 0 }), 1, fetchImpl), false);
  assert.equal(calls.length, 0);
  assert.equal(await sendMetaPurchase(env, session(), 1, fetchImpl), true);
  assert.equal(calls[0].url, "https://graph.facebook.com/v21.0/1234567890/events");
  assert.equal(calls[0].auth, "Bearer token");
  assert.equal(JSON.parse(calls[0].body).data[0].event_name, "Purchase");
  assert.equal(await sendMetaPurchase({ ...env, META_TEST_EVENT_CODE: "TEST123" }, session({ livemode: false }), 1, fetchImpl), true);
  assert.equal(JSON.parse(calls[1].body).test_event_code, "TEST123");
  const failing = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
  assert.equal(await sendMetaPurchase(env, session(), 1, failing), false);
});
