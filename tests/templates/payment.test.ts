import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";
import {
  bundlePrice,
  APP_ICON_ADDON_CENTS,
  discountedBundlePrice,
  EXTRA_TEMPLATE_CENTS,
  FIRST_TEMPLATE_CENTS,
  SKILL_TREE_ADDON_CENTS,
  SUBAGENT_ADDON_CENTS,
  DEFAULT_TEMPLATE_CURRENCY,
  parseTemplateIds,
  templateCatalog,
  templateCurrencyForHostname,
  TEMPLATE_VERSION,
  type TemplateCurrency,
  type TemplateId,
} from "../../src/lib/templates/catalog";
import {
  checkoutParameters,
  fulfillOrder,
  purchasedIds,
  StoreError,
  TEMPLATE_STORE,
  tokenHash,
  validAccessToken,
  validSessionId,
  verifyOrder,
} from "../../src/lib/templates/payment";
import { referralForCode } from "../../src/lib/templates/referrals";

const accessToken = "ab".repeat(32);
const ids = ["discord-bot", "storefront"] satisfies TemplateId[];

function paidSession(overrides: Record<string, unknown> = {}, pricingOrigin = "https://runs-it.com"): Stripe.Checkout.Session {
  const currency = templateCurrencyForHostname(new URL(pricingOrigin).hostname);
  return {
    id: "cs_test_1234567890abcdef",
    object: "checkout.session",
    mode: "payment",
    status: "complete",
    payment_status: "paid",
    currency,
    amount_subtotal: bundlePrice(ids.length),
    amount_total: bundlePrice(ids.length),
    metadata: {
      store: TEMPLATE_STORE,
      version: TEMPLATE_VERSION,
      templates: ids.join(","),
      access_hash: tokenHash(accessToken),
      currency,
      pricing_origin: pricingOrigin,
    },
    payment_intent: {
      id: "pi_test",
      object: "payment_intent",
      latest_charge: {
        id: "ch_test",
        object: "charge",
        refunded: false,
        amount_refunded: 0,
        disputed: false,
      },
    },
    ...overrides,
  } as unknown as Stripe.Checkout.Session;
}

function fakeStripe(session: Stripe.Checkout.Session) {
  const updates: Array<{ id: string; params: Stripe.Checkout.SessionUpdateParams }> = [];
  const stripe = {
    checkout: {
      sessions: {
        retrieve: async (id: string, params: unknown) => {
          assert.equal(id, session.id);
          assert.deepEqual(params, { expand: ["payment_intent.latest_charge"] });
          return session;
        },
        update: async (id: string, params: Stripe.Checkout.SessionUpdateParams) => {
          updates.push({ id, params });
          return session;
        },
      },
    },
  } as unknown as Stripe;
  return { stripe, updates };
}

async function rejectsStoreError(action: () => Promise<unknown>, status: number, pattern: RegExp) {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof StoreError);
    assert.equal(error.status, status);
    assert.match(error.message, pattern);
    return true;
  });
}

test("bundle pricing covers zero through every catalog item", () => {
  for (let count = 0; count <= templateCatalog.length; count += 1) {
    const expected = count === 0 ? 0 : FIRST_TEMPLATE_CENTS + (count - 1) * EXTRA_TEMPLATE_CENTS;
    assert.equal(bundlePrice(count), expected);
    assert.equal(bundlePrice(count, true), count === 0 ? 0 : expected + SUBAGENT_ADDON_CENTS);
    assert.equal(bundlePrice(count, false, true), count === 0 ? 0 : expected + SKILL_TREE_ADDON_CENTS);
    assert.equal(bundlePrice(count, true, true), count === 0 ? 0 : expected + SUBAGENT_ADDON_CENTS + SKILL_TREE_ADDON_CENTS);
    for (const subagents of [false, true]) for (const skillTree of [false, true]) {
      assert.equal(bundlePrice(count, subagents, skillTree, true), count === 0 ? 0 : bundlePrice(count, subagents, skillTree) + APP_ICON_ADDON_CENTS);
    }
  }
  for (const invalid of [-1, 0.5, templateCatalog.length + 1, Number.NaN]) {
    assert.throws(() => bundlePrice(invalid), /Invalid template count/);
  }
});

test("hostname pricing defaults to CAD and reserves USD for the public dot-com hosts", () => {
  assert.equal(DEFAULT_TEMPLATE_CURRENCY, "cad" satisfies TemplateCurrency);
  for (const hostname of ["runs-it.com", "www.runs-it.com"]) assert.equal(templateCurrencyForHostname(hostname), "usd");
  for (const hostname of ["runsit.ca", "www.runsit.ca", "shop.example", "localhost", "RUNS-IT.COM.evil.example"]) {
    assert.equal(templateCurrencyForHostname(hostname), "cad");
  }
});

test("cart parsing rejects malformed, empty, duplicate, excessive, and unknown selections", () => {
  assert.deepEqual(parseTemplateIds(["storefront", "discord-bot"]), ["discord-bot", "storefront"]);
  for (const invalid of [
    null,
    {},
    "storefront",
    [],
    ["storefront", "storefront"],
    ["not-a-template"],
    [...templateCatalog.map((item) => item.id), "not-a-template"],
  ]) assert.throws(() => parseTemplateIds(invalid), /Choose between one and six/);
});

test("checkout retry parameters derive canonical currency, prices, and metadata from return origin", () => {
  const returnOrigin = "https://runs-it.com";
  const params = checkoutParameters(ids, accessToken, returnOrigin);
  assert.deepEqual(params, checkoutParameters(ids, accessToken, returnOrigin));
  assert.equal(params.mode, "payment");
  assert.equal(params.success_url, `${returnOrigin}/templates/library/#session_id={CHECKOUT_SESSION_ID}&access=${accessToken}`);
  assert.equal(params.cancel_url, `${returnOrigin}/templates/?canceled=1`);
  assert.deepEqual(params.line_items?.map((line) => (line as Stripe.Checkout.SessionCreateParams.LineItem).price_data?.unit_amount), [999, 500]);
  assert.deepEqual(params.line_items?.map((line) => (line as Stripe.Checkout.SessionCreateParams.LineItem).price_data?.currency), ["usd", "usd"]);
  assert.deepEqual(params.line_items?.map((line) => (line as Stripe.Checkout.SessionCreateParams.LineItem).quantity), [1, 1]);
  assert.deepEqual(params.metadata, {
    store: TEMPLATE_STORE,
    version: TEMPLATE_VERSION,
    templates: ids.join(","),
    access_hash: tokenHash(accessToken),
    ai_messages: "20",
    ai_overviews: "one_per_template",
    subagents: "false",
    skill_tree: "false",
    app_icon: "false",
    currency: "usd",
    pricing_origin: returnOrigin,
  });
  assert.equal(params.payment_intent_data?.metadata?.store, TEMPLATE_STORE);
  assert.equal(params.payment_intent_data?.metadata?.templates, ids.join(","));
  assert.equal(params.payment_intent_data?.metadata?.subagents, "false");
  assert.equal(params.payment_intent_data?.metadata?.skill_tree, "false");
  assert.equal(params.payment_intent_data?.metadata?.app_icon, "false");
  assert.equal(params.payment_intent_data?.metadata?.currency, "usd");
  assert.equal(params.payment_intent_data?.metadata?.pricing_origin, returnOrigin);
  assert.equal(params.adaptive_pricing?.enabled, false);

  const cad = checkoutParameters(ids, accessToken, "https://runsit.ca", true, true);
  const cadLines = cad.line_items as Stripe.Checkout.SessionCreateParams.LineItem[];
  assert.ok(cadLines.every((line) => line.price_data?.currency === "cad"));
  assert.deepEqual(cadLines.map((line) => line.price_data?.unit_amount), [999, 500, SUBAGENT_ADDON_CENTS, SKILL_TREE_ADDON_CENTS]);
  assert.equal(cad.metadata?.currency, "cad");
  assert.equal(cad.metadata?.pricing_origin, "https://runsit.ca");
  assert.equal(cad.payment_intent_data?.metadata?.currency, "cad");
  assert.equal(cad.adaptive_pricing?.enabled, false);

  assert.notEqual(
    params.metadata?.access_hash,
    checkoutParameters(ids, "cd".repeat(32), returnOrigin).metadata?.access_hash,
  );
});

test("three founder referral codes apply a server-side ten percent discount", () => {
  const codes = [
    ["ZAIN-RUNIT-10", "zainpi"],
    ["RAI-RUNIT-10", "raishaikh"],
    ["MIKAEL-RUNIT-10", "mikaelsid"],
  ] as const;
  for (const [code, founder] of codes) {
    const referral = referralForCode(code);
    assert.ok(referral);
    assert.equal(referral.founderSlug, founder);
    assert.equal(referral.discountPercent, 10);
    const params = checkoutParameters(ids, accessToken, "https://runsit.ca", true, true, referral);
    const lines = params.line_items as Stripe.Checkout.SessionCreateParams.LineItem[];
    assert.deepEqual(lines.map((line) => line.price_data?.unit_amount), [899, 450, 450, 900]);
    assert.equal(params.metadata?.referral_founder, founder);
    assert.equal(params.metadata?.referral_discount_percent, "10");
    assert.equal(params.payment_intent_data?.metadata?.referral_founder, founder);
    assert.equal(params.metadata?.referral_code_hash, referral.codeDigest);
  }
  assert.equal(referralForCode("zain-runit-10")?.founderSlug, "zainpi");
  assert.equal(referralForCode("not-a-founder-code"), null);
  assert.equal(discountedBundlePrice(ids.length, true, true, 10), 2_699);
});

test("paid-order verification accepts the discounted founder total and rejects forged referral metadata", () => {
  const referral = referralForCode("ZAIN-RUNIT-10")!;
  const discounted = paidSession({
    amount_subtotal: discountedBundlePrice(ids.length, false, false, referral.discountPercent),
    amount_total: discountedBundlePrice(ids.length, false, false, referral.discountPercent),
    metadata: { ...paidSession().metadata, referral_founder: referral.founderSlug, referral_code_hash: referral.codeDigest, referral_discount_percent: "10" },
  });
  assert.deepEqual(purchasedIds(discounted), ids);
  const forged = paidSession({
    amount_subtotal: discounted.amount_subtotal,
    amount_total: discounted.amount_total,
    metadata: { ...discounted.metadata, referral_code_hash: "00".repeat(32) },
  });
  assert.throws(() => purchasedIds(forged), /referral discount could not be verified/);
});

test("subagent add-on is one separate fixed-price item for the whole order", () => {
  const params = checkoutParameters(ids, accessToken, "https://shop.example", true);
  const lines = params.line_items as Stripe.Checkout.SessionCreateParams.LineItem[];
  assert.deepEqual(lines.map((line) => line.quantity), [1, 1, 1]);
  assert.deepEqual(lines.map((line) => line.price_data?.unit_amount), [999, 500, SUBAGENT_ADDON_CENTS]);
  assert.equal(params.metadata?.subagents, "true");
  assert.equal(params.payment_intent_data?.metadata?.subagents, "true");
});

test("skill-tree add-on is independent and each selected add-on appears once", () => {
  const skillOnly = checkoutParameters(ids, accessToken, "https://shop.example", false, true);
  const both = checkoutParameters(ids, accessToken, "https://shop.example", true, true);
  const amounts = (params: Stripe.Checkout.SessionCreateParams) => (params.line_items as Stripe.Checkout.SessionCreateParams.LineItem[]).map((line) => line.price_data?.unit_amount);
  assert.deepEqual(amounts(skillOnly), [999, 500, SKILL_TREE_ADDON_CENTS]);
  assert.deepEqual(amounts(both), [999, 500, SUBAGENT_ADDON_CENTS, SKILL_TREE_ADDON_CENTS]);
  assert.ok((both.line_items as Stripe.Checkout.SessionCreateParams.LineItem[]).every((line) => line.quantity === 1));
  assert.equal(skillOnly.metadata?.subagents, "false");
  assert.equal(skillOnly.metadata?.skill_tree, "true");
  assert.equal(both.payment_intent_data?.metadata?.skill_tree, "true");
});

test("access and Checkout identifiers use strict formats", () => {
  assert.equal(validAccessToken(accessToken), true);
  assert.equal(validAccessToken(accessToken.toUpperCase()), false);
  assert.equal(validAccessToken("a".repeat(63)), false);
  assert.equal(validSessionId("cs_test_1234567890abcdef"), true);
  assert.equal(validSessionId("cs_live_1234567890abcdef"), true);
  assert.equal(validSessionId("cs_1234567890abcdef"), true);
  assert.equal(validSessionId("cs_test_short"), false);
  assert.equal(validSessionId("pi_test_1234567890abcdef"), false);
});

test("app icon is charged once across currencies, bundle sizes, add-ons and referrals", () => {
  for (const origin of ["https://runsit.ca", "https://runs-it.com"]) {
    for (const count of [1, templateCatalog.length]) {
      const selected = templateCatalog.slice(0, count).map((item) => item.id);
      for (const subagents of [false, true]) for (const skillTree of [false, true]) {
        for (const referral of [undefined, referralForCode("ZAIN-RUNIT-10")!]) {
          const params = checkoutParameters(selected, accessToken, origin, subagents, skillTree, referral, true);
          const lines = params.line_items as Stripe.Checkout.SessionCreateParams.LineItem[];
          const iconLine = lines.at(-1)!;
          assert.equal(lines.length, count + Number(subagents) + Number(skillTree) + 1);
          assert.equal(iconLine.quantity, 1);
          assert.equal(iconLine.price_data?.unit_amount, referral ? 450 : 500);
          assert.equal(iconLine.price_data?.currency, templateCurrencyForHostname(new URL(origin).hostname));
          assert.equal(params.metadata?.app_icon, "true");
          assert.equal(params.payment_intent_data?.metadata?.app_icon, "true");
          const total = lines.reduce((sum, line) => sum + (line.price_data?.unit_amount ?? 0), 0);
          assert.equal(total, discountedBundlePrice(count, subagents, skillTree, referral?.discountPercent ?? 0, true));
          assert.deepEqual(purchasedIds(paidSession({ currency: params.metadata!.currency, metadata: params.metadata, amount_subtotal: total, amount_total: total })), selected);
        }
      }
    }
  }
});

test("verification rejects checkout that is incomplete or unpaid", async () => {
  for (const session of [
    paidSession({ status: "open" }),
    paidSession({ payment_status: "unpaid" }),
    paidSession({ status: "expired", payment_status: "unpaid" }),
  ]) {
    const { stripe } = fakeStripe(session);
    await rejectsStoreError(() => verifyOrder(stripe, session.id, accessToken), 409, /not complete|expired/);
  }
});

test("verification rejects foreign, obsolete, malformed, or forged pricing metadata", async () => {
  const cases = [
    paidSession({ metadata: { ...paidSession().metadata, store: "foreign-store" } }),
    paidSession({ metadata: { ...paidSession().metadata, version: "obsolete" } }),
    paidSession({ mode: "subscription" }),
    paidSession({ metadata: { ...paidSession().metadata, templates: "storefront,storefront" } }),
    paidSession({ metadata: { ...paidSession().metadata, templates: "unknown" } }),
    paidSession({ metadata: { ...paidSession().metadata, subagents: "yes" } }),
    paidSession({ metadata: { ...paidSession().metadata, skill_tree: "yes" } }),
    paidSession({ metadata: { ...paidSession().metadata, app_icon: "yes" } }),
    paidSession({ metadata: { ...paidSession().metadata, currency: "cad" } }),
    paidSession({ metadata: { ...paidSession().metadata, pricing_origin: "https://runsit.ca" } }),
    paidSession({ metadata: { ...paidSession().metadata, currency: undefined } }),
    paidSession({ metadata: { ...paidSession().metadata, pricing_origin: undefined } }),
    paidSession({ metadata: { ...paidSession().metadata, pricing_origin: "https://runs-it.com.evil.example" } }),
  ];
  for (const session of cases) {
    const { stripe } = fakeStripe(session);
    await rejectsStoreError(() => verifyOrder(stripe, session.id, accessToken), 403, /does not belong|could not be verified/);
  }
});

test("verification accepts USD-only legacy pricing and validates entitled totals", async () => {
  const current = paidSession();
  const legacy = paidSession({
    metadata: { ...current.metadata, currency: undefined, pricing_origin: undefined },
    currency: "usd",
  });
  const legacyOrder = await verifyOrder(fakeStripe(legacy).stripe, legacy.id, accessToken);
  assert.equal(legacyOrder.subagents, false);
  assert.equal(legacyOrder.skillTree, false);
  assert.equal(legacyOrder.appIcon, false);

  const legacyCad = paidSession({
    metadata: { ...current.metadata, currency: undefined, pricing_origin: undefined },
    currency: "cad",
  });
  await rejectsStoreError(() => verifyOrder(fakeStripe(legacyCad).stripe, legacyCad.id, accessToken), 403, /amount could not be verified|could not be verified/);

  const addOn = paidSession({
    metadata: { ...paidSession().metadata, subagents: "true" },
    amount_subtotal: bundlePrice(ids.length, true),
    amount_total: bundlePrice(ids.length, true),
  });
  assert.equal((await verifyOrder(fakeStripe(addOn).stripe, addOn.id, accessToken)).subagents, true);

  const skillTree = paidSession({
    metadata: { ...paidSession().metadata, skill_tree: "true" },
    amount_subtotal: bundlePrice(ids.length, false, true),
    amount_total: bundlePrice(ids.length, false, true),
  });
  const skillOrder = await verifyOrder(fakeStripe(skillTree).stripe, skillTree.id, accessToken);
  assert.equal(skillOrder.subagents, false);
  assert.equal(skillOrder.skillTree, true);

  const both = paidSession({
    metadata: { ...paidSession().metadata, subagents: "true", skill_tree: "true" },
    amount_subtotal: bundlePrice(ids.length, true, true),
    amount_total: bundlePrice(ids.length, true, true),
  });
  const bothOrder = await verifyOrder(fakeStripe(both).stripe, both.id, accessToken);
  assert.equal(bothOrder.subagents, true);
  assert.equal(bothOrder.skillTree, true);

  const forged = paidSession({ metadata: { ...paidSession().metadata, subagents: "true" } });
  await rejectsStoreError(() => verifyOrder(fakeStripe(forged).stripe, forged.id, accessToken), 403, /amount could not be verified/);
  const forgedSkill = paidSession({ metadata: { ...paidSession().metadata, skill_tree: "true" } });
  await rejectsStoreError(() => verifyOrder(fakeStripe(forgedSkill).stripe, forgedSkill.id, accessToken), 403, /amount could not be verified/);
  const forgedIcon = paidSession({ metadata: { ...paidSession().metadata, app_icon: "true" } });
  await rejectsStoreError(() => verifyOrder(fakeStripe(forgedIcon).stripe, forgedIcon.id, accessToken), 403, /amount could not be verified/);
  const icon = paidSession({
    metadata: { ...paidSession().metadata, app_icon: "true" },
    amount_subtotal: bundlePrice(ids.length, false, false, true),
    amount_total: bundlePrice(ids.length, false, false, true),
  });
  assert.equal((await verifyOrder(fakeStripe(icon).stripe, icon.id, accessToken)).appIcon, true);
});

test("verification rejects missing or incorrect access token", async () => {
  const session = paidSession();
  const { stripe } = fakeStripe(session);
  await rejectsStoreError(() => verifyOrder(stripe, session.id, "cd".repeat(32)), 403, /private access link/);
  await rejectsStoreError(() => verifyOrder(stripe, session.id, "bad-token"), 403, /private access link/);
  const missingHash = paidSession({ metadata: { ...session.metadata, access_hash: undefined } });
  await rejectsStoreError(() => verifyOrder(fakeStripe(missingHash).stripe, missingHash.id, accessToken), 403, /private access link/);
});

test("verification rejects session currency, subtotal, or total mismatches", async () => {
  for (const session of [
    paidSession({ currency: "cad" }),
    paidSession({ amount_subtotal: bundlePrice(ids.length) - 1 }),
    paidSession({ amount_total: bundlePrice(ids.length) + 1 }),
  ]) {
    const { stripe } = fakeStripe(session);
    await rejectsStoreError(() => verifyOrder(stripe, session.id, accessToken), 403, /amount could not be verified/);
  }
});

test("verification pauses access for refunds and disputes", async () => {
  for (const charge of [
    { refunded: true, amount_refunded: bundlePrice(ids.length), disputed: false },
    { refunded: false, amount_refunded: 1, disputed: false },
    { refunded: false, amount_refunded: 0, disputed: true },
  ]) {
    const base = paidSession();
    const session = paidSession({ payment_intent: { ...(base.payment_intent as object), latest_charge: { id: "ch_test", object: "charge", ...charge } } });
    const { stripe } = fakeStripe(session);
    await rejectsStoreError(() => verifyOrder(stripe, session.id, accessToken), 403, /refunded or disputed/);
  }
});

test("verification waits for an expanded latest charge", async () => {
  for (const paymentIntent of ["pi_test", { id: "pi_test", object: "payment_intent", latest_charge: null }, { id: "pi_test", object: "payment_intent", latest_charge: "ch_test" }]) {
    const session = paidSession({ payment_intent: paymentIntent });
    await rejectsStoreError(() => verifyOrder(fakeStripe(session).stripe, session.id, accessToken), 409, /could not be verified yet/);
  }
});

test("a valid paid order returns exact purchased IDs and marks delivery once", async () => {
  const session = paidSession();
  const fake = fakeStripe(session);
  const order = await fulfillOrder(fake.stripe, session.id, accessToken);
  assert.deepEqual(order.ids, ids);
  assert.equal(order.subagents, false);
  assert.equal(order.skillTree, false);
  assert.equal(fake.updates.length, 1);
  assert.deepEqual(fake.updates[0], { id: session.id, params: { metadata: { delivery: "available" } } });

  const delivered = paidSession({ metadata: { ...session.metadata, delivery: "available" } });
  const deliveredFake = fakeStripe(delivered);
  assert.deepEqual((await fulfillOrder(deliveredFake.stripe, delivered.id, accessToken)).ids, ids);
  assert.equal(deliveredFake.updates.length, 0);
});

test("Stripe SDK accepts a valid webhook signature and rejects a changed body", async () => {
  const stripe = new Stripe("sk_test_placeholder");
  const secret = "whsec_test_secret";
  const payload = JSON.stringify({ id: "evt_test", object: "event", type: "checkout.session.completed", data: { object: paidSession() } });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  const event = await stripe.webhooks.constructEventAsync(payload, signature, secret, undefined, Stripe.createSubtleCryptoProvider());
  assert.equal(event.id, "evt_test");
  await assert.rejects(
    stripe.webhooks.constructEventAsync(`${payload} `, signature, secret, undefined, Stripe.createSubtleCryptoProvider()),
    /signature/i,
  );
});
