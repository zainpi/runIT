import "server-only";
import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { purchasedIds } from "./payment";

// Server-side Purchase events for Meta (Conversions API), sent from the Stripe
// webhook so private order links never reach the browser pixel. Configure with
// NEXT_PUBLIC_META_PIXEL_ID and META_CONVERSIONS_API_TOKEN; either missing = off.
// META_TEST_EVENT_CODE routes events to Events Manager's Test Events tab.

const GRAPH = "https://graph.facebook.com/v21.0";
const cookie = /^fb\.[0-9]\.[0-9]{10,16}\.[A-Za-z0-9_.-]{1,200}$/;

const sha256 = (value: string) => createHash("sha256").update(value.trim().toLowerCase()).digest("hex");

/** Browser IDs Meta uses to match a purchase to an ad click, read from the checkout request's cookies. */
export function metaBrowserIds(request: Request): { meta_fbp?: string; meta_fbc?: string } {
  const cookies = Object.fromEntries((request.headers.get("cookie") ?? "").split(";").map((part) => {
    const at = part.indexOf("=");
    return at < 0 ? ["", ""] : [part.slice(0, at).trim(), decodeURIComponent(part.slice(at + 1).trim())];
  }));
  return {
    ...(cookie.test(cookies._fbp ?? "") ? { meta_fbp: cookies._fbp } : {}),
    ...(cookie.test(cookies._fbc ?? "") ? { meta_fbc: cookies._fbc } : {}),
  };
}

export function purchaseEvent(session: Stripe.Checkout.Session, eventTime: number) {
  const metadata = session.metadata ?? {};
  const email = session.customer_details?.email;
  const country = session.customer_details?.address?.country;
  const ids = purchasedIds(session);
  return {
    event_name: "Purchase",
    event_time: eventTime,
    event_id: session.id,
    action_source: "website",
    event_source_url: `${metadata.pricing_origin ?? "https://runsit.ca"}/templates/`,
    user_data: {
      ...(email ? { em: [sha256(email)] } : {}),
      ...(country ? { country: [sha256(country)] } : {}),
      ...(metadata.meta_fbp ? { fbp: metadata.meta_fbp } : {}),
      ...(metadata.meta_fbc ? { fbc: metadata.meta_fbc } : {}),
    },
    custom_data: {
      value: (session.amount_total ?? 0) / 100,
      currency: (session.currency ?? "usd").toUpperCase(),
      content_ids: ids,
      content_type: "product",
      num_items: ids.length,
    },
  };
}

/** Best effort: a Meta outage must never fail the Stripe webhook or block fulfillment. */
export async function sendMetaPurchase(env: Record<string, unknown>, session: Stripe.Checkout.Session, eventTime: number, fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const pixel = typeof env.NEXT_PUBLIC_META_PIXEL_ID === "string" ? env.NEXT_PUBLIC_META_PIXEL_ID : process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "";
  const token = typeof env.META_CONVERSIONS_API_TOKEN === "string" ? env.META_CONVERSIONS_API_TOKEN : "";
  const testCode = typeof env.META_TEST_EVENT_CODE === "string" ? env.META_TEST_EVENT_CODE : "";
  if (!/^\d{5,20}$/.test(pixel) || !token) return false;
  // Test-mode checkouts are only reported while a test event code is set.
  if (!session.livemode && !testCode) return false;
  // Fully discounted orders are not revenue and would mislead purchase optimization.
  if (!session.amount_total) return false;
  try {
    const response = await fetchImpl(`${GRAPH}/${pixel}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ data: [purchaseEvent(session, eventTime)], ...(testCode ? { test_event_code: testCode } : {}) }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) console.error(`Meta Conversions API rejected a purchase event (${response.status}).`);
    return response.ok;
  } catch {
    console.error("Meta Conversions API could not be reached.");
    return false;
  }
}
