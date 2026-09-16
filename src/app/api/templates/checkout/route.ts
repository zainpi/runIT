import { parseTemplateIds } from "@/lib/templates/catalog";
import { checkoutParameters, StoreError, tokenHash, validAccessToken } from "@/lib/templates/payment";
import { assertSameOrigin, errorResponse, jsonResponse, readJson, stripeForStore } from "@/lib/templates/server";
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
    const params = checkoutParameters(ids, data.accessToken, returnOrigin, subagents, skillTree);
    const session = await stripe.checkout.sessions.create(params, { idempotencyKey: `templates-${tokenHash(`${data.accessToken}:${ids.join(",")}:${returnOrigin}:${params.metadata!.currency}:${subagents}:${skillTree}`)}` });
    if (!session.url) throw new StoreError("Checkout could not be opened. Please retry.", 502);
    return jsonResponse({ url: session.url, sessionId: session.id });
  } catch (error) { return errorResponse(error); }
}
