import { PULSE_CATEGORIES, PULSE_MARKETPLACES, type PulseCategory, type PulseMarketplace } from "./types";

export const MAX_DEAL_INGEST_BYTES = 24_000;
export const DEAL_INGEST_SIGNATURE_AGE_SECONDS = 5 * 60;

const textEncoder = new TextEncoder();
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
const AMAZON_IMAGE_HOSTS = new Set([
  "images-na.ssl-images-amazon.com",
  "m.media-amazon.com",
]);

export class DealIngestPayloadTooLargeError extends Error {}
export class InvalidDealIngestPayloadError extends Error {}

export type IngestedDealRow = {
  asin: string;
  marketplace: PulseMarketplace;
  title: string;
  category: PulseCategory;
  current_price: number;
  reference_price: number;
  average90_day_price: number;
  score: number;
  confidence: number;
  reasoning: string;
  minutes_ago: number;
  seller: string;
  seller_rating: number;
  is_fba: boolean;
  is_prime: boolean;
  status: "live";
  icon_name: string;
  keepa_updated_at: string | null;
  observed_at: string;
  raw: {
    source: "keepabot-dealsbrowser";
    routingTier: string | null;
  };
  updated_at: string;
  image_url?: string;
  offer_listing_id?: string;
};

function fail(): never {
  throw new InvalidDealIngestPayloadError("Invalid PulseDeals deal payload");
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail();
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") fail();
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) fail();
  return normalized;
}

function optionalString(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  return requiredString(value, maxLength);
}

function numberInRange(value: unknown, minimum: number, maximum: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) fail();
  return value;
}

function optionalBoolean(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value !== "boolean") fail();
  return value;
}

function inferCategory(title: string, hint: unknown): PulseCategory {
  if (typeof hint === "string" && (PULSE_CATEGORIES as readonly string[]).includes(hint.toLowerCase())) {
    return hint.toLowerCase() as PulseCategory;
  }
  const source = `${title} ${typeof hint === "string" ? hint : ""}`.toLowerCase();
  if (/lego|toy|puzzle|game set|building set/.test(source)) return "toys";
  if (/shirt|jacket|shoe|dress|parka|fashion/.test(source)) return "fashion";
  if (/beauty|skin|shampoo|makeup|cosmetic/.test(source)) return "beauty";
  if (/baby|kid|stroller|diaper|child/.test(source)) return "baby";
  if (/drill|tool|wrench|automotive|auto|charger/.test(source)) return "tools";
  if (/sport|fitness|camping|hiking|bike/.test(source)) return "sports";
  if (/kitchen|air fryer|vacuum|mixer|home|furniture|bed/.test(source)) return "home";
  return "tech";
}

function optionalAmazonImageURL(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  const raw = requiredString(value, 2_048);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    fail();
  }
  if (url.protocol !== "https:" || !AMAZON_IMAGE_HOSTS.has(url.hostname)) fail();
  return url.toString();
}

function optionalTimestamp(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  const raw = requiredString(value, 64);
  const milliseconds = Date.parse(raw);
  if (!Number.isFinite(milliseconds)) fail();
  return new Date(milliseconds).toISOString();
}

function roundedCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function decodedHex(value: string): Uint8Array | null {
  if (!/^[0-9a-f]{64}$/i.test(value)) return null;
  const result = new Uint8Array(32);
  for (let index = 0; index < result.length; index += 1) {
    result[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return result;
}

export async function readBoundedRequestBody(
  request: Request,
  maxBytes = MAX_DEAL_INGEST_BYTES,
): Promise<Uint8Array> {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new DealIngestPayloadTooLargeError("PulseDeals ingest payload is too large");
  }
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) {
      await reader.cancel();
      throw new DealIngestPayloadTooLargeError("PulseDeals ingest payload is too large");
    }
    chunks.push(value);
  }

  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function verifyDealIngestSignature(
  body: Uint8Array,
  timestampHeader: string | null,
  signatureHeader: string | null,
  secret: string,
  now = Date.now(),
): Promise<boolean> {
  if (!/^\d{10}$/.test(timestampHeader ?? "")) return false;
  const timestamp = Number(timestampHeader);
  if (Math.abs(Math.floor(now / 1_000) - timestamp) > DEAL_INGEST_SIGNATURE_AGE_SECONDS) return false;
  const signatureMatch = /^v1=([0-9a-f]{64})$/i.exec(signatureHeader ?? "");
  const signature = signatureMatch ? decodedHex(signatureMatch[1]) : null;
  if (!signature) return false;

  const prefix = textEncoder.encode(`${timestampHeader}.`);
  const signed = new Uint8Array(prefix.byteLength + body.byteLength);
  signed.set(prefix);
  signed.set(body, prefix.byteLength);
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    signature as unknown as BufferSource,
    signed as unknown as BufferSource,
  );
}

export function normalizeIngestedDeal(value: unknown, now = new Date()): IngestedDealRow {
  const body = record(value);
  const asin = requiredString(body.asin, 10).toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(asin)) fail();
  const marketplaceValue = requiredString(body.marketplace, 2).toLowerCase();
  if (!(PULSE_MARKETPLACES as readonly string[]).includes(marketplaceValue)) fail();
  const marketplace = marketplaceValue as PulseMarketplace;
  const title = requiredString(body.title, 300);
  const currentPrice = roundedCurrency(numberInRange(body.currentPrice, 0.01, 1_000_000));
  const referencePrice = roundedCurrency(numberInRange(body.referencePrice, 0.01, 1_000_000));
  const average90DayPrice = roundedCurrency(numberInRange(body.average90DayPrice, 0.01, 1_000_000));
  const score = Math.round(numberInRange(body.score, 0, 100));
  const confidence = Math.round(numberInRange(body.confidence ?? 0, 0, 100));
  const category = inferCategory(title, body.category);
  const keepaUpdatedAt = optionalTimestamp(body.keepaUpdatedAt);
  const imageURL = optionalAmazonImageURL(body.imageURL);
  const offerListingID = optionalString(body.offerListingID, 512);
  const routingTier = optionalString(body.routingTier, 32);
  const sellerRating = roundedCurrency(numberInRange(body.sellerRating ?? 0, 0, 5));
  const observedAt = now.toISOString();
  const keepaAge = keepaUpdatedAt ? Math.max(0, now.getTime() - Date.parse(keepaUpdatedAt)) : 0;
  const reasoning = optionalString(body.reasoning, 1_000)
    ?? `KeepaBot approved this deal with a ${score}/100 buying score.`;

  const row: IngestedDealRow = {
    asin,
    marketplace,
    title,
    category,
    current_price: currentPrice,
    reference_price: referencePrice,
    average90_day_price: average90DayPrice,
    score,
    confidence,
    reasoning,
    minutes_ago: Math.floor(keepaAge / 60_000),
    seller: optionalString(body.seller, 160) ?? "Amazon",
    seller_rating: sellerRating,
    is_fba: optionalBoolean(body.isFBA),
    is_prime: optionalBoolean(body.isPrime),
    status: "live",
    icon_name: CATEGORY_ICONS[category],
    keepa_updated_at: keepaUpdatedAt,
    observed_at: observedAt,
    raw: { source: "keepabot-dealsbrowser", routingTier },
    updated_at: observedAt,
  };
  if (imageURL) row.image_url = imageURL;
  if (offerListingID) row.offer_listing_id = offerListingID;
  return row;
}
