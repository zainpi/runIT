import {
  apiError,
  apiJson,
  authenticateReviewAccount,
  checkBodySize,
  enforceRateLimit,
  getAdminClient,
  getRequestIP,
  handleApiError,
  issueSession,
} from "@/lib/pulsedeals/server";

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
  const tooLarge = checkBodySize(request, 8_000);
  if (tooLarge) return tooLarge;

  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
      appAccountToken?: string;
    };
    if (
      typeof body.username !== "string" ||
      typeof body.password !== "string" ||
      typeof body.appAccountToken !== "string" ||
      !body.username.trim() ||
      !body.password
    ) {
      return apiError(request, 400, "invalid_request", "username, password, and appAccountToken are required.");
    }
    const admin = getAdminClient();
    const limit = await enforceRateLimit(request, admin, `auth:password:${getRequestIP(request)}`, 12, 3_600);
    if (limit) return limit;
    const account = await authenticateReviewAccount(admin, body.username, body.password, body.appAccountToken);
    const session = await issueSession(admin, account);
    return apiJson(request, { ok: true, ...session });
  } catch (error) {
    return handleApiError(request, error);
  }
}
