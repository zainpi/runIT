import "server-only";
import type { DurableObjectNamespace } from "@cloudflare/workers-types";
import type { TemplateAiOrder } from "./ai-order";
import { AiError, parseBrief, type AiResult } from "./ai-contract";
import type { TemplateId } from "./catalog";
import type { IconRequest } from "./icon-contract";
import { decodeIcon, iconProviderConfiguration } from "./icon-provider";
import { StoreError, tokenHash, validAccessToken, validSessionId, verifyOrder } from "./payment";
import { assertSameOrigin, environment, jsonResponse, readJson, stripeForStore } from "./server";

export type IconOrderStore = { [K in "readIcon" | "startIcon" | "deleteIcon"]: (...args: Parameters<TemplateAiOrder[K]>) => Promise<Awaited<ReturnType<TemplateAiOrder[K]>>> };
type IconConfiguration = ReturnType<typeof iconProviderConfiguration> & { orders?: DurableObjectNamespace<TemplateAiOrder> };
export async function iconConfiguration(): Promise<IconConfiguration> {
  const env = await environment();
  const orders = env.TEMPLATES_AI_ORDERS as Cloudflare.Env["TEMPLATES_AI_ORDERS"] | undefined;
  return { ...iconProviderConfiguration(env), orders: orders && typeof orders.getByName === "function" ? orders : undefined };
}
type Dependencies = {
  authorize(request: Request, sessionId: string, token: string): Promise<{ ids: TemplateId[]; appIcon: boolean }>;
  configuration(): Promise<IconConfiguration>;
  store?: (orderKey: string) => IconOrderStore;
};
const defaults: Dependencies = {
  async authorize(request, sessionId, token) {
    const { stripe, origin } = await stripeForStore();
    assertSameOrigin(request, origin);
    return verifyOrder(stripe, sessionId, token);
  },
  configuration: iconConfiguration,
};
function unwrap<T>(result: AiResult<T>): T {
  if (!result.ok) throw new AiError(result.error, result.status);
  return result.value;
}
export async function handleIconRequest(request: Request, dependencies: Dependencies = defaults): Promise<Response> {
  try {
    const data = await readJson(request, 12_000);
    if (!validSessionId(data.sessionId) || !validAccessToken(data.accessToken)) throw new AiError("Open your private purchase link to access your app icon.", 403);
    const purchase = await dependencies.authorize(request, data.sessionId, data.accessToken);
    if (!purchase.appIcon) throw new AiError("App icon creation was not included in this order.", 403);
    const config = await dependencies.configuration();
    const order = dependencies.store?.(tokenHash(data.sessionId)) ?? config.orders?.getByName(tokenHash(data.sessionId));
    if (!order) throw new AiError("Your saved icon is temporarily unavailable. Keep your purchase link and try again shortly.", 503);
    const available = config.enabled;
    if (data.versionId !== undefined && (typeof data.versionId !== "string" || !/^[0-9a-f-]{36}$/.test(data.versionId))) throw new AiError("Choose a saved icon version.");
    const versionId = data.versionId as string | undefined;
    if (data.action === "load") return jsonResponse({ available, state: unwrap(await order.readIcon(versionId)) });
    if (data.action === "delete") return jsonResponse({ available, state: unwrap(await order.deleteIcon()) });
    if (data.action === "download") {
      const state = unwrap(await order.readIcon(versionId));
      if (!state.image) throw new AiError("Your icon is not ready to download.", 409);
      return new Response(decodeIcon(state.image.base64), { headers: {
        "Content-Type": "image/png", "Content-Disposition": `attachment; filename="${state.image.fileName}"`,
        "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff",
      } });
    }
    if (data.action !== "generate") throw new AiError("Choose an icon action.");
    if (!available) throw new AiError("Icon generation is temporarily unavailable. Your saved icon is still available to download.", 503);
    if (data.consent !== true) throw new AiError("Confirm that OpenAI may use your brief to generate your icon.");
    if (typeof data.templateId !== "string" || !purchase.ids.includes(data.templateId as TemplateId)) throw new AiError("Choose a template included in this order.", 403);
    if (typeof data.requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(data.requestId)) throw new AiError("Refresh this page before generating your icon.");
    if (typeof data.direction !== "string" || data.direction.length > 800) throw new AiError("Keep the icon direction within 800 characters.");
    if (data.baseVersion !== undefined && (typeof data.baseVersion !== "string" || !/^[0-9a-f-]{36}$/.test(data.baseVersion))) throw new AiError("Choose a saved icon version to update.");
    const brief = parseBrief(data.brief);
    const input: IconRequest = { requestId: data.requestId, templateId: data.templateId as TemplateId, brief: { name: brief.name, idea: brief.idea, style: brief.style }, direction: data.direction.trim(), ...(data.baseVersion ? { baseVersion: data.baseVersion as string } : {}) };
    const state = unwrap(await order.startIcon(input, tokenHash(JSON.stringify(input))));
    return jsonResponse({ available, state }, state.status === "pending" ? 202 : 200);
  } catch (error) {
    if (error instanceof AiError || error instanceof StoreError) return jsonResponse({ error: error.message }, error.status);
    return jsonResponse({ error: "Your icon could not be loaded. Refresh its status before trying again." }, 502);
  }
}
