import { after } from "next/server";

import { refreshOpenedDeal } from "@/lib/pulsedeals/keepa";
import {
  apiError, apiJson, enforceRateLimit, getAdminClient, handleApiError,
  requireMarketplaceAccess, requireSession,
} from "@/lib/pulsedeals/server";
import { PULSE_MARKETPLACES, type PulseMarketplace } from "@/lib/pulsedeals/types";

export const runtime = "nodejs";
export const maxDuration = 40;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: asin } = await params;
    const marketplace = new URL(request.url).searchParams.get("marketplace");
    if (!/^[A-Z0-9]{10}$/.test(asin) || !PULSE_MARKETPLACES.includes(marketplace as PulseMarketplace)) {
      return apiError(request, 422, "invalid_deal", "A valid deal and marketplace are required.");
    }

    const session = await requireSession(request);
    const admin = getAdminClient();
    await requireMarketplaceAccess(admin, session.sub, marketplace!);
    const deal = await admin.from("pulsedeals_deals").select("asin")
      .eq("asin", asin).eq("marketplace", marketplace!).maybeSingle();
    if (deal.error) throw deal.error;
    if (!deal.data) return apiError(request, 404, "deal_not_found", "This deal is no longer available.");

    const accountLimit = await enforceRateLimit(request, admin, `deal-refresh:account:${session.sub}`, 30, 3600);
    if (accountLimit) return accountLimit;
    const productLimit = await enforceRateLimit(request, admin, `deal-refresh:${marketplace}:${asin}`, 1, 300);
    if (productLimit) return apiJson(request, { ok: true, queued: false });

    after(async () => {
      try { await refreshOpenedDeal(admin, marketplace as PulseMarketplace, asin); }
      catch (error) { console.error("PulseDeals Keepa refresh failed:", error); }
    });
    return apiJson(request, { ok: true, queued: true }, 202);
  } catch (error) {
    return handleApiError(request, error);
  }
}
