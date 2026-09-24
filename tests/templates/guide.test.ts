import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import fixture from "./fixtures/build-guide.json";
import { AiError, type AiGeneration, type AiProject } from "../../src/lib/templates/ai-contract";
import { claimGuide, clearContent, completeGeneration, completeGuide, emptyAiState, expirePending, failGeneration, initializeTrial, reserveGeneration, snapshot } from "../../src/lib/templates/ai-state";
import { GUIDE_LEASE_MS, parseBuildGuide, type GuideArtifact } from "../../src/lib/templates/guide-contract";
import { buildGuideHtml } from "../../src/lib/templates/guide-html";
import { composePrompt } from "../../src/lib/templates/compose";
import { generateBuildGuide } from "../../src/lib/templates/guide-provider";
import { handleAiRequest, type AiOrderStore } from "../../src/lib/templates/ai-service";

const document = parseBuildGuide(fixture.document, fixture.plan);
const project = (): AiProject => ({ brief: fixture.brief, plan: fixture.plan, revision: 1, history: [], appliedPlan: null, appliedBrief: null, appliedRevision: null });
const request = (): AiGeneration => ({ requestId: randomUUID(), templateId: "mobile-app", revision: 1, brief: fixture.brief, kind: "guide", message: "" });
const ready = () => { const state = emptyAiState(); state.projects["mobile-app"] = project(); return state; };
const artifact: GuideArtifact = { id: "sample-guide", generatedAt: "2026-09-23T00:00:00Z", sourceRevision: 1, brief: fixture.brief, plan: fixture.plan, document };

test("guide completeness rejects missing features, sections, resources, invalid or unreachable screen graphs and excessive output", () => {
  for (const mutate of [
    (d: typeof fixture.document) => d.featureCoverage.pop(),
    (d: typeof fixture.document) => { d.featureCoverage[1].featureIndex = 0; },
    (d: typeof fixture.document) => { d.sections[1].id = d.sections[0].id; },
    (d: typeof fixture.document) => { d.services[0].resourceId = "https://evil.example"; },
    (d: typeof fixture.document) => { d.screens[0].actions[0].target = "missing"; },
    (d: typeof fixture.document) => { d.screens[0].actions[0].target = "discover"; },
    (d: typeof fixture.document) => { d.steps[0].instructions = ["Skip setup"]; },
    (d: typeof fixture.document) => { d.summary = "x".repeat(100_001); },
  ]) { const value = structuredClone(fixture.document); mutate(value); assert.throws(() => parseBuildGuide(value, fixture.plan), /completeness/); }
});

test("first guide is included even at message limit; regeneration charges, replay is safe, failure refunds and old guides persist", () => {
  const state = ready(), first = request(); state.used = 20;
  reserveGeneration(state, first, "first", 100_000);
  assert.equal(reserveGeneration(state, first, "first", 100_001), "replay");
  assert.equal(claimGuide(state, 100_002)?.request.requestId, first.requestId);
  assert.equal(claimGuide(state, 100_003), null);
  completeGuide(state, first.requestId, document, 100_004);
  assert.equal(state.used, 20);
  assert.equal(state.projects["mobile-app"]!.appliedRevision, 1);
  assert.throws(() => reserveGeneration(state, request(), "second", 104_000), /All 20/);
  state.used = 2;
  const second = request(); reserveGeneration(state, second, "second", 108_000);
  assert.equal(state.used, 3);
  expirePending(state, 108_000 + GUIDE_LEASE_MS + 1);
  assert.equal(state.used, 2);
  failGeneration(state, second.requestId); assert.equal(state.used, 2);
  assert.throws(() => completeGuide(state, second.requestId, document, 500_000), /expired/);
  assert.equal(state.projects["mobile-app"]!.guide!.id, first.requestId);
  const edit = { ...request(), kind: "message" as const, message: "Add a feature" };
  reserveGeneration(state, edit, "edit", 501_000);
  completeGeneration(state, edit.requestId, { message: "Updated", plan: fixture.plan }, 501_001);
  assert.equal(state.projects["mobile-app"]!.guide!.sourceRevision, 1);
  assert.equal(state.projects["mobile-app"]!.revision, 2);
  clearContent(state); assert.deepEqual(state.guideUsed, ["mobile-app"]); assert.equal(state.used, 3);
  assert.deepEqual(snapshot(state).projects, {});
});

test("guides reject stale briefs/revisions and trials without spending or starting jobs", () => {
  const state = ready();
  assert.throws(() => reserveGeneration(state, { ...request(), revision: 0 }, "old", 100_000), /another device/);
  assert.throws(() => reserveGeneration(state, { ...request(), brief: { ...fixture.brief, idea: "Different app" } }, "different", 100_000), /review/);
  initializeTrial(state);
  assert.throws(() => reserveGeneration(state, request(), "trial", 100_000), /purchased/);
  assert.equal(state.attempts, 0); assert.equal(state.pending, null);
});

test("one-file HTML escapes malicious strings and keeps mode, entitled foundation and official resources", () => {
  const malicious = '</textarea><script>globalThis.pwned=true</script><img src=x onerror="alert(1)">';
  const value = structuredClone(artifact); value.document.title = malicious; value.document.screens[0].actions[0].feedback = malicious;
  const prompt = composePrompt("Mobile app", "PAID_FOUNDATION", fixture.brief, "manual", undefined, undefined, fixture.plan, value);
  const html = buildGuideHtml(value, prompt);
  assert.equal((html.match(/<script>/g) || []).length, 1);
  assert.doesNotMatch(html, /<img|<script>globalThis|<iframe|https:\/\/evil/);
  assert.match(html, /&lt;script&gt;globalThis/);
  assert.match(html, /connect-src 'none'/); assert.match(html, /form-action 'none'/);
  assert.match(html, /PAID_FOUNDATION/); assert.match(html, /Do not operate my computer/);
  assert.match(html, /https:\/\/supabase.com\/docs/);
  assert.doesNotMatch(prompt, /=== SUBAGENT WORKFLOW ===|=== SKILL TREE SETUP ===/);
});

test("guide provider uses strict bounded data, fails closed on incomplete, unsafe and malformed responses", async () => {
  const original = globalThis.fetch;
  let body: Record<string, any> = {};
  const moderation = { input: { type: "moderation_result", flagged: false }, output: { type: "moderation_result", flagged: false } };
  const response = { status: "completed", moderation, output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(document) }] }] };
  const config = { TEMPLATES_AI_ENABLED: "true", TEMPLATES_OPENAI_API_KEY: "synthetic-key", TEMPLATES_AI_MODEL: "synthetic-model", TEMPLATES_AI_REASONING_EFFORT: "max" };
  try {
    globalThis.fetch = async (_url, options) => { body = JSON.parse(String(options?.body)); return Response.json(response); };
    assert.deepEqual(await generateBuildGuide(config, request(), project()), document);
    assert.equal(body.store, false); assert.equal(body.text.format.strict, true); assert.equal(body.reasoning.effort, "max");
    assert.equal(body.max_output_tokens, 32_000); assert.doesNotMatch(JSON.stringify(body), /synthetic-key|accessToken|sessionId|PAID_FOUNDATION/);
    for (const bad of [{ ...response, status: "incomplete" }, { ...response, moderation: undefined }, { ...response, moderation: { ...moderation, input: { ...moderation.input, flagged: true } } }, { ...response, output: [{ type: "message", content: [{ type: "output_text", text: "{}" }] }] }]) {
      globalThis.fetch = async () => Response.json(bad);
      await assert.rejects(generateBuildGuide(config, request(), project()), /could not finish/);
    }
  } finally { globalThis.fetch = original; }
});

test("guide API verifies paid access on start and every poll, queues once and excludes trials", async () => {
  const state = ready(); let revoked = false, queued = 0;
  const op = async <T>(fn: () => T) => { try { return { ok: true as const, value: fn() }; } catch (e) { if (e instanceof AiError) return { ok: false as const, error: e.message, status: e.status }; throw e; } };
  const store: AiOrderStore = {
    initializeTrial: () => op(() => initializeTrial(state)), read: () => op(() => snapshot(state)),
    reserve: () => { throw new Error("must use background queue"); }, complete: () => { throw new Error("must not complete inline"); },
    fail: (id) => op(() => { failGeneration(state, id); return snapshot(state); }), clear: () => op(() => { clearContent(state); return snapshot(state); }), apply: () => op(() => snapshot(state)),
    startGuide: (req, fingerprint) => op(() => { if (reserveGeneration(state, req, fingerprint, 100_000) === "reserved") queued++; return snapshot(state); }),
  };
  const authorize = async () => { if (revoked) throw new AiError("Revoked", 403); return ["mobile-app"] as ["mobile-app"]; };
  const deps = { authorize, authorizeTrial: authorize, configuration: async () => ({ enabled: true, key: "synthetic", model: "synthetic" }), store: () => store, generate: async () => { throw new Error("must not generate inline"); } };
  const send = (data: Record<string, unknown>) => handleAiRequest(new Request("https://shop.example/api/templates/ai/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: "cs_test_1234567890abcdef", accessToken: "ab".repeat(32), ...data }) }), deps);
  const req = { ...request(), action: "guide", consent: true };
  assert.equal((await send({ ...req, consent: false })).status, 400);
  assert.equal((await send({ ...req, templateId: "browser-game" })).status, 403);
  assert.equal((await send(req)).status, 202); assert.equal((await send(req)).status, 202); assert.equal(queued, 1);
  assert.equal((await send({ ...req, sessionId: "trial_" + "a".repeat(64) })).status, 403);
  revoked = true;
  assert.equal((await send({ action: "load" })).status, 403);
});
