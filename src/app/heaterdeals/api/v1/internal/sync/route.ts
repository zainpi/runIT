import { apiError, apiJson, getAdminClient, getProductID, handleApiError, refreshDiscordMemberships } from "@/lib/heaterdeals/server";
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
    await refreshDiscordMemberships(getAdminClient());
    const result = await syncMarketplace(getAdminClient(), marketplace);
    let queued = 0;
    if (process.env.HEATERDEALS_PUSH_ENABLED === "true") {
      const enqueue = await getAdminClient().rpc("enqueue_heater_push_matches", {
        p_marketplace: marketplace, p_product_id: getProductID(),
      });
      if (enqueue.error) throw enqueue.error;
      queued = Number(enqueue.data ?? 0);
    }
    return apiJson(request, { ok: true, ...result, queued });
  } catch (error) {
    return handleApiError(request, error);
  }
}
