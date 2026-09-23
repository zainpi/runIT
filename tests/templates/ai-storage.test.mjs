import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

test("real SQLite Durable Object persists across restarts and serializes competing reservations", async () => {
  const built = await build({ entryPoints: ["src/lib/templates/ai-order.ts"], bundle: true, format: "esm", platform: "neutral", external: ["cloudflare:workers"], write: false });
  // Test-only gateway. Production exposes the object only behind paid-order verification.
  const script = built.outputFiles[0].text + `\nexport default { async fetch(request, env) { const data = await request.json(); return Response.json(await env.ORDERS.getByName(data.order)[data.method](...data.args)); } };`;
  const directory = await mkdtemp(path.join(tmpdir(), "templates-ai-storage-"));
  const options = convertV4MiniflareOptions({ modules: true, script, compatibilityDate: "2025-03-25", durableObjects: { ORDERS: { className: "TemplateAiOrder", useSQLite: true } }, resourcePersistencePath: directory, telemetry: { enabled: false } });
  let runtime = new Miniflare(options);
  const call = async (order, method, ...args) => (await runtime.dispatchFetch("http://test/", { method: "POST", body: JSON.stringify({ order, method, args }) })).json();
  const request = { requestId: "test-request", templateId: "mobile-app", kind: "overview", revision: 0, message: "", brief: { name: "BoulderMe", idea: "Climbing buddies", features: "iOS", style: "cozy", budget: "" } };
  const reply = { message: "Your overview", plan: { overview: "Find climbers.", features: [{ part: "Profile", description: "Show skills and memberships." }], assumptions: [], questions: [] } };
  try {
    const competing = await Promise.all([call("purchase-a", "reserve", request, "one"), call("purchase-a", "reserve", { ...request, requestId: "different" }, "two")]);
    assert.equal(competing.filter((result) => result.ok).length, 1);
    const winner = competing[0].ok ? "test-request" : "different";
    assert.equal((await call("purchase-a", "complete", winner, reply)).ok, true);
    assert.equal((await call("purchase-a", "apply", "mobile-app", 1)).ok, true);
    assert.deepEqual((await call("purchase-b", "read")).value.projects, {});
    const checkout = (await call("trial-a", "initializeTrial", request.brief)).value;
    assert.equal(checkout.remaining, 3);
    assert.equal(checkout.canStartOverview, true);
    assert.deepEqual(checkout.initialBrief, request.brief);
    await call("trial-a", "initializeTrial", { ...request.brief, idea: "A stale checkout retry" });
    await runtime.dispose();
    runtime = new Miniflare(options);
    const trialRestored = (await call("trial-a", "initializeTrial")).value;
    assert.equal(trialRestored.limit, 3);
    assert.deepEqual(trialRestored.initialBrief, request.brief);
    assert.equal(trialRestored.overviewConsent, true);
    await call("trial-a", "reserve", request, "overview");
    assert.equal((await call("trial-a", "read")).value.canStartOverview, false, "Reloads must not automatically retry a started overview");
    await call("trial-a", "complete", request.requestId, reply);
    assert.equal((await call("trial-a", "read")).value.remaining, 3);
    await call("trial-a", "clear");
    const trialDeleted = (await call("trial-a", "initializeTrial", request.brief)).value;
    assert.equal(trialDeleted.initialBrief, undefined, "Checkout replay must not restore deleted personal content");
    assert.equal(trialDeleted.overviewConsent, false);
    assert.equal(trialDeleted.canStartOverview, false);
    assert.deepEqual(trialDeleted.projects, {});
    const restored = (await call("purchase-a", "read")).value;
    assert.equal(restored.projects["mobile-app"].brief.name, "BoulderMe");
    assert.deepEqual(restored.projects["mobile-app"].appliedPlan, reply.plan);
    assert.equal(restored.remaining, 20);
    assert.equal(restored.pending, false);
    await call("purchase-a", "clear");
    const deleted = (await call("purchase-a", "read")).value;
    assert.deepEqual(deleted.projects, {});
    assert.deepEqual(deleted.overviewUsed, ["mobile-app"]);
  } finally { await runtime.dispose(); await rm(directory, { recursive: true, force: true }); }
});

test("trial code has exactly 50 durable uses, atomic redemption and recoverable access", async () => {
  const built = await build({ entryPoints: ["src/lib/templates/trial-codes.ts"], bundle: true, format: "esm", platform: "neutral", external: ["cloudflare:workers"], write: false });
  const script = built.outputFiles[0].text + `\nexport default { async fetch(request, env) { const data = await request.json(); return Response.json(await env.CODES.getByName("template-trials-v1")[data.method](...data.args)); } };`;
  const directory = await mkdtemp(path.join(tmpdir(), "templates-trial-storage-"));
  const options = convertV4MiniflareOptions({ modules: true, script, compatibilityDate: "2025-03-25", durableObjects: { CODES: { className: "TemplateTrialCodes", useSQLite: true } }, resourcePersistencePath: directory, telemetry: { enabled: false } });
  let runtime = new Miniflare(options);
  const call = async (method, ...args) => (await runtime.dispatchFetch("http://test/", { method: "POST", body: JSON.stringify({ method, args }) })).json();
  const codeHash = "f8875bc63316f453c359921fec361600e0e6f220269a743c75a486dec60455e5";
  const token = (i) => i.toString(16).padStart(64, "0");
  try {
    assert.equal((await call("redeem", "invalid", token(999), "mobile-app")).status, 400);
    assert.equal((await call("authorize", token(999))).status, 403);
    const retry = await Promise.all(Array.from({ length: 5 }, () => call("redeem", codeHash, token(1), "mobile-app")));
    assert.ok(retry.every((r) => r.ok));
    assert.equal((await call("redeem", codeHash, token(1), "browser-game")).status, 409);
    const batch = await Promise.all(Array.from({ length: 59 }, (_, i) => call("redeem", codeHash, token(i + 2), "mobile-app")));
    assert.equal(batch.filter((r) => r.ok).length, 49);
    assert.equal(batch.filter((r) => r.status === 410).length, 10);
    await runtime.dispose(); runtime = new Miniflare(options);
    assert.equal((await call("redeem", codeHash, token(999), "mobile-app")).status, 410);
    assert.equal((await call("redeem", codeHash, token(1), "mobile-app")).ok, true);
    assert.deepEqual((await call("authorize", token(1))).value, { templateId: "mobile-app" });
  } finally { await runtime.dispose(); await rm(directory, { recursive: true, force: true }); }
});
