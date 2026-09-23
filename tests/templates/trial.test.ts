import assert from "node:assert/strict";
import test from "node:test";
import { tokenHash } from "../../src/lib/templates/payment";
import * as trial from "../../src/app/api/templates/trial/route";
import * as ai from "../../src/app/api/templates/ai/route";
import * as library from "../../src/app/api/templates/library/route";
import { emptyAiState, initializeTrial, snapshot } from "../../src/lib/templates/ai-state";

test("trial routes bind credentials and template server-side; unavailable trials never redeem", async () => {
  const originalFetch = globalThis.fetch;
  const contextKey = Symbol.for("__cloudflare-context__");
  const priorContext = Reflect.get(globalThis, contextKey);
  const priorEnv = { key: process.env.TEMPLATES_STRIPE_KEY, webhook: process.env.TEMPLATES_STRIPE_WEBHOOK_SECRET, origin: process.env.TEMPLATES_SITE_URL };
  process.env.TEMPLATES_STRIPE_KEY = "sk_test_synthetic_trial";
  process.env.TEMPLATES_STRIPE_WEBHOOK_SECRET = "whsec_synthetic_trial";
  process.env.TEMPLATES_SITE_URL = "https://shop.example";
  const token = "ab".repeat(32), accessHash = tokenHash(token), sessionId = `trial_${accessHash}`;
  const records = new Set<string>();
  let redemptions = 0, externalCalls = 0, openedOrder = "";
  const state = emptyAiState();
  let failInitialization = false;
  const authorize = (hash: string) => records.has(hash) ? { ok: true, value: { templateId: "mobile-app" } } : { ok: false, error: "Invalid trial link", status: 403 };
  const env = { TEMPLATES_TRIAL_ENABLED: "true", TEMPLATES_AI_ENABLED: "true", TEMPLATES_AI_MODEL: "synthetic", TEMPLATES_OPENAI_API_KEY: "synthetic", TEMPLATES_TRIAL_CODES: { getByName(name: string) {
    assert.equal(name, "template-trials-v1");
    return { authorize, redeem(code: string, hash: string, templateId: string) {
      redemptions++; assert.equal(code, tokenHash("SAMPLE-CODE")); assert.equal(templateId, "mobile-app"); records.add(hash); return authorize(hash);
    } };
  } }, TEMPLATES_AI_ORDERS: { getByName(name: string) {
    openedOrder = name;
    return { initializeTrial: (brief?: Parameters<typeof initializeTrial>[1]) => {
      if (failInitialization) { failInitialization = false; throw new Error("Transient write failure"); }
      return { ok: true, value: initializeTrial(state, brief) };
    }, read: () => ({ ok: true, value: snapshot(state) }) };
  } } };
  const request = (body: unknown, origin = "https://shop.example") => new Request("https://shop.example/api/templates/trial/", { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) });
  const brief = { name: "BoulderMe", idea: "Find climbing partners", features: "iOS", style: "cozy", budget: "" };
  const redemption = { action: "redeem", code: " sample-code ", templateId: "mobile-app", accessToken: token, brief, consent: true };
  try {
    globalThis.fetch = async () => { externalCalls++; throw new Error("No Stripe or OpenAI calls expected"); };
    Reflect.set(globalThis, contextKey, { env });
    assert.equal((await trial.POST(request(redemption, "https://evil.example"))).status, 403);
    for (const invalid of [{ templateId: "" }, { brief: undefined }, { brief: { ...brief, idea: "   " } }, { brief: { ...brief, idea: "x".repeat(3001) } }, { consent: false }]) {
      assert.equal((await trial.POST(request({ ...redemption, ...invalid }))).status, 400);
    }
    assert.equal(redemptions, 0, "Incomplete checkout must not consume a code use");
    env.TEMPLATES_AI_ENABLED = "false";
    assert.equal((await trial.POST(request(redemption))).status, 503);
    assert.equal(redemptions, 0);
    env.TEMPLATES_AI_ENABLED = "true";
    const response = await trial.POST(request(redemption));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { sessionId, templateId: "mobile-app", messageLimit: 3 });
    assert.deepEqual(state.initialBrief, { ...brief, decideBudget: false });
    assert.equal(snapshot(state).canStartOverview, true);
    const credentials = { sessionId, accessToken: token, action: "load", templateId: "storefront", limit: 999 };
    assert.deepEqual(await (await trial.POST(request(credentials))).json(), { templateId: "mobile-app", messageLimit: 3 });
    assert.equal((await trial.POST(request({ ...credentials, accessToken: "cd".repeat(32) }))).status, 403);
    assert.equal((await ai.POST(request({ ...credentials, sessionId: `trial_${"0".repeat(64)}` }))).status, 403);
    assert.equal((await ai.POST(request(credentials))).status, 200);
    assert.equal(openedOrder, tokenHash(sessionId));
    assert.equal((await library.POST(request(credentials))).status, 403);
    env.TEMPLATES_TRIAL_ENABLED = "false";
    assert.equal((await trial.POST(request(redemption))).status, 503);
    assert.equal((await trial.POST(request(credentials))).status, 200);
    assert.equal((await ai.POST(request(credentials))).status, 200);
    assert.equal(redemptions, 1);
    assert.equal(externalCalls, 0);
    env.TEMPLATES_TRIAL_ENABLED = "true";
    failInitialization = true;
    const retry = { ...redemption, accessToken: "ef".repeat(32) };
    assert.equal((await trial.POST(request(retry))).status, 502);
    assert.equal((await trial.POST(request(retry))).status, 200, "A retry must recover checkout after its registry write committed");
    assert.equal(records.size, 2, "Retry must use the same private access token");
  } finally {
    globalThis.fetch = originalFetch; Reflect.set(globalThis, contextKey, priorContext);
    for (const [key, value] of Object.entries({ TEMPLATES_STRIPE_KEY: priorEnv.key, TEMPLATES_STRIPE_WEBHOOK_SECRET: priorEnv.webhook, TEMPLATES_SITE_URL: priorEnv.origin })) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
