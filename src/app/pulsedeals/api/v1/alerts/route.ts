import {
  apiError,
  apiJson,
  checkBodySize,
  claimIdempotency,
  enforceRateLimit,
  getAdminClient,
  handleApiError,
  requireActiveSubscription,
  requireMarketplaceAccess,
  requireSession,
} from "@/lib/pulsedeals/server";
import { PULSE_CATEGORIES, PULSE_MARKETPLACES } from "@/lib/pulsedeals/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const tooLarge = checkBodySize(request, 12_000);
  if (tooLarge) return tooLarge;
  try {
    const session = await requireSession(request);
    const admin = getAdminClient();
    await requireActiveSubscription(admin, session.sub);
    const limit = await enforceRateLimit(request, admin, `alerts:${session.sub}`, 10, 3_600);
    if (limit) return limit;
    if (!(await claimIdempotency(admin, session.sub, "alerts", request))) {
      return apiError(request, 409, "duplicate_request", "This alert request has already been accepted.");
    }

    const body = (await request.json()) as {
      name?: string;
      categories?: string[];
      minDiscount?: number;
      minPrice?: number | null;
      maxPrice?: number | null;
      marketplace?: string;
      minHeat?: number;
      cadence?: string;
      keyword?: string;
      isEnabled?: boolean;
    };
    const categories = Array.isArray(body.categories)
      ? body.categories.filter((category) => (PULSE_CATEGORIES as readonly string[]).includes(category)).slice(0, 8)
      : [];
    const marketplace = body.marketplace && (PULSE_MARKETPLACES as readonly string[]).includes(body.marketplace)
      ? body.marketplace
      : "uk";
    const cadence = body.cadence === "batched" || body.cadence === "digest" ? body.cadence : "instant";
    if (!body.name?.trim()) return apiError(request, 422, "invalid_request", "Alert name is required.");

    await requireMarketplaceAccess(admin, session.sub, marketplace);
    const result = await admin
      .from("pulsedeals_alerts")
      .insert({
        account_id: session.sub,
        name: body.name.trim().slice(0, 120),
        categories,
        min_discount: Math.min(100, Math.max(0, Math.floor(Number(body.minDiscount ?? 30)))),
        min_price: body.minPrice == null ? null : Math.max(0, Number(body.minPrice)),
        max_price: body.maxPrice == null ? null : Math.max(0, Number(body.maxPrice)),
        marketplace,
        min_heat: Math.min(100, Math.max(0, Math.floor(Number(body.minHeat ?? 50)))),
        cadence,
        keyword: String(body.keyword ?? "").trim().slice(0, 120),
        is_enabled: body.isEnabled !== false,
      })
      .select("id, name, categories, min_discount, min_price, max_price, marketplace, min_heat, cadence, keyword, is_enabled, created_at")
      .single();
    if (result.error) throw result.error;
    return apiJson(request, { ok: true, data: result.data });
  } catch (error) {
    return handleApiError(request, error);
  }
}

// Stable client IDs make offline edits and retries safe without duplicating rules.
export async function PUT(request: Request) {
  const tooLarge = checkBodySize(request, 12_000);
  if (tooLarge) return tooLarge;
  try {
    const session = await requireSession(request);
    const admin = getAdminClient();
    // Pausing existing alerts remains possible after subscription expiry.
    const limit = await enforceRateLimit(request, admin, `alerts-sync:${session.sub}`, 120, 3_600);
    if (limit) return limit;
    const body = await request.json();
    const validNumber = (value: unknown, min: number, max: number) =>
      typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
    if (typeof body.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id) ||
        typeof body.name !== "string" || !body.name.trim() || body.name.length > 120 ||
        !Array.isArray(body.categories) || body.categories.length > 8 ||
        !body.categories.every((c: string) => (PULSE_CATEGORIES as readonly string[]).includes(c)) ||
        !(PULSE_MARKETPLACES as readonly string[]).includes(body.marketplace) ||
        !["instant", "batched", "digest"].includes(body.cadence) ||
        !validNumber(body.minDiscount, 0, 100) || !validNumber(body.minHeat, 0, 100) ||
        (body.minPrice != null && !validNumber(body.minPrice, 0, 100_000)) ||
        (body.maxPrice != null && !validNumber(body.maxPrice, 0, 100_000)) ||
        (body.minPrice != null && body.maxPrice != null && body.minPrice > body.maxPrice) ||
        typeof body.keyword !== "string" || body.keyword.length > 120 || typeof body.isEnabled !== "boolean" ||
        typeof body.primeOnly !== "boolean" || typeof body.fbaOnly !== "boolean") {
      return apiError(request, 422, "invalid_alert", "Check the alert name, filters, and price range.");
    }
    if (body.isEnabled) await requireMarketplaceAccess(admin, session.sub, body.marketplace);
    const result = await admin.from("pulsedeals_alerts").upsert({
      account_id: session.sub, client_id: body.id, name: body.name.trim(), categories: body.categories,
      min_discount: Math.round(body.minDiscount), min_heat: Math.round(body.minHeat),
      min_price: body.minPrice ?? null, max_price: body.maxPrice ?? null,
      marketplace: body.marketplace, cadence: body.cadence, keyword: body.keyword.trim(),
      is_enabled: body.isEnabled, prime_only: body.primeOnly, fba_only: body.fbaOnly,
      updated_at: new Date().toISOString(),
    }, { onConflict: "account_id,client_id" });
    if (result.error) throw result.error;
    return apiJson(request, { ok: true });
  } catch (error) { return handleApiError(request, error); }
}
