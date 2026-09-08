import {
  apiJson,
  enforceRateLimit,
  getAdminClient,
  getDiscordConnection,
  handleApiError,
  requireSession,
  unlinkDiscord,
} from "@/lib/heaterdeals/server";

export const runtime = "nodejs";

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": request.headers.get("origin") ?? "*",
      "access-control-allow-headers": "authorization, content-type, idempotency-key, x-app-attest",
      "access-control-allow-methods": "GET, DELETE, OPTIONS",
      "access-control-max-age": "86400",
    },
  });
}

export async function GET(request: Request) {
  try {
    const session = await requireSession(request);
    const admin = getAdminClient();
    const limit = await enforceRateLimit(request, admin, `discord:status:${session.sub}`, 30, 3_600);
    if (limit) return limit;
    const data = await getDiscordConnection(admin, session.sub);
    return apiJson(request, { ok: true, connected: data !== null, data });
  } catch (error) {
    return handleApiError(request, error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession(request);
    const admin = getAdminClient();
    const limit = await enforceRateLimit(request, admin, `discord:unlink:${session.sub}`, 5, 3_600);
    if (limit) return limit;
    await unlinkDiscord(admin, session.sub);
    return apiJson(request, { ok: true });
  } catch (error) {
    return handleApiError(request, error);
  }
}
