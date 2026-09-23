import "server-only";
import Stripe from "stripe";
import { createHash, timingSafeEqual } from "node:crypto";
import { discountedCents, discountedBundlePrice, parseTemplateIds, SKILL_TREE_ADDON_CENTS, SUBAGENT_ADDON_CENTS, templateCatalog, templateCurrencyForHostname, TEMPLATE_VERSION, type TemplateCurrency, type TemplateId } from "./catalog";
import { referralForMetadata, type TemplateReferral } from "./referrals";

export const TEMPLATE_STORE = "runit-ai-templates";
export class StoreError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function tokenHash(token: string): string { return createHash("sha256").update(token).digest("hex"); }
export function validAccessToken(value: unknown): value is string { return typeof value === "string" && /^[a-f0-9]{64}$/.test(value); }
export function validSessionId(value: unknown): value is string { return typeof value === "string" && /^cs_(test_|live_)?[A-Za-z0-9]{16,240}$/.test(value); }

export function checkoutParameters(ids: TemplateId[], token: string, origin: string, subagents = false, skillTree = false, referral?: TemplateReferral): Stripe.Checkout.SessionCreateParams {
  const currency = templateCurrencyForHostname(new URL(origin).hostname);
  const discountPercent = referral?.discountPercent ?? 0;
  const discounted = (cents: number) => discountedCents(cents, discountPercent);
  const referralMetadata: Record<string, string> = referral ? { referral_founder: referral.founderSlug, referral_code_hash: referral.codeDigest, referral_discount_percent: String(referral.discountPercent) } : {};
  const metadata = { store: TEMPLATE_STORE, version: TEMPLATE_VERSION, templates: ids.join(","), access_hash: tokenHash(token), subagents: String(subagents), skill_tree: String(skillTree), currency, pricing_origin: origin, ai_messages: "20", ai_overviews: "one_per_template", ...referralMetadata };
  return {
    mode: "payment",
    // This store uses standard Checkout, including custom text and fixed totals.
    // Override accounts that enable Managed Payments by default.
    managed_payments: { enabled: false },
    adaptive_pricing: { enabled: false },
    integration_identifier: "runit_templates_qmvptnks",
    success_url: `${origin}/templates/library/#session_id={CHECKOUT_SESSION_ID}&access=${token}`,
    cancel_url: `${origin}/templates/?canceled=1`,
    line_items: [...ids.map((id, index) => ({
      quantity: 1,
      price_data: { currency, unit_amount: discounted(index === 0 ? 999 : 500), product_data: {
        name: `${templateCatalog.find((item) => item.id === id)!.title} — AI build prompt`,
        description: index === 0 ? "First template in this order. Digital text download." : "Additional template in this order. Digital text download.",
      } },
    })), ...(subagents ? [{ quantity: 1, price_data: { currency, unit_amount: discounted(SUBAGENT_ADDON_CENTS), product_data: { name: "Subagent build workflow add-on", description: "One add-on for every template in this order. Digital text download." } } }] : []), ...(skillTree ? [{ quantity: 1, price_data: { currency, unit_amount: discounted(SKILL_TREE_ADDON_CENTS), product_data: { name: "Skill tree setup add-on", description: "Skill source links and installation prompt for every template in this order. Digital text download." } } }] : [])],
    metadata,
    payment_intent_data: { metadata: { store: TEMPLATE_STORE, templates: ids.join(","), subagents: String(subagents), skill_tree: String(skillTree), currency, pricing_origin: origin, ...referralMetadata } },
    custom_text: { submit: { message: "After payment, return to the website and save your unique purchase URL to access your prompts again. Includes free template overviews and 20 AI editing messages per purchase. Coding AI tools, hosting, and other service fees are separate." } },
  };
}

export function purchasedIds(session: Stripe.Checkout.Session): TemplateId[] {
  const metadata = session.metadata;
  if (metadata?.store !== TEMPLATE_STORE || metadata.version !== TEMPLATE_VERSION || session.mode !== "payment") throw new StoreError("This order does not belong to the template store.", 403);
  let ids: TemplateId[];
  try { ids = parseTemplateIds(metadata.templates?.split(",")); }
  catch { throw new StoreError("This order could not be verified. Contact support with your receipt.", 403); }
  const rawSubagents = session.metadata?.subagents;
  if (rawSubagents !== undefined && rawSubagents !== "true" && rawSubagents !== "false") throw new StoreError("This order could not be verified. Contact support with your receipt.", 403);
  const subagents = rawSubagents === "true";
  const rawSkillTree = session.metadata?.skill_tree;
  if (rawSkillTree !== undefined && rawSkillTree !== "true" && rawSkillTree !== "false") throw new StoreError("This order could not be verified. Contact support with your receipt.", 403);
  const skillTree = rawSkillTree === "true";
  const hasReferralMetadata = metadata.referral_founder !== undefined || metadata.referral_code_hash !== undefined || metadata.referral_discount_percent !== undefined;
  const referral = hasReferralMetadata
    ? referralForMetadata(metadata.referral_founder, metadata.referral_code_hash, metadata.referral_discount_percent)
    : undefined;
  if (hasReferralMetadata && !referral) throw new StoreError("This referral discount could not be verified. Contact support with your receipt.", 403);
  // Orders issued before domain pricing were USD. Verify saved order terms,
  // not the domain a buyer happens to use when reopening their private link.
  let currency: TemplateCurrency = "usd";
  if (metadata.currency !== undefined || metadata.pricing_origin !== undefined) {
    try {
      const pricingOrigin = new URL(metadata.pricing_origin ?? "");
      const local = ["localhost", "127.0.0.1", "[::1]"].includes(pricingOrigin.hostname);
      if (pricingOrigin.origin !== metadata.pricing_origin || pricingOrigin.username || pricingOrigin.password || !(pricingOrigin.protocol === "https:" || (local && pricingOrigin.protocol === "http:"))) throw new Error();
      currency = templateCurrencyForHostname(pricingOrigin.hostname);
      if (metadata.currency !== currency) throw new Error();
    } catch { throw new StoreError("The payment amount could not be verified. Contact support.", 403); }
  }
  const expectedTotal = discountedBundlePrice(ids.length, subagents, skillTree, referral?.discountPercent ?? 0);
  if (session.currency !== currency || session.amount_subtotal !== expectedTotal || session.amount_total !== expectedTotal) throw new StoreError("The payment amount could not be verified. Contact support.", 403);
  return ids;
}

export async function verifyOrder(stripe: Stripe, sessionId: string, token?: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent.latest_charge"] });
  const ids = purchasedIds(session);
  const subagents = session.metadata?.subagents === "true";
  const skillTree = session.metadata?.skill_tree === "true";
  if (token !== undefined) {
    const expected = session.metadata?.access_hash ?? "";
    if (!validAccessToken(token) || !/^[a-f0-9]{64}$/.test(expected) || !timingSafeEqual(Buffer.from(tokenHash(token), "hex"), Buffer.from(expected, "hex"))) throw new StoreError("Use the private access link saved with this order.", 403);
  }
  if (session.status !== "complete" || session.payment_status !== "paid") throw new StoreError(session.status === "expired" ? "This checkout expired. Return to the store to try again." : "Your payment is not complete yet. If you have paid, wait a moment and check again.", 409);
  const intent = session.payment_intent;
  const charge = typeof intent === "object" && intent ? intent.latest_charge : null;
  if (!charge || typeof charge === "string") throw new StoreError("The payment could not be verified yet. Please check again.", 409);
  if (charge.refunded || charge.amount_refunded > 0 || charge.disputed) throw new StoreError("Access for this refunded or disputed order is paused. Contact support with your receipt.", 403);
  return { session, ids, subagents, skillTree };
}

// Both the signed webhook and the return/download flow call this operation.
// Stripe is the durable order ledger; retries write the same deterministic value.
export async function fulfillOrder(stripe: Stripe, sessionId: string, token?: string) {
  const order = await verifyOrder(stripe, sessionId, token);
  if (order.session.metadata?.delivery !== "available") {
    await stripe.checkout.sessions.update(sessionId, { metadata: { delivery: "available" } });
  }
  return order;
}
