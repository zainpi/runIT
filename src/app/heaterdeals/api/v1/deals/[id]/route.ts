import {
  apiError,
  apiJson,
  enforceRateLimit,
  getAdminClient,
  getClientKey,
  handleApiError,
  mapDeal,
  requireActiveSubscription,
  requireSession,
} from "@/lib/heaterdeals/server";

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
    const result = await admin.from("heater_deals").select("*").eq("id", id).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) return apiError(request, 404, "not_found", "Deal not found.");
    return apiJson(request, { ok: true, data: mapDeal(result.data as Record<string, unknown>) });
  } catch (error) {
    return handleApiError(request, error);
  }
}
