import { getPulseDealsEnv, getCronSecretHeader } from "@/lib/pulsedeals/compatibility";
import { apiError, apiJson, getAdminClient, getProductID, handleApiError, refreshDiscordMemberships } from "@/lib/pulsedeals/server";
import { syncMarketplace } from "@/lib/pulsedeals/keepa";
import { PULSE_MARKETPLACES, type PulseMarketplace } from "@/lib/pulsedeals/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const expected = getPulseDealsEnv("PULSEDEALS_CRON_SECRET");
  if (!expected || getCronSecretHeader(request.headers) !== expected) {
    return apiError(request, 401, "unauthorized", "Internal endpoint only.");
  }
  try {
    const requested = new URL(request.url).searchParams.get("marketplace");
    const marketplace = (PULSE_MARKETPLACES as readonly string[]).includes(requested ?? "")
      ? requested as PulseMarketplace
      : "uk";
    await refreshDiscordMemberships(getAdminClient());
    const result = await syncMarketplace(getAdminClient(), marketplace);
    let queued = 0;
    if (getPulseDealsEnv("PULSEDEALS_PUSH_ENABLED") === "true") {
      const enqueue = await getAdminClient().rpc("enqueue_pulsedeals_push_matches", {
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
