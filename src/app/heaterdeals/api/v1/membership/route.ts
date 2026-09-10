import { apiJson, checkBodySize, enforceRateLimit, getAdminClient, getMembership, handleApiError, requireSession } from "@/lib/heaterdeals/server";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const session = await requireSession(request), admin = getAdminClient();
    const limit = await enforceRateLimit(request, admin, `membership:${session.sub}`, 60, 60);
    if (limit) return limit;
    return apiJson(request, { data: await getMembership(admin, session.sub) });
  } catch (error) { return handleApiError(request, error); }
}
export async function PUT(request: Request) {
  const tooLarge = checkBodySize(request, 2_000); if (tooLarge) return tooLarge;
  try {
    const session = await requireSession(request), admin = getAdminClient();
    const limit = await enforceRateLimit(request, admin, `membership:country:${session.sub}`, 20, 60);
    if (limit) return limit;
    const body = await request.json();
    await getMembership(admin, session.sub);
    const result = await admin.rpc("claim_heater_marketplace", { p_account_id: session.sub, p_marketplace: body.marketplace });
    if (result.error) throw new Error(result.error.message);
    return apiJson(request, { data: await getMembership(admin, session.sub) });
  } catch (error) { return handleApiError(request, error); }
}
