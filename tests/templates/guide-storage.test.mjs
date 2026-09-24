import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

test("durable background guides survive lost responses and restart without consuming icon alarms or duplicating provider calls", async () => {
  const fixture = JSON.parse(await readFile(new URL("./fixtures/build-guide.json", import.meta.url), "utf8"));
  const icon = (await readFile(new URL("./fixtures/icon.png", import.meta.url))).toString("base64");
  const built = await build({ entryPoints: ["src/lib/templates/ai-order.ts"], bundle: true, format: "esm", platform: "neutral", external: ["cloudflare:workers"], write: false });
  const script = built.outputFiles[0].text + `\nexport default { async fetch(request, env) { const data = await request.json(); return Response.json(await env.ORDERS.getByName(data.order)[data.method](...data.args)); } };`;
  const directory = await mkdtemp(path.join(tmpdir(), "templates-guide-storage-"));
  let guideCalls = 0, iconCalls = 0, release;
  const gate = new Promise((resolve) => { release = resolve; });
  const options = convertV4MiniflareOptions({
    modules: true, script, compatibilityDate: "2025-03-25", durableObjects: { ORDERS: { className: "TemplateAiOrder", useSQLite: true } }, resourcePersistencePath: directory, telemetry: { enabled: false },
    bindings: { TEMPLATES_AI_ENABLED: "true", TEMPLATES_AI_MODEL: "synthetic-model", TEMPLATES_OPENAI_API_KEY: "synthetic-key", TEMPLATES_ICON_ENABLED: "true", TEMPLATES_ICON_MODEL: "gpt-image-2.5-flare-2026-09-08" },
    outboundService: async (request) => {
      if (request.url === "https://api.openai.com/v1/responses") {
        guideCalls++; await gate;
        return Response.json({ status: "completed", moderation: { input: { type: "moderation_result", flagged: false }, output: { type: "moderation_result", flagged: false } }, output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(fixture.document) }] }] });
      }
      assert.equal(request.url, "https://api.openai.com/v1/images/generations"); iconCalls++;
      return Response.json({ data: [{ b64_json: icon }] });
    },
  });
  let runtime = new Miniflare(options);
  const call = async (order, method, ...args) => (await runtime.dispatchFetch("http://test/", { method: "POST", body: JSON.stringify({ order, method, args }) })).json();
  const request = { requestId: "overview", templateId: "mobile-app", brief: fixture.brief, message: "", revision: 0, kind: "overview" };
  try {
    assert.equal((await call("paid-a", "reserve", request, "overview")).ok, true);
    await call("paid-a", "complete", "overview", { message: "Your plan", plan: fixture.plan });
    await new Promise((resolve) => setTimeout(resolve, 3050));
    const guide = { ...request, requestId: "guide-a", revision: 1, kind: "guide" };
    const attempts = await Promise.all([call("paid-a", "startGuide", guide, "guide"), call("paid-a", "startGuide", guide, "guide")]);
    assert.ok(attempts.every((r) => r.ok), JSON.stringify(attempts));
    assert.equal((await call("paid-a", "read")).value.pendingKind, "guide");
    assert.equal((await call("paid-a", "clear")).status, 409);
    assert.equal((await call("paid-a", "startGuide", { ...guide, requestId: "competing" }, "competing")).status, 409);
    // Enqueue an icon while guide generation is in flight: both share one alarm.
    assert.equal((await call("paid-a", "startIcon", { requestId: "icon-a", templateId: "mobile-app", brief: fixture.brief, direction: "A climbing icon" }, "icon")).ok, true);
    release();
    let saved, image;
    for (let i = 0; i < 100; i++) {
      saved = (await call("paid-a", "read")).value;
      image = (await call("paid-a", "readIcon")).value;
      if (!saved.pending && image.status !== "pending") break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(saved.projects["mobile-app"].guide?.document.title, fixture.document.title, saved.guideError);
    assert.equal(saved.remaining, 20); assert.equal(image.status, "complete"); assert.equal(guideCalls, 1); assert.equal(iconCalls, 1);
    await runtime.dispose(); runtime = new Miniflare(options);
    const restored = (await call("paid-a", "read")).value;
    assert.deepEqual(restored.projects["mobile-app"].guide.document, fixture.document);
    assert.equal(restored.projects["mobile-app"].appliedRevision, 1);
    assert.deepEqual((await call("paid-b", "read")).value.projects, {});
    assert.equal((await call("paid-a", "startGuide", guide, "guide")).ok, true);
    assert.equal(guideCalls, 1);
    await call("paid-a", "clear");
    const cleared = (await call("paid-a", "read")).value;
    assert.deepEqual(cleared.projects, {}); assert.deepEqual(cleared.guideUsed, ["mobile-app"]);
    assert.equal((await call("paid-a", "readIcon")).value.status, "complete");
  } finally { release(); await runtime.dispose(); await rm(directory, { recursive: true, force: true }); }
});
