import type { SupabaseClient } from "@supabase/supabase-js";

import { HEATER_MARKETPLACES, type HeaterCategory, type HeaterMarketplace } from "./types";

const KEEPA_API = "https://api.keepa.com";
const KEEPA_EPOCH = Date.UTC(2011, 0, 1);
const DOMAIN_IDS: Record<HeaterMarketplace, number> = { us: 1, uk: 2, de: 3, ca: 6 };
const CATEGORY_ICONS: Record<HeaterCategory, string> = {
  tech: "gamecontroller.fill",
  home: "fork.knife",
  fashion: "tshirt.fill",
  beauty: "sparkles",
  baby: "figure.2.and.child.holdinghands",
  tools: "wrench.and.screwdriver.fill",
  toys: "puzzlepiece.fill",
  sports: "figure.run",
};

type KeepaDeal = Record<string, unknown>;
type KeepaProduct = Record<string, unknown>;

function requiredKeepaKey(): string {
  const key = process.env.KEEPA_API_KEY;
  if (!key) throw new Error("Missing server configuration: KEEPA_API_KEY");
  return key;
}

function keepaDate(value: unknown): string | null {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return new Date(KEEPA_EPOCH + minutes * 60_000).toISOString();
}

function positiveNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function keepaValue(value: unknown, priceType = 1): number | null {
  if (!Array.isArray(value)) return positiveNumber(value);
  if (!value.length) return null;
  if (Array.isArray(value[0])) return keepaValue(value[0], priceType);
  const preferred = positiveNumber(value[priceType]);
  if (preferred !== null) return preferred;
  for (const item of value) {
    const number = positiveNumber(item);
    if (number !== null) return number;
  }
  return null;
}

function priceFromKeepa(value: unknown): number | null {
  const number = keepaValue(value, 1);
  if (number === null) return null;
  return number / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function classify(title: string, rawCategory: string | undefined): HeaterCategory {
  const source = `${title} ${rawCategory ?? ""}`.toLowerCase();
  if (/lego|toy|puzzle|game set|building set/.test(source)) return "toys";
  if (/shirt|jacket|shoe|dress|parka|fashion/.test(source)) return "fashion";
  if (/beauty|skin|shampoo|makeup|cosmetic/.test(source)) return "beauty";
  if (/baby|kid|stroller|diaper|child/.test(source)) return "baby";
  if (/drill|tool|wrench|automotive|auto|charger/.test(source)) return "tools";
  if (/sport|fitness|camping|hiking|bike/.test(source)) return "sports";
  if (/kitchen|air fryer|vacuum|mixer|home|furniture|bed/.test(source)) return "home";
  return "tech";
}

function productMap(products: unknown): Map<string, KeepaProduct> {
  const map = new Map<string, KeepaProduct>();
  if (!Array.isArray(products)) return map;
  for (const product of products) {
    if (!product || typeof product !== "object") continue;
    const value = product as KeepaProduct;
    const asin = typeof value.asin === "string" ? value.asin : null;
    if (asin) map.set(asin, value);
  }
  return map;
}

async function keepaFetch(path: string, init: RequestInit, timeoutMs = 25_000): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${KEEPA_API}${path}`, { ...init, signal: controller.signal });
    const body = (await response.json()) as Record<string, unknown>;
    if (!response.ok) throw new Error(`Keepa request failed (${response.status})`);
    if (body.error) throw new Error("Keepa rejected the request");
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchDeals(marketplace: HeaterMarketplace): Promise<KeepaDeal[]> {
  const selection = {
    page: 0,
    domainId: DOMAIN_IDS[marketplace],
    // KeepaBot-master's production query uses price type 1 (NEW), while
    // product stats still fall back across the available price series.
    priceTypes: [1],
    deltaPercentRange: [30, 10000],
    currentRange: [1, 1000000],
    isRangeEnabled: true,
    isFilterEnabled: true,
    isOutOfStock: false,
    filterErotic: true,
    dateRange: 0,
    isLowest: true,
    singleVariation: true,
    hasReviews: true,
    sortType: 1,
  };
  const body = await keepaFetch(`/deal?key=${encodeURIComponent(requiredKeepaKey())}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(selection),
  });
  return Array.isArray(body.dr) ? body.dr.filter((item): item is KeepaDeal => Boolean(item && typeof item === "object")) : [];
}

async function fetchProducts(marketplace: HeaterMarketplace, asins: string[]): Promise<Map<string, KeepaProduct>> {
  if (!asins.length) return new Map();
  const query = new URLSearchParams({
    key: requiredKeepaKey(),
    domain: String(DOMAIN_IDS[marketplace]),
    asin: asins.slice(0, 50).join(","),
    stats: "365",
    history: "1",
  });
  try {
    const body = await keepaFetch(`/product?${query.toString()}`, { headers: { accept: "application/json" } });
    return productMap(body.products);
  } catch (error) {
    console.warn("Keepa product enrichment skipped:", error);
    return new Map();
  }
}

function currentPrice(deal: KeepaDeal, product: KeepaProduct | undefined): number | null {
  const stats = product?.stats as Record<string, unknown> | undefined;
  return priceFromKeepa(deal.current) ?? priceFromKeepa(deal.price) ?? priceFromKeepa(stats?.current);
}

function referencePrice(deal: KeepaDeal, current: number): number {
  const previous = priceFromKeepa(deal.previous);
  if (previous !== null && previous > current) return Number(previous.toFixed(2));
  const delta = Math.abs(Number(keepaValue(deal.delta, 1) ?? 0));
  const percent = Math.abs(Number(keepaValue(deal.deltaPercent, 1) ?? 0));
  if (delta !== null && delta < current * 20) return Number((current + delta / 100).toFixed(2));
  if (percent !== null && percent > 0 && percent < 99) return Number((current / (1 - percent / 100)).toFixed(2));
  return Number((current * 1.5).toFixed(2));
}

function score(current: number, reference: number, product: KeepaProduct | undefined, isPrime: boolean): number {
  const discount = reference > current ? ((reference - current) / reference) * 100 : 0;
  const rank = Number(product?.salesRank ?? 0);
  const rankBonus = rank > 0 ? clamp(15 - Math.log10(rank) * 2, 0, 15) : 0;
  return Math.round(clamp(discount * 0.82 + rankBonus + (isPrime ? 8 : 0), 0, 100));
}

function historyFromProduct(product: KeepaProduct | undefined): Array<{ date: string; price: number }> {
  const directHistory = product?.priceHistory;
  if (Array.isArray(directHistory)) {
    const normalized = directHistory
      .filter((point) => point && typeof point === "object")
      .slice(-30)
      .map((point) => {
        const value = point as Record<string, unknown>;
        const date = keepaDate(value.date ?? value.time);
        const price = priceFromKeepa(value.price ?? value.value);
        return date && price !== null ? { date, price: Number(price.toFixed(2)) } : null;
      })
      .filter((point): point is { date: string; price: number } => Boolean(point));
    if (normalized.length) return normalized;
  }

  // Keepa's product endpoint commonly exposes history as alternating time/price
  // values in csv[0] (the Amazon price series).
  const csv = product?.csv;
  const amazonSeries = Array.isArray(csv) && Array.isArray(csv[0]) ? csv[0] : null;
  if (!amazonSeries) return [];
  const points: Array<{ date: string; price: number }> = [];
  for (let index = 0; index + 1 < amazonSeries.length; index += 2) {
    const date = keepaDate(amazonSeries[index]);
    const price = priceFromKeepa(amazonSeries[index + 1]);
    if (date && price !== null) points.push({ date, price: Number(price.toFixed(2)) });
  }
  return points.slice(-30);
}

function productStats(product: KeepaProduct | undefined): Record<string, unknown> | undefined {
  return product?.stats && typeof product.stats === "object"
    ? product.stats as Record<string, unknown>
    : undefined;
}

function productOffer(product: KeepaProduct | undefined): Record<string, unknown> | undefined {
  const offers = product?.offers;
  if (!Array.isArray(offers)) return undefined;
  const buyBox = offers.find(
    (offer) => offer && typeof offer === "object" && (offer as Record<string, unknown>).isBuyBox,
  );
  if (buyBox && typeof buyBox === "object") return buyBox as Record<string, unknown>;
  const first = offers.find((offer) => offer && typeof offer === "object");
  return first && typeof first === "object" ? first as Record<string, unknown> : undefined;
}

function averagePrice(deal: KeepaDeal, product: KeepaProduct | undefined, current: number): number {
  const stats = productStats(product);
  return priceFromKeepa(deal.avg)
    ?? priceFromKeepa(stats?.avg90)
    ?? referencePrice(deal, current);
}

function normalizeDeal(deal: KeepaDeal, product: KeepaProduct | undefined, marketplace: HeaterMarketplace) {
  const asin = typeof deal.asin === "string" ? deal.asin : typeof product?.asin === "string" ? product.asin : null;
  const title = String(deal.title ?? product?.title ?? "Amazon deal").trim();
  const current = currentPrice(deal, product);
  if (!asin || !current || current <= 0) return null;
  const stats = productStats(product);
  const offer = productOffer(product);
  const reference = averagePrice(deal, product, current);
  const seller = String(product?.buyBoxSellerName ?? offer?.sellerName ?? deal.seller ?? "Amazon");
  const isPrime = Boolean(product?.isPrime ?? deal.isPrime ?? offer?.isPrime ?? product?.buyBoxIsPrime);
  const isFBA = Boolean(product?.isFBA ?? deal.isFBA ?? offer?.isFBA ?? product?.buyBoxIsFBA ?? /amazon/i.test(seller));
  const category = classify(title, typeof deal.categoryName === "string" ? deal.categoryName : undefined);
  const discount = reference > 0 ? ((reference - current) / reference) * 100 : 0;
  const observedAt = keepaDate(deal.lastUpdate ?? deal.lastChange) ?? new Date().toISOString();
  const avg90 = priceFromKeepa(stats?.avg90) ?? reference;
  const scoreValue = score(current, avg90, product, isPrime);
  const rawRating = Number(product?.rating ?? offer?.sellerRating ?? deal.rating ?? 0);
  const sellerRating = rawRating > 5 ? rawRating / 20 : rawRating;
  return {
    asin,
    marketplace,
    title: title.slice(0, 300),
    category,
    current_price: Number(current.toFixed(2)),
    reference_price: Number(reference.toFixed(2)),
    average90_day_price: Number(avg90.toFixed(2)),
    score: scoreValue,
    confidence: Math.round(clamp(70 + (isPrime ? 15 : 0) + (product ? 10 : 0), 0, 100)),
    reasoning: `Keepa recorded a ${Math.max(0, Math.round(discount))}% price drop for this ${category} deal.`,
    minutes_ago: Math.max(0, Math.round((Date.now() - new Date(observedAt).getTime()) / 60_000)),
    seller: seller.slice(0, 160),
    seller_rating: Number(sellerRating.toFixed(2)),
    is_fba: isFBA,
    is_prime: isPrime,
    status: "live",
    icon_name: CATEGORY_ICONS[category],
    price_history: historyFromProduct(product),
    offer_listing_id: typeof deal.offerListingId === "string"
      ? deal.offerListingId
      : typeof offer?.listingId === "string" ? offer.listingId : null,
    keepa_updated_at: observedAt,
    observed_at: new Date().toISOString(),
    raw: { source: "keepa", asin, marketplace, lastUpdate: deal.lastUpdate ?? null },
    updated_at: new Date().toISOString(),
  };
}

export async function syncMarketplace(admin: SupabaseClient, marketplace: HeaterMarketplace): Promise<{ marketplace: string; deals: number }> {
  const lock = await admin.rpc("claim_heater_sync_lock", { p_lock_key: `keepa:${marketplace}`, p_ttl_seconds: 240 });
  if (lock.error) throw lock.error;
  if (!lock.data) return { marketplace, deals: 0 };
  try {
    const deals = await fetchDeals(marketplace);
    const asins = deals.map((deal) => typeof deal.asin === "string" ? deal.asin : "").filter(Boolean);
    const products = await fetchProducts(marketplace, asins);
    const rows = deals
      .map((deal) => normalizeDeal(deal, products.get(String(deal.asin)), marketplace))
      .filter((row): row is NonNullable<ReturnType<typeof normalizeDeal>> => Boolean(row));
    if (rows.length) {
      const upsert = await admin.from("heater_deals").upsert(rows, { onConflict: "asin,marketplace" });
      if (upsert.error) throw upsert.error;
    }
    const staleBefore = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
    const stale = await admin
      .from("heater_deals")
      .update({ status: "burnedOut", updated_at: new Date().toISOString() })
      .eq("marketplace", marketplace)
      .eq("status", "live")
      .lt("observed_at", staleBefore);
    if (stale.error) throw stale.error;
    return { marketplace, deals: rows.length };
  } finally {
    await admin.rpc("release_heater_sync_lock", { p_lock_key: `keepa:${marketplace}` });
  }
}

export function scheduledMarketplace(): HeaterMarketplace {
  const index = Math.floor(Date.now() / (5 * 60_000)) % HEATER_MARKETPLACES.length;
  return HEATER_MARKETPLACES[index];
}
