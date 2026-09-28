// Meta Pixel for the AI templates store. Configured with NEXT_PUBLIC_META_PIXEL_ID
// at build time; without it nothing loads and every call is a no-op.
//
// Private purchase and trial links carry their access key in the URL fragment,
// and the pixel reports the page URL, so it must never fire on those pages.
// Purchases are sent server-side (Conversions API) from the Stripe webhook.

export const META_PIXEL_ID = /^\d{5,20}$/.test(process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "") ? process.env.NEXT_PUBLIC_META_PIXEL_ID! : "";

type Fbq = (...args: unknown[]) => void;
declare global { interface Window { fbq?: Fbq; __metaPending?: [string, Record<string, unknown> | undefined][] } }

/** True where the pixel must stay silent: private order/trial pages or any URL holding an access key. */
export function isPrivateLocation(location: Pick<Location, "pathname" | "hash" | "search">): boolean {
  return /^\/templates\/(library|trial)(\/|$)/.test(location.pathname) || /(^|[#&?])(access|session_id)=/.test(`${location.hash}${location.search}`);
}

export function metaTrack(event: "PageView" | "ViewContent" | "AddToCart" | "InitiateCheckout", params?: Record<string, unknown>) {
  if (!META_PIXEL_ID || typeof window === "undefined" || isPrivateLocation(window.location)) return;
  // Events sent before the loader runs (e.g. on first render) wait for it in a short queue.
  if (typeof window.fbq !== "function") { const pending = (window.__metaPending ??= []); if (pending.length < 20) pending.push([event, params]); return; }
  try { window.fbq("track", event, params); } catch { /* Tracking must never break the store. */ }
}

/** Cents to the decimal value and ISO code Meta expects. */
export function metaValue(cents: number, currency: string) {
  return { value: Math.round(cents) / 100, currency: currency.toUpperCase() };
}
