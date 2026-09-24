import "server-only";
import type { DurableObjectNamespace } from "@cloudflare/workers-types";
import { AiError, parseBrief, type AiGeneration, type AiResult } from "./ai-contract";
import type { TemplateAiOrder } from "./ai-order";
import { generateAppPlan } from "./ai-provider";
import { tokenHash, verifyOrder, StoreError, validAccessToken, validSessionId } from "./payment";
import { assertSameOrigin, environment, jsonResponse, readJson, stripeForStore } from "./server";
import { authorizeTrial } from "./trial-access";
import { validTrialId } from "./trial-contract";
import { isReasoningEffort, type AiReasoningEffort } from "./ai-settings";
import type { TemplateId } from "./catalog";

export type AiOrderStore = { [K in "initializeTrial" | "read" | "reserve" | "complete" | "fail" | "apply" | "clear"]: (...args: Parameters<TemplateAiOrder[K]>) => Promise<ReturnType<TemplateAiOrder[K]>> } & { startGuide?: (...args: Parameters<TemplateAiOrder["startGuide"]>) => ReturnType<TemplateAiOrder["startGuide"]> };
type AiConfiguration = { key: string; model: string; reasoningEffort?: AiReasoningEffort; enabled: boolean; orders?: DurableObjectNamespace<TemplateAiOrder> };
export async function aiConfiguration(): Promise<AiConfiguration> {
  const env = await environment();
  const orders = env.TEMPLATES_AI_ORDERS as Cloudflare.Env["TEMPLATES_AI_ORDERS"] | undefined;
  const effort = env.TEMPLATES_AI_REASONING_EFFORT;
  const validEffort = effort === undefined || effort === "" || isReasoningEffort(effort);
  return { key: typeof env.TEMPLATES_OPENAI_API_KEY === "string" ? env.TEMPLATES_OPENAI_API_KEY : "", model: typeof env.TEMPLATES_AI_MODEL === "string" ? env.TEMPLATES_AI_MODEL : "", reasoningEffort: isReasoningEffort(effort) ? effort : undefined, enabled: env.TEMPLATES_AI_ENABLED === "true" && validEffort, orders: orders && typeof orders.getByName === "function" ? orders : undefined };
}
function unwrap<T>(result: AiResult<T>): T {
  if (!result.ok) throw new AiError(result.error, result.status);
  return result.value;
}
type Dependencies = {
  authorize(request: Request, sessionId: string, token: string): Promise<TemplateId[]>;
  authorizeTrial?: typeof authorizeTrial;
  configuration(): Promise<AiConfiguration>;
  generate: typeof generateAppPlan;
  store?: (orderKey: string) => AiOrderStore;
};
const defaults: Dependencies = {
  async authorize(request, sessionId, token) {
    const { stripe, origin } = await stripeForStore();
    assertSameOrigin(request, origin);
    return (await verifyOrder(stripe, sessionId, token)).ids;
  }, authorizeTrial, configuration: aiConfiguration, generate: generateAppPlan,
};
export async function handleAiRequest(request: Request, dependencies: Dependencies = defaults): Promise<Response> {
  try {
    const data = await readJson(request, 40_000);
    const trial = validTrialId(data.sessionId);
    if ((!validSessionId(data.sessionId) && !validTrialId(data.sessionId)) || !validAccessToken(data.accessToken)) throw new AiError("Open the private purchase link to use its AI chat.", 403);
    const authorize = trial ? dependencies.authorizeTrial : dependencies.authorize;
    if (!authorize) throw new AiError("Trial access is unavailable.", 403);
    const ids = await authorize(request, data.sessionId, data.accessToken);
    const config = await dependencies.configuration();
    const order = dependencies.store?.(tokenHash(data.sessionId)) ?? config.orders?.getByName(tokenHash(data.sessionId));
    if (trial && order) unwrap(await order.initializeTrial());
    const available = !!order && config.enabled && !!config.key && !!config.model;
    if (data.action === "load") return jsonResponse({ available, state: order ? unwrap(await order.read()) : null });
    if (!order) throw new AiError("AI editing is not configured yet. Your templates remain available to copy and download.", 503);
    if (data.action === "clear") return jsonResponse({ available, state: unwrap(await order.clear()) });
    if (typeof data.templateId !== "string" || !ids.includes(data.templateId as TemplateId)) throw new AiError("This template is not included in your purchase.", 403);
    const templateId = data.templateId as TemplateId;
    if (!Number.isInteger(data.revision) || (data.revision as number) < 0) throw new AiError("Refresh the conversation before continuing.");
    const revision = data.revision as number;
    if (trial && (data.action === "apply" || data.action === "guide")) throw new AiError("Purchase a template to create its full build guide and prompt.", 403);
    if (data.action === "apply") return jsonResponse({ available, state: unwrap(await order.apply(templateId, revision)) });
    if (data.action !== "overview" && data.action !== "message" && data.action !== "guide" && data.action !== "choices") throw new AiError("Choose an overview, message or guide.");
    if (!available) throw new AiError("AI editing is temporarily unavailable. Your saved conversation and templates are still accessible.", 503);
    if (data.consent !== true) throw new AiError("Confirm that your brief and messages may be sent to OpenAI to tailor your prompt.");
    if (typeof data.requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(data.requestId)) throw new AiError("Reload this page before sending.");
    if (data.action === "message" && (typeof data.message !== "string" || !data.message.trim() || data.message.length > 2000)) throw new AiError("Write a message of 1–2,000 characters.");
    const generation: AiGeneration = { requestId: data.requestId, templateId, revision, kind: data.action, brief: parseBrief(data.brief), message: data.action === "message" ? (data.message as string).trim() : "" };
    // Queued durably before returning. Every saved-state fetch is authorized
    // above, including refunds and disputes that occur after generation starts.
    // Previously delivered content cannot be recalled from the browser.
    if (data.action === "guide") {
      if (!order.startGuide) throw new AiError("Guide generation is not configured yet.", 503);
      return jsonResponse({ available, state: unwrap(await order.startGuide(generation, tokenHash(JSON.stringify(generation)))) }, 202);
    }
    const reservation = unwrap(await order.reserve(generation, tokenHash(JSON.stringify(generation))));
    if (reservation.status === "replay") return jsonResponse({ available, state: reservation.snapshot });
    try {
      const reply = await dependencies.generate({ ...config, trial }, generation, reservation.context);
      // A refund or dispute during generation must also stop delivery.
      await authorize(request, data.sessionId, data.accessToken);
      return jsonResponse({ available, state: unwrap(await order.complete(generation.requestId, reply)) });
    } catch (error) {
      // If this write fails, the durable lease refunds the reservation on the next read.
      try { await order.fail(generation.requestId); } catch { /* Do not mask the original failure. */ }
      throw error;
    }
  } catch (error) {
    if (error instanceof AiError || error instanceof StoreError) return jsonResponse({ error: error.message }, error.status);
    return jsonResponse({ error: "We could not open the AI conversation. Refresh it before retrying. Keep your purchase link if the problem continues." }, 502);
  }
}
