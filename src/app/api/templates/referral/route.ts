import { StoreError } from "@/lib/templates/payment";
import { referralForCode } from "@/lib/templates/referrals";
import { assertSameOrigin, jsonResponse, readJson, storeConfiguration } from "@/lib/templates/server";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request, (await storeConfiguration()).origin);
    const data = await readJson(request, 2_000);
    if (typeof data.code !== "string" || !data.code.trim()) throw new StoreError("Enter a discount code.");
    const referral = referralForCode(data.code);
    if (!referral) throw new StoreError("That discount code is not valid.");
    return jsonResponse({ discountPercent: referral.discountPercent, founder: referral.founderName });
  } catch (error) {
    if (error instanceof StoreError) return jsonResponse({ error: error.message }, error.status);
    return jsonResponse({ error: "The referral code could not be checked. Try again." }, 502);
  }
}
