import {
  apiError,
  apiJson,
  checkBodySize,
  enforceRateLimit,
  getAdminClient,
  getClientKey,
  getDealVoteSummaries,
  handleApiError,
  requireActiveSubscription,
  requireSession,
  submitDealVote,
} from "@/lib/pulsedeals/server";
import { PULSE_DEAL_VOTES, type PulseDealVote } from "@/lib/pulsedeals/types";

export const runtime = "nodejs";

const MAX_ASINS = 50;

function normalizedASINs(value: string): string[] {
  return Array.from(
    new Set(value.split(",").map((asin) => asin.trim().toUpperCase()).filter(Boolean)),
  );
}

function isValidASIN(value: string): boolean {
  return /^[A-Z0-9]{6,32}$/.test(value);
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": request.headers.get("origin") ?? "*",
      "access-control-allow-headers": "authorization, content-type, idempotency-key, x-app-attest",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-max-age": "86400",
    },
  });
}

export async function GET(request: Request) {
  try {
    const rawASINs = new URL(request.url).searchParams.get("asins") ?? "";
    const asins = normalizedASINs(rawASINs);
    if (!asins.length) return apiError(request, 422, "invalid_request", "At least one deal is required.");
    if (asins.length > MAX_ASINS || asins.some((asin) => !isValidASIN(asin))) {
      return apiError(request, 422, "invalid_request", "Choose up to 50 valid deals.");
    }

    const session = await requireSession(request);
    const admin = getAdminClient();
    await requireActiveSubscription(admin, session.sub);
    const accountLimit = await enforceRateLimit(request, admin, `votes:read:account:${session.sub}`, 900, 3_600);
    if (accountLimit) return accountLimit;
    const deviceLimit = await enforceRateLimit(request, admin, `votes:read:client:${getClientKey(request, session.sub)}`, 1_200, 3_600);
    if (deviceLimit) return deviceLimit;

    const data = await getDealVoteSummaries(admin, session.sub, asins);
    return apiJson(request, { ok: true, data });
  } catch (error) {
    return handleApiError(request, error);
  }
}

export async function POST(request: Request) {
  const tooLarge = checkBodySize(request, 2_000);
  if (tooLarge) return tooLarge;

  try {
    let body: { asin?: unknown; vote?: unknown };
    try {
      body = (await request.json()) as { asin?: unknown; vote?: unknown };
    } catch {
      return apiError(request, 400, "invalid_request", "The vote request is invalid.");
    }

    const asin = typeof body.asin === "string" ? body.asin.trim().toUpperCase() : "";
    const vote = typeof body.vote === "string" && (PULSE_DEAL_VOTES as readonly string[]).includes(body.vote)
      ? body.vote as PulseDealVote
      : null;
    if (!isValidASIN(asin) || !vote) {
      return apiError(request, 422, "invalid_request", "Choose a valid vote for this deal.");
    }

    const session = await requireSession(request);
    const admin = getAdminClient();
    await requireActiveSubscription(admin, session.sub);
    const accountLimit = await enforceRateLimit(request, admin, `votes:write:account:${session.sub}`, 180, 3_600);
    if (accountLimit) return accountLimit;
    const deviceLimit = await enforceRateLimit(request, admin, `votes:write:client:${getClientKey(request, session.sub)}`, 240, 3_600);
    if (deviceLimit) return deviceLimit;

    const data = await submitDealVote(admin, session.sub, asin, vote);
    return apiJson(request, { ok: true, data });
  } catch (error) {
    return handleApiError(request, error);
  }
}
