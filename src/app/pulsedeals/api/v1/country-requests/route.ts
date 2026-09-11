import { normalizeRequestedCountry, recordCountryRequest } from "@/lib/pulsedeals/country-requests";
import { apiError, apiJson, checkBodySize, enforceRateLimit, getAdminClient, handleApiError, requireSession } from "@/lib/pulsedeals/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const tooLarge = checkBodySize(request, 512);
  if (tooLarge) return tooLarge;
  try {
    // Feedback is available to signed-in users before any trial or subscription.
    const session = await requireSession(request);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 512) return apiError(request, 413, "payload_too_large", "Request body is too large.");
    let body: { countryCode?: unknown } | null;
    try { body = JSON.parse(raw); }
    catch { return apiError(request, 400, "invalid_request", "Choose a country to request."); }
    const country = normalizeRequestedCountry(body?.countryCode);
    if (!country) return apiError(request, 422, "invalid_country", "Choose a country that isn’t available yet.");
    const admin = getAdminClient();
    const limit = await enforceRateLimit(request, admin, `country-request:${session.sub}`, 20, 3600);
    if (limit) return limit;
    await recordCountryRequest(admin, session.sub, country);
    return apiJson(request, { ok: true });
  } catch (error) { return handleApiError(request, error); }
}
