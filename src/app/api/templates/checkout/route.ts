import { parseTemplateIds } from "@/lib/templates/catalog";
import { checkoutParameters, StoreError, tokenHash, validAccessToken } from "@/lib/templates/payment";
import { referralForCode } from "@/lib/templates/referrals";
import { assertSameOrigin, errorResponse, jsonResponse, readJson, stripeForStore } from "@/lib/templates/server";
import { aiConfiguration } from "@/lib/templates/ai-service";
import { iconConfiguration } from "@/lib/templates/icon-service";
export async function POST(request: Request) {
  try {
    const { stripe, origin } = await stripeForStore();
    const returnOrigin = assertSameOrigin(request, origin);
    const data = await readJson(request);
    let ids;
    try { ids = parseTemplateIds(data.templates); } catch { throw new StoreError("Choose between one and six different templates."); }
    if (!validAccessToken(data.accessToken)) throw new StoreError("Please reload the store and try again.");
    if (data.subagents !== undefined && typeof data.subagents !== "boolean") throw new StoreError("Choose whether to include the subagent add-on.");
    if (data.skillTree !== undefined && typeof data.skillTree !== "boolean") throw new StoreError("Choose whether to include the skill-tree add-on.");
    if (data.appIcon !== undefined && typeof data.appIcon !== "boolean") throw new StoreError("Choose whether to include the app-icon add-on.");
    const subagents = data.subagents === true;
    const skillTree = data.skillTree === true;
    const appIcon = data.appIcon === true;
    if (data.referralCode !== undefined && typeof data.referralCode !== "string") throw new StoreError("Enter a valid founder referral code.");
    const referralCode = typeof data.referralCode === "string" ? data.referralCode.trim() : "";
    const referral = referralCode ? referralForCode(referralCode) ?? undefined : undefined;
    if (referralCode && !referral) throw new StoreError("That founder referral code is not valid.");
    const ai = await aiConfiguration();
    if (!ai.enabled || !ai.key || !ai.model || !ai.orders) throw new StoreError("Checkout is paused while we prepare the included AI editor. Please try again later.", 503);
    if (appIcon) {
      const icon = await iconConfiguration();
      if (!icon.enabled || !icon.orders) throw new StoreError("App icon creation is temporarily unavailable. Remove this add-on to continue, or try again later.", 503);
    }
    const params = checkoutParameters(ids, data.accessToken, returnOrigin, subagents, skillTree, referral, appIcon);
    // Include every add-on and version the request when Checkout parameters change.
    const session = await stripe.checkout.sessions.create(params, { idempotencyKey: `templates-standard-v2-${tokenHash(`${data.accessToken}:${ids.join(",")}:${returnOrigin}:${params.metadata!.currency}:${subagents}:${skillTree}:${appIcon}:${referral?.codeDigest ?? "none"}`)}` });
    if (!session.url) throw new StoreError("Checkout could not be opened. Please retry.", 502);
    return jsonResponse({ url: session.url, sessionId: session.id });
  } catch (error) { return errorResponse(error); }
}
