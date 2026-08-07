import {
  apiError,
  apiJson,
  checkBodySize,
  claimIdempotency,
  enforceRateLimit,
  getAdminClient,
  handleApiError,
  requireActiveSubscription,
  requireSession,
} from "@/lib/heaterdeals/server";
import { HEATER_CATEGORIES, HEATER_MARKETPLACES } from "@/lib/heaterdeals/types";

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
      ? body.categories.filter((category) => (HEATER_CATEGORIES as readonly string[]).includes(category)).slice(0, 8)
      : [];
    const marketplace = body.marketplace && (HEATER_MARKETPLACES as readonly string[]).includes(body.marketplace)
      ? body.marketplace
      : "us";
    const cadence = body.cadence === "batched" || body.cadence === "digest" ? body.cadence : "instant";
    if (!body.name?.trim()) return apiError(request, 422, "invalid_request", "Alert name is required.");

    const result = await admin
      .from("heater_alerts")
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
