import {
  apiJson,
  enforceRateLimit,
  getAdminClient,
  getClientKey,
  getFeed,
  handleApiError,
  requireActiveSubscription,
  requireSession,
} from "@/lib/heaterdeals/server";

export const runtime = "nodejs";

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": request.headers.get("origin") ?? "*",
      "access-control-allow-headers": "authorization, content-type, idempotency-key, x-app-attest",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-max-age": "86400",
    },
  });
}

export async function GET(request: Request) {
  try {
    const session = await requireSession(request);
    const admin = getAdminClient();
    await requireActiveSubscription(admin, session.sub);
    const accountLimit = await enforceRateLimit(request, admin, `feed:account:${session.sub}`, 30, 60);
    if (accountLimit) return accountLimit;
    const deviceLimit = await enforceRateLimit(request, admin, `feed:client:${getClientKey(request, session.sub)}`, 60, 60);
    if (deviceLimit) return deviceLimit;
    const url = new URL(request.url);
    const response = await getFeed(admin, url.searchParams);
    return apiJson(request, { ok: true, ...response });
  } catch (error) {
    return handleApiError(request, error);
  }
}
