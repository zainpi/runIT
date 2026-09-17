import { parseTemplateIds } from "@/lib/templates/catalog";
import { checkoutParameters, StoreError, tokenHash, validAccessToken } from "@/lib/templates/payment";
import { assertSameOrigin, errorResponse, jsonResponse, readJson, stripeForStore } from "@/lib/templates/server";
import { aiConfiguration } from "@/lib/templates/ai-service";
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
    const subagents = data.subagents === true;
    const skillTree = data.skillTree === true;
    const ai = await aiConfiguration();
    if (!ai.enabled || !ai.key || !ai.model || !ai.orders) throw new StoreError("Checkout is paused while we prepare the included AI editor. Please try again later.", 503);
    const params = checkoutParameters(ids, data.accessToken, returnOrigin, subagents, skillTree);
    // The explicit Managed Payments setting changes the request parameters.
    // Version the key so saved carts don't replay an older, incompatible request.
    const session = await stripe.checkout.sessions.create(params, { idempotencyKey: `templates-standard-v1-${tokenHash(`${data.accessToken}:${ids.join(",")}:${returnOrigin}:${params.metadata!.currency}:${subagents}:${skillTree}`)}` });
    if (!session.url) throw new StoreError("Checkout could not be opened. Please retry.", 502);
    return jsonResponse({ url: session.url, sessionId: session.id });
  } catch (error) { return errorResponse(error); }
}
