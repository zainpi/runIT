import { templateFoundations } from "@/lib/templates/content";
import { subagentInstructions } from "@/lib/templates/prompts/subagents";
import { buildSkillTreeInstructions } from "@/lib/templates/prompts/skill-tree";
import { fulfillOrder, StoreError, validAccessToken, validSessionId } from "@/lib/templates/payment";
import { assertSameOrigin, errorResponse, jsonResponse, readJson, stripeForStore } from "@/lib/templates/server";
export async function POST(request: Request) {
  try {
    const { stripe, origin } = await stripeForStore();
    assertSameOrigin(request, origin);
    const data = await readJson(request);
    if (!validSessionId(data.sessionId) || !validAccessToken(data.accessToken)) throw new StoreError("Open the private access link for your order.", 403);
    const order = await fulfillOrder(stripe, data.sessionId, data.accessToken);
    return jsonResponse({
      templates: order.ids.map((id) => ({ id, foundation: templateFoundations[id] })),
      subagents: order.subagents,
      ...(order.subagents ? { subagentInstructions } : {}),
      skillTree: order.skillTree,
      ...(order.skillTree ? { skillTreeInstructions: buildSkillTreeInstructions(order.ids) } : {}),
      appIcon: order.appIcon,
    });
  } catch (error) { return errorResponse(error); }
}
