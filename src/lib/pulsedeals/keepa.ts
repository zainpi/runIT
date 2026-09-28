import type { SupabaseClient } from "@supabase/supabase-js";

import { PULSE_MARKETPLACES, type PulseCategory, type PulseMarketplace } from "./types";

const KEEPA_API = "https://api.keepa.com";
const KEEPA_EPOCH = Date.UTC(2011, 0, 1);
const DOMAIN_IDS: Record<PulseMarketplace, number> = { de: 3, uk: 2, es: 9, fr: 4, it: 8 };
const CATEGORY_ICONS: Record<PulseCategory, string> = {
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

function classify(title: string, rawCategory: string | undefined): PulseCategory {
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

async function fetchDeals(marketplace: PulseMarketplace): Promise<KeepaDeal[]> {
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

async function fetchProducts(marketplace: PulseMarketplace, asins: string[]): Promise<Map<string, KeepaProduct>> {
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

function newPriceFromProduct(product: KeepaProduct): number | null {
  const stats = productStats(product);
  const current = stats?.current;
  if (!Array.isArray(current)) return null;
  const cents = positiveNumber(current[1]); // Keepa price type 1 is NEW.
  return cents === null ? null : Number((cents / 100).toFixed(2));
}

export async function refreshOpenedDeal(admin: SupabaseClient, marketplace: PulseMarketplace, asin: string): Promise<void> {
  const query = new URLSearchParams({
    key: requiredKeepaKey(), domain: String(DOMAIN_IDS[marketplace]), asin,
    stats: "90", update: "0", history: "1",
  });
  const body = await keepaFetch(`/product?${query.toString()}`, { headers: { accept: "application/json" } }, 20_000);
  const product = productMap(body.products).get(asin);
  if (!product) return;
  const price = newPriceFromProduct(product);
  const currentPrices = productStats(product)?.current;
  const outOfStock = Array.isArray(currentPrices) && currentPrices[1] === -1;
  const checkedAt = keepaDate(product.lastUpdate);
  if ((price === null && !outOfStock) || checkedAt === null) return;

  const existing = await admin.from("pulsedeals_deals")
    .select("current_price,reference_price,is_prime,keepa_updated_at")
    .eq("asin", asin).eq("marketplace", marketplace).maybeSingle();
  if (existing.error) throw existing.error;
  if (!existing.data || (existing.data.keepa_updated_at && Date.parse(existing.data.keepa_updated_at) > Date.parse(checkedAt))) return;

  const reference = Number(existing.data.reference_price);
  const isPrime = Boolean(existing.data.is_prime);
  const discount = price !== null && reference > price ? Math.round(((reference - price) / reference) * 100) : 0;
  const history = historyFromProduct(product);
  const update = await admin.from("pulsedeals_deals").update({
    current_price: price ?? Number(existing.data.current_price),
    score: discount && price !== null ? score(price, reference, product, isPrime) : 0,
    reasoning: outOfStock ? "Keepa found no current new offer for this product."
      : discount ? `Keepa recorded a ${discount}% price drop for this deal.` : "The earlier deal price is no longer available.",
    status: discount ? "live" : "burnedOut",
    ...(history.length ? { price_history: history } : {}),
    keepa_updated_at: checkedAt,
    observed_at: new Date().toISOString(),
    minutes_ago: 0,
    updated_at: new Date().toISOString(),
  }).eq("asin", asin).eq("marketplace", marketplace)
    .or(`keepa_updated_at.is.null,keepa_updated_at.lte.${checkedAt}`);
  if (update.error) throw update.error;
}

function currentPrice(deal: KeepaDeal, product: KeepaProduct | undefined): number | null {
  const stats = product?.stats as Record<string, unknown> | undefined;
  const dealUpdated = Number(deal.lastUpdate ?? deal.lastChange ?? 0);
  const productUpdated = Number(product?.lastUpdate ?? 0);
  if (product && productUpdated >= dealUpdated) {
    if (Array.isArray(stats?.current) && stats.current[1] === -1) return null;
    return newPriceFromProduct(product) ?? priceFromKeepa(deal.current) ?? priceFromKeepa(deal.price);
  }
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

  // Price type 1 (NEW) matches the price shown on PulseDeals cards.
  const csv = product?.csv;
  const newSeries = Array.isArray(csv) && Array.isArray(csv[1]) ? csv[1] : null;
  if (!newSeries) return [];
  const points: Array<{ date: string; price: number }> = [];
  for (let index = 0; index + 1 < newSeries.length; index += 2) {
    const date = keepaDate(newSeries[index]);
    const price = priceFromKeepa(newSeries[index + 1]);
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

function normalizeDeal(deal: KeepaDeal, product: KeepaProduct | undefined, marketplace: PulseMarketplace) {
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
  const observedAt = keepaDate(Math.max(Number(deal.lastUpdate ?? deal.lastChange ?? 0), Number(product?.lastUpdate ?? 0))) ?? new Date().toISOString();
  const avg90 = priceFromKeepa(stats?.avg90) ?? reference;
  const scoreValue = discount > 0 ? score(current, avg90, product, isPrime) : 0;
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
    reasoning: discount > 0
      ? `Keepa recorded a ${Math.round(discount)}% price drop for this ${category} deal.`
      : "The earlier deal price is no longer available.",
    minutes_ago: Math.max(0, Math.round((Date.now() - new Date(observedAt).getTime()) / 60_000)),
    seller: seller.slice(0, 160),
    seller_rating: Number(sellerRating.toFixed(2)),
    is_fba: isFBA,
    is_prime: isPrime,
    status: discount > 0 ? "live" : "burnedOut",
    icon_name: CATEGORY_ICONS[category],
    image_url: typeof product?.imagesCSV === "string" && /^[A-Za-z0-9+_.%-]+\.(jpg|png)$/.test(product.imagesCSV.split(",")[0])
      ? `https://m.media-amazon.com/images/I/${product.imagesCSV.split(",")[0]}` : null,
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

export async function syncMarketplace(admin: SupabaseClient, marketplace: PulseMarketplace): Promise<{ marketplace: string; deals: number }> {
  const lock = await admin.rpc("claim_pulsedeals_sync_lock", { p_lock_key: `keepa:${marketplace}`, p_ttl_seconds: 240 });
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
      const current = await admin.from("pulsedeals_deals").select("asin,keepa_updated_at")
        .eq("marketplace", marketplace).in("asin", rows.map((row) => row.asin));
      if (current.error) throw current.error;
      const newest = new Map((current.data ?? []).map((row) => [row.asin, String(row.keepa_updated_at ?? "")]));
      const freshRows = rows.filter((row) => Date.parse(row.keepa_updated_at) >= (Date.parse(newest.get(row.asin) ?? "") || 0));
      if (freshRows.length) {
        const upsert = await admin.from("pulsedeals_deals").upsert(freshRows, { onConflict: "asin,marketplace" });
        if (upsert.error) throw upsert.error;
      }
    }
    const staleBefore = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
    const stale = await admin
      .from("pulsedeals_deals")
      .update({ status: "burnedOut", updated_at: new Date().toISOString() })
      .eq("marketplace", marketplace)
      .eq("status", "live")
      .lt("observed_at", staleBefore);
    if (stale.error) throw stale.error;
    return { marketplace, deals: rows.length };
  } finally {
    await admin.rpc("release_pulsedeals_sync_lock", { p_lock_key: `keepa:${marketplace}` });
  }
}

export function scheduledMarketplace(): PulseMarketplace {
  const index = Math.floor(Date.now() / (5 * 60_000)) % PULSE_MARKETPLACES.length;
  return PULSE_MARKETPLACES[index];
}
