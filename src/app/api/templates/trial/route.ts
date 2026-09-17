import { AiError } from "@/lib/templates/ai-contract";
import { aiConfiguration } from "@/lib/templates/ai-service";
import { templateCatalog, type TemplateId } from "@/lib/templates/catalog";
import { StoreError, tokenHash, validAccessToken } from "@/lib/templates/payment";
import { assertSameOrigin, jsonResponse, readJson, storeConfiguration } from "@/lib/templates/server";
import { authorizeTrial, trialConfiguration } from "@/lib/templates/trial-access";
import { TRIAL_MESSAGE_LIMIT } from "@/lib/templates/trial-contract";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request, (await storeConfiguration()).origin);
    const data = await readJson(request);
    if (!validAccessToken(data.accessToken)) throw new AiError("Open or create your private trial link.", 403);
    if (data.action === "load") {
      const ids = await authorizeTrial(request, String(data.sessionId), data.accessToken);
      return jsonResponse({ templateId: ids[0], messageLimit: TRIAL_MESSAGE_LIMIT });
    }
    if (data.action !== "redeem" || typeof data.code !== "string" || data.code.length > 100) throw new AiError("Enter your trial code.");
    if (!templateCatalog.some((t) => t.id === data.templateId)) throw new AiError("Choose one template for your trial.");
    const [trial, ai] = await Promise.all([trialConfiguration(), aiConfiguration()]);
    if (!trial.enabled || !trial.registry || !ai.enabled || !ai.key || !ai.model || !ai.orders) throw new AiError("Free trials are not available right now. Your code has not been used.", 503);
    const accessHash = tokenHash(data.accessToken);
    const result = await trial.registry.redeem(tokenHash(data.code.trim().toUpperCase()), accessHash, data.templateId as TemplateId);
    if (!result.ok) throw new AiError(result.error, result.status);
    return jsonResponse({ sessionId: `trial_${accessHash}`, templateId: result.value.templateId, messageLimit: TRIAL_MESSAGE_LIMIT });
  } catch (error) {
    if (error instanceof AiError || error instanceof StoreError) return jsonResponse({ error: error.message }, error.status);
    return jsonResponse({ error: "We could not open your trial. Retry with the same code to recover your link." }, 502);
  }
}
