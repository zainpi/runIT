import {
  apiJson,
  checkBodySize,
  enforceRateLimit,
  beginDiscordLink,
  getAdminClient,
  handleApiError,
  requireSession,
} from "@/lib/pulsedeals/server";

export const runtime = "nodejs";

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": request.headers.get("origin") ?? "*",
      "access-control-allow-headers": "authorization, content-type, idempotency-key, x-app-attest",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-max-age": "86400",
    },
  });
}

export async function POST(request: Request) {
  const tooLarge = checkBodySize(request, 2_000);
  if (tooLarge) return tooLarge;
  try {
    const session = await requireSession(request);
    const admin = getAdminClient();
    const limit = await enforceRateLimit(request, admin, `discord:start:${session.sub}`, 5, 3_600);
    if (limit) return limit;
    const result = await beginDiscordLink(admin, session.sub);
    return apiJson(request, { ok: true, ...result });
  } catch (error) {
    return handleApiError(request, error);
  }
}
