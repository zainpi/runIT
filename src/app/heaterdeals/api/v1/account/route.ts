import {
  apiJson,
  enforceRateLimit,
  getAdminClient,
  handleApiError,
  requireSession,
} from "@/lib/heaterdeals/server";

export const runtime = "nodejs";

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": request.headers.get("origin") ?? "*",
      "access-control-allow-headers": "authorization, content-type, idempotency-key, x-app-attest",
      "access-control-allow-methods": "DELETE, OPTIONS",
      "access-control-max-age": "86400",
    },
  });
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession(request);
    const admin = getAdminClient();
    const limit = await enforceRateLimit(request, admin, `account:delete:${session.sub}`, 3, 3_600);
    if (limit) return limit;
    const result = await admin.from("heater_accounts").delete().eq("id", session.sub);
    if (result.error) throw result.error;
    return apiJson(request, { ok: true });
  } catch (error) {
    return handleApiError(request, error);
  }
}
