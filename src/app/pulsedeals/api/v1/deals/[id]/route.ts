import {
  apiError,
  apiJson,
  enforceRateLimit,
  getAdminClient,
  getClientKey,
  handleApiError,
  mapDeal,
  requireActiveSubscription,
  requireMarketplaceAccess,
  requireSession,
} from "@/lib/pulsedeals/server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireSession(request);
    const admin = getAdminClient();
    await requireActiveSubscription(admin, session.sub);
    const accountLimit = await enforceRateLimit(request, admin, `deal:account:${session.sub}`, 60, 60);
    if (accountLimit) return accountLimit;
    const deviceLimit = await enforceRateLimit(request, admin, `deal:client:${getClientKey(request, session.sub)}`, 100, 60);
    if (deviceLimit) return deviceLimit;
    const { id } = await params;
    const market = new URL(request.url).searchParams.get("marketplace");
    const query = admin.from("pulsedeals_deals").select("*");
    if (/^[A-Z0-9]{10}$/.test(id) && ["de", "uk", "es", "fr", "it"].includes(market ?? "")) {
      query.eq("asin", id).eq("marketplace", market!);
    } else if (/^[0-9a-f-]{36}$/i.test(id)) { query.eq("id", id); }
    else { return apiError(request, 422, "invalid_deal", "A valid deal and marketplace are required."); }
    const result = await query.maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return apiError(request, 404, "not_found", "Deal not found.");
    await requireMarketplaceAccess(admin, session.sub, result.data.marketplace);
    return apiJson(request, { ok: true, data: mapDeal(result.data as Record<string, unknown>) });
  } catch (error) {
    return handleApiError(request, error);
  }
}
