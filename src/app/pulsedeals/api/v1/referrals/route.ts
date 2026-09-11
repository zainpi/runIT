import { apiJson, checkBodySize, enforceRateLimit, getAdminClient, requireSession, apiError } from "@/lib/pulsedeals/server";
import { normalizeReferralCode, referralConfig, referralError, referralSummary } from "@/lib/pulsedeals/referrals";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await requireSession(request);
    const admin = getAdminClient();
    const limit = await enforceRateLimit(request, admin, `referrals:read:${session.sub}`, 120, 3600);
    if (limit) return limit;
    return apiJson(request, { data: await referralSummary(admin, session.sub) });
  } catch (error) { return referralError(request, error); }
}

export async function POST(request: Request) {
  const tooLarge = checkBodySize(request, 1024);
  if (tooLarge) return tooLarge;
  try {
    const session = await requireSession(request);
    const admin = getAdminClient();
    referralConfig();
    const limit = await enforceRateLimit(request, admin, `referrals:claim:${session.sub}`, 10, 3600);
    if (limit) return limit;
    const body = await request.json();
    const code = normalizeReferralCode(body?.code);
    if (!code) return apiError(request, 422, "invalid_referral_code", "Enter the 12-character referral code from your friend.");
    const result = await admin.rpc("claim_pulsedeals_referral", { p_account_id: session.sub, p_code: code });
    if (result.error) throw result.error;
    return apiJson(request, { data: await referralSummary(admin, session.sub) });
  } catch (error) { return referralError(request, error); }
}
