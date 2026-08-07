import { apiError, apiJson, getAdminClient, handleApiError } from "@/lib/heaterdeals/server";
import { syncMarketplace } from "@/lib/heaterdeals/keepa";
import { HEATER_MARKETPLACES, type HeaterMarketplace } from "@/lib/heaterdeals/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const expected = process.env.HEATERDEALS_CRON_SECRET;
  if (!expected || request.headers.get("x-heater-cron-secret") !== expected) {
    return apiError(request, 401, "unauthorized", "Internal endpoint only.");
  }
  try {
    const requested = new URL(request.url).searchParams.get("marketplace");
    const marketplace = (HEATER_MARKETPLACES as readonly string[]).includes(requested ?? "")
      ? requested as HeaterMarketplace
      : "us";
    const result = await syncMarketplace(getAdminClient(), marketplace);
    return apiJson(request, { ok: true, ...result });
  } catch (error) {
    return handleApiError(request, error);
  }
}
