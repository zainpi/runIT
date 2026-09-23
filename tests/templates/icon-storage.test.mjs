import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";

test("icon versions persist across restart, edit selected image bytes and enforce exactly three updates", async () => {
  const built = await build({ entryPoints: ["src/lib/templates/ai-order.ts"], bundle: true, format: "esm", platform: "neutral", external: ["cloudflare:workers"], write: false });
  const script = built.outputFiles[0].text + `\nexport default { async fetch(request, env) { const data = await request.json(); return Response.json(await env.ORDERS.getByName(data.order)[data.method](...data.args)); } };`;
  const directory = await mkdtemp(path.join(tmpdir(), "templates-icon-storage-"));
  // Pad the provider fixture to exercise images larger than a single SQLite row.
  const base64 = Buffer.concat([await readFile(new URL("./fixtures/icon.png", import.meta.url)), Buffer.alloc(2 * 1024 * 1024)]).toString("base64");
  let calls = 0, releaseProvider;
  const providerGate = new Promise((resolve) => { releaseProvider = resolve; });
  const options = convertV4MiniflareOptions({
    modules: true, script, compatibilityDate: "2025-03-25",
    durableObjects: { ORDERS: { className: "TemplateAiOrder", useSQLite: true } }, resourcePersistencePath: directory, telemetry: { enabled: false },
    bindings: { TEMPLATES_ICON_ENABLED: "true", TEMPLATES_ICON_MODEL: "gpt-image-2.5-flare-2026-09-08", TEMPLATES_OPENAI_API_KEY: "synthetic-key" },
    outboundService: async (request) => {
      assert.equal(request.url, `https://api.openai.com/v1/images/${calls ? "edits" : "generations"}`);
      if (calls) {
        const form = await request.formData();
        assert.equal(Buffer.from(await form.get("image[]").arrayBuffer()).toString("base64"), base64);
      }
      calls++;
      await providerGate;
      return Response.json({ data: [{ b64_json: calls === 1 ? base64 : Buffer.concat([Buffer.from(base64, "base64"), Buffer.from([calls])]).toString("base64") }] });
    },
  });
  let runtime = new Miniflare(options);
  const call = async (order, method, ...args) => (await runtime.dispatchFetch("http://test/", { method: "POST", body: JSON.stringify({ order, method, args }) })).json();
  const input = { requestId: "icon-request", templateId: "mobile-app", brief: { name: "Climb", idea: "Climbing buddies", style: "cozy" }, direction: "A mountain" };
  try {
    const competing = await Promise.all([call("paid-a", "startIcon", input, "one"), call("paid-a", "startIcon", { ...input, requestId: "different" }, "two")]);
    assert.equal(competing.filter((value) => value.ok).length, 1);
    assert.equal((await call("paid-a", "readIcon")).value.status, "pending");
    assert.equal((await call("paid-a", "deleteIcon")).status, 409);
    releaseProvider();
    let saved;
    for (let attempt = 0; attempt < 80; attempt++) {
      saved = (await call("paid-a", "readIcon")).value;
      if (saved.status !== "pending") break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(saved.status, "complete", JSON.stringify({ status: saved.status, error: saved.error }));
    assert.equal(calls, 1);
    assert.equal(saved.image.base64, base64);
    await runtime.dispose(); runtime = new Miniflare(options);
    const restored = (await call("paid-a", "readIcon")).value;
    assert.equal(restored.image.base64, base64);
    assert.equal(restored.canGenerate, true);
    assert.equal(restored.updatesRemaining, 3);
    assert.equal((await call("paid-b", "readIcon")).value.status, "ready");
    assert.equal((await call("paid-a", "read")).value.remaining, 20, "image usage must not consume chat messages");
    await call("paid-a", "clear");
    assert.equal((await call("paid-a", "readIcon")).value.status, "complete", "deleting chat must not reset or remove the icon");
    const originalId = restored.image.id;
    for (const number of [2, 3, 4]) {
      const update = { ...input, requestId: `update-${number}`, baseVersion: originalId, direction: `Update ${number}` };
      const attempts = await Promise.all([call("paid-a", "startIcon", update, update.requestId), call("paid-a", "startIcon", update, update.requestId)]);
      assert.ok(attempts.every((value) => value.ok), "duplicate request must replay without using another update");
      for (let attempt = 0; attempt < 80; attempt++) {
        saved = (await call("paid-a", "readIcon")).value;
        if (saved.status !== "pending") break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      assert.equal(saved.status, "complete");
      assert.equal(saved.image.number, number);
      assert.equal(saved.image.base64, Buffer.concat([Buffer.from(base64, "base64"), Buffer.from([number])]).toString("base64"));
      assert.equal(saved.updatesRemaining, 4 - number);
      assert.equal(saved.versions.length, number);
      assert.equal((await call("paid-a", "readIcon", originalId)).value.image.base64, base64);
      assert.equal(calls, number);
    }
    await runtime.dispose(); runtime = new Miniflare(options);
    assert.equal((await call("paid-a", "readIcon")).value.versions.length, 4);
    assert.equal((await call("paid-a", "readIcon")).value.canGenerate, false);
    assert.equal((await call("paid-b", "readIcon", originalId)).status, 404);
    assert.equal((await call("paid-a", "startIcon", { ...input, requestId: "fifth", baseVersion: originalId }, "five")).status, 409);
    await call("paid-a", "deleteIcon");
    assert.equal((await call("paid-a", "readIcon")).value.status, "deleted");
    assert.equal((await call("paid-a", "startIcon", { ...input, requestId: "third" }, "three")).status, 409);
    assert.equal(calls, 4);
  } finally { releaseProvider(); await runtime.dispose(); await rm(directory, { recursive: true, force: true }); }
});
