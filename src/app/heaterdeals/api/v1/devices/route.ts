import { apiError, apiJson, checkBodySize, enforceRateLimit, getAdminClient, handleApiError, requireSession } from "@/lib/heaterdeals/server";
export const runtime = "nodejs";

export async function PUT(request: Request) {
  const tooLarge = checkBodySize(request, 2_000);
  if (tooLarge) return tooLarge;
  try {
    const session = await requireSession(request);
    const admin = getAdminClient();
    const limit = await enforceRateLimit(request, admin, `push-device:${session.sub}`, 60, 3_600);
    if (limit) return limit;
    const body = await request.json() as { token?: unknown; environment?: unknown; enabled?: unknown };
    if (typeof body.token !== "string" || !/^[a-f0-9]{32,512}$/i.test(body.token) || body.token.length % 2 !== 0 ||
        !["sandbox", "production"].includes(String(body.environment)) || typeof body.enabled !== "boolean") {
      return apiError(request, 422, "invalid_device", "A valid APNs device registration is required.");
    }
    const result = await admin.from("heater_push_devices").upsert({
      account_id: session.sub, token: body.token.toLowerCase(), environment: body.environment,
      enabled: body.enabled, updated_at: new Date().toISOString(),
    }, { onConflict: "token,environment" });
    if (result.error) throw result.error;
    if (body.enabled && process.env.HEATERDEALS_PUSH_ENABLED !== "true") {
      return apiError(request, 503, "push_not_ready", "Deal notification delivery is not enabled yet.");
    }
    return apiJson(request, { ok: true });
  } catch (error) { return handleApiError(request, error); }
}
