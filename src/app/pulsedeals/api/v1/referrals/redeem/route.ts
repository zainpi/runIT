import { apiJson, enforceRateLimit, getAdminClient, requireSession } from "@/lib/pulsedeals/server";
import { prepareReferralOffer, referralError } from "@/lib/pulsedeals/referrals";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requireSession(request);
    const admin = getAdminClient();
    const limit = await enforceRateLimit(request, admin, `referrals:redeem:${session.sub}`, 12, 3600);
    if (limit) return limit;
    return apiJson(request, { data: await prepareReferralOffer(admin, session.sub) });
  } catch (error) { return referralError(request, error); }
}
