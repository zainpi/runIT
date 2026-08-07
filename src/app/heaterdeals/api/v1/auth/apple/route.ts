import {
  apiError,
  apiJson,
  checkBodySize,
  createOrGetAccount,
  enforceRateLimit,
  getAdminClient,
  getRequestIP,
  handleApiError,
  issueSession,
  verifyAppleIdentityToken,
} from "@/lib/heaterdeals/server";

export const runtime = "nodejs";

function corsOptions(request: Request): Response {
  const headers = new Headers({
    "access-control-allow-origin": request.headers.get("origin") ?? "*",
    "access-control-allow-headers": "authorization, content-type, idempotency-key, x-app-attest",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-max-age": "86400",
  });
  return new Response(null, { status: 204, headers });
}

export async function OPTIONS(request: Request) {
  return corsOptions(request);
}

export async function POST(request: Request) {
  const tooLarge = checkBodySize(request, 24_000);
  if (tooLarge) return tooLarge;

  try {
    const body = (await request.json()) as {
      identityToken?: string;
      appAccountToken?: string;
    };
    if (!body.identityToken || !body.appAccountToken) {
      return apiError(request, 400, "invalid_request", "identityToken and appAccountToken are required.");
    }
    const admin = getAdminClient();
    const limit = await enforceRateLimit(request, admin, `auth:apple:${getRequestIP(request)}`, 12, 3_600);
    if (limit) return limit;
    const identity = await verifyAppleIdentityToken(body.identityToken);
    const account = await createOrGetAccount(admin, identity, body.appAccountToken);
    const session = await issueSession(admin, account);
    return apiJson(request, { ok: true, ...session });
  } catch (error) {
    return handleApiError(request, error);
  }
}
