import {
  apiError,
  apiJson,
  checkBodySize,
  enforceRateLimit,
  getAdminClient,
  getRequestIP,
  handleApiError,
  refreshSession,
} from "@/lib/heaterdeals/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const tooLarge = checkBodySize(request, 4_000);
  if (tooLarge) return tooLarge;
  try {
    const body = (await request.json()) as { refreshToken?: string };
    if (!body.refreshToken) return apiError(request, 400, "invalid_request", "refreshToken is required.");
    const admin = getAdminClient();
    const limit = await enforceRateLimit(request, admin, `auth:refresh:${getRequestIP(request)}`, 30, 3_600);
    if (limit) return limit;
    const session = await refreshSession(admin, body.refreshToken);
    return apiJson(request, { ok: true, ...session });
  } catch (error) {
    return handleApiError(request, error);
  }
}
