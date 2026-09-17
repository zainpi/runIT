import "server-only";
import { AiError } from "./ai-contract";
import { tokenHash, validAccessToken } from "./payment";
import { assertSameOrigin, environment, storeConfiguration } from "./server";
import { validTrialId } from "./trial-contract";

export async function trialConfiguration() {
  const env = await environment();
  const codes = env.TEMPLATES_TRIAL_CODES as Cloudflare.Env["TEMPLATES_TRIAL_CODES"] | undefined;
  return { enabled: env.TEMPLATES_TRIAL_ENABLED === "true", registry: codes && typeof codes.getByName === "function" ? codes.getByName("template-trials-v1") : undefined };
}
export async function authorizeTrial(request: Request, sessionId: string, token: string) {
  assertSameOrigin(request, (await storeConfiguration()).origin);
  if (!validTrialId(sessionId) || !validAccessToken(token) || sessionId !== `trial_${tokenHash(token)}`) throw new AiError("Open your full private trial link.", 403);
  const { registry } = await trialConfiguration();
  if (!registry) throw new AiError("Trial access is temporarily unavailable. Keep your private link and try again later.", 503);
  const result = await registry.authorize(tokenHash(token));
  if (!result.ok) throw new AiError(result.error, result.status);
  return [result.value.templateId];
}
