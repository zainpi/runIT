import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { AiError } from "../../src/lib/templates/ai-contract";
import { emptyPersonalization } from "../../src/lib/templates/compose";
import { ICON_LEASE_MS, type IconRequest } from "../../src/lib/templates/icon-contract";
import { claimIcon, completeIcon, deleteIcon, emptyIconState, failIcon, iconSnapshot, reserveIcon } from "../../src/lib/templates/icon-state";
import { decodeIcon, generateAppIcon, iconProviderConfiguration } from "../../src/lib/templates/icon-provider";
import { handleIconRequest, type IconOrderStore } from "../../src/lib/templates/icon-service";

const png = readFileSync(new URL("./fixtures/icon.png", import.meta.url));
const base64 = png.toString("base64");
const input: IconRequest = { requestId: "00000000-0000-4000-8000-000000000001", templateId: "mobile-app", brief: { name: "Climb", idea: "Find climbing partners", style: "Warm green" }, direction: "A mountain silhouette" };
const config = iconProviderConfiguration({ TEMPLATES_ICON_ENABLED: "true", TEMPLATES_ICON_MODEL: "gpt-image-2.5-flare-2026-09-08", TEMPLATES_OPENAI_API_KEY: "synthetic-icon-key" });

test("one original and three updates per order preserve versions, retries and the quota after deletion", () => {
  const state = emptyIconState();
  assert.equal(reserveIcon(state, input, "first"), true);
  assert.equal(reserveIcon(state, input, "first"), false);
  assert.throws(() => reserveIcon(state, input, "different"), /different brief/);
  assert.throws(() => reserveIcon(state, { ...input, requestId: "second" }, "second"), /still being generated/);
  assert.equal(state.attempts, 1);
  assert.deepEqual(claimIcon(state, 1000), input);
  assert.equal(claimIcon(state, 1001), null, "duplicate alarm must not call the provider again");
  assert.throws(() => deleteIcon(state), /Wait/);
  assert.equal(completeIcon(state, input.requestId, 1100), true);
  assert.equal(iconSnapshot(state, base64).status, "complete");
  assert.equal(reserveIcon(state, input, "first"), false);
  assert.equal(iconSnapshot(state).updatesRemaining, 3);
  assert.throws(() => reserveIcon(state, { ...input, requestId: "new" }, "new"), /Choose a saved/);
  assert.throws(() => reserveIcon(state, { ...input, requestId: "new", baseVersion: "other-order" }, "new"), /Choose a saved/);
  assert.throws(() => reserveIcon(state, { ...input, requestId: "new", baseVersion: input.requestId, direction: " " }, "new"), /Describe/);
  for (const number of [2, 3, 4]) {
    const update = { ...input, requestId: `update-${number}`, baseVersion: input.requestId };
    reserveIcon(state, update, update.requestId);
    assert.equal(completeIcon(state, update.requestId, 2000 + number), true);
    assert.equal(iconSnapshot(state).updatesRemaining, 4 - number);
  }
  assert.equal(state.versions.length, 4);
  assert.equal(iconSnapshot(state, base64, input.requestId).image?.number, 1);
  assert.equal(iconSnapshot(state, base64).image?.number, 4);
  assert.equal(state.versions[3].baseVersion, input.requestId, "updates can branch from an earlier version");
  assert.throws(() => reserveIcon(state, { ...input, requestId: "fifth", baseVersion: input.requestId }, "new"), /All three/);
  deleteIcon(state);
  assert.equal(iconSnapshot(state).status, "deleted");
  assert.equal(iconSnapshot(state).canGenerate, false);
  assert.throws(() => reserveIcon(state, { ...input, requestId: "new" }, "new"), /All three/);
  assert.equal(state.generated, 4);
});

test("interrupted and failed icon attempts require explicit bounded retries", () => {
  const state = emptyIconState();
  reserveIcon(state, input, "one");
  claimIcon(state, 1000);
  assert.equal(claimIcon(state, 1000 + ICON_LEASE_MS), null);
  assert.equal(iconSnapshot(state).status, "failed");
  assert.equal(state.generated, 0);
  assert.equal(completeIcon(state, input.requestId, 1000 + ICON_LEASE_MS), false, "late results cannot overwrite another attempt");
  for (const id of ["two", "three"]) {
    reserveIcon(state, { ...input, requestId: id }, id);
    failIcon(state, id, "Retry");
  }
  assert.equal(iconSnapshot(state).canGenerate, false);
  assert.throws(() => reserveIcon(state, { ...input, requestId: "four" }, "four"), /Contact support/);
});

test("failed updates leave old versions and all remaining updates intact", () => {
  const state = emptyIconState();
  reserveIcon(state, input, "one"); completeIcon(state, input.requestId, 1000);
  const update = { ...input, requestId: "update", baseVersion: input.requestId };
  reserveIcon(state, update, "update"); failIcon(state, update.requestId, "Retry");
  assert.equal(iconSnapshot(state).updatesRemaining, 3);
  assert.equal(iconSnapshot(state, base64).image?.id, input.requestId);
  assert.equal(iconSnapshot(state).canGenerate, true);
  deleteIcon(state);
  assert.equal(iconSnapshot(state).canGenerate, false);
  assert.throws(() => reserveIcon(state, { ...update, requestId: "after-delete" }, "new"), /deleted/);
});

test("image provider uses a fixed bounded request and accepts only a square PNG", async () => {
  const original = globalThis.fetch;
  const calls: Record<string, unknown>[] = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.openai.com/v1/images/generations");
    calls.push(JSON.parse(String(init?.body)));
    return Response.json({ data: [{ b64_json: base64 }] });
  };
  try {
    assert.equal(await generateAppIcon(config, input), base64);
    assert.deepEqual({ ...calls[0], prompt: undefined }, { model: config.model, n: 1, size: "1024x1024", quality: "high", output_format: "png", background: "opaque", moderation: "auto", prompt: undefined });
    assert.match(String(calls[0].prompt), /Find climbing partners/);
    assert.doesNotMatch(String(calls[0].prompt), /synthetic-icon-key|requestId|accessToken|sessionId/);
    globalThis.fetch = async (url, init) => {
      assert.equal(url, "https://api.openai.com/v1/images/edits");
      assert.ok(init?.body instanceof FormData);
      const form = init.body;
      assert.equal(form.get("model"), config.model);
      assert.equal(form.get("n"), "1");
      assert.equal(form.get("size"), "1024x1024");
      assert.match(String(form.get("prompt")), /Update the supplied app icon/);
      assert.deepEqual(Buffer.from(await (form.get("image[]") as Blob).arrayBuffer()), png);
      assert.equal(new Headers(init.headers).has("Content-Type"), false, "fetch supplies the multipart boundary");
      return Response.json({ data: [{ b64_json: base64 }] });
    };
    assert.equal(await generateAppIcon(config, { ...input, baseVersion: input.requestId }, base64), base64);
    await assert.rejects(() => generateAppIcon(config, { ...input, baseVersion: input.requestId }), AiError);
    assert.deepEqual(Buffer.from(decodeIcon(base64)), png);
    for (const bad of ["not a png", Buffer.from("<svg></svg>").toString("base64"), base64.slice(0, -1)]) assert.throws(() => decodeIcon(bad));
    const wrongSize = Buffer.from(png); wrongSize.writeUInt32BE(2048, 16);
    assert.throws(() => decodeIcon(wrongSize.toString("base64")), /dimensions/);
    globalThis.fetch = async () => Response.json({ error: { message: "private provider detail" } }, { status: 500 });
    await assert.rejects(() => generateAppIcon(config, input), (error: unknown) => error instanceof AiError && !error.message.includes("private provider detail"));
    assert.equal(iconProviderConfiguration({ TEMPLATES_ICON_ENABLED: "true", TEMPLATES_ICON_MODEL: "client-chosen-model", TEMPLATES_OPENAI_API_KEY: "key" }).enabled, false);
  } finally { globalThis.fetch = original; }
});

test("icon API validates generation, restores the saved image and downloads while generation is paused", async () => {
  const state = emptyIconState();
  const store: IconOrderStore = {
    async readIcon(versionId) { return { ok: true, value: iconSnapshot(state, base64, versionId) }; },
    async startIcon(request, fingerprint) { reserveIcon(state, request, fingerprint); return { ok: true, value: iconSnapshot(state) }; },
    async deleteIcon() { deleteIcon(state); return { ok: true, value: iconSnapshot(state) }; },
  };
  const deps = { authorize: async () => ({ ids: ["mobile-app"] as ["mobile-app"], appIcon: true }), configuration: async () => config, store: () => store };
  const call = (data: Record<string, unknown>) => handleIconRequest(new Request("https://runsit.ca/api/templates/icon/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: "cs_test_1234567890abcdef", accessToken: "ab".repeat(32), ...data }) }), deps);
  const generate = { action: "generate", ...input, brief: { ...emptyPersonalization, ...input.brief }, consent: true };
  assert.equal((await call({ ...generate, consent: false })).status, 400);
  assert.equal((await call({ ...generate, direction: "x".repeat(801) })).status, 400);
  assert.equal((await call({ ...generate, templateId: "storefront" })).status, 403);
  assert.equal(state.attempts, 0);
  assert.equal((await call(generate)).status, 202);
  assert.equal((await call(generate)).status, 202);
  assert.equal(state.attempts, 1);
  completeIcon(state, input.requestId, Date.now());
  const secondId = "00000000-0000-4000-8000-000000000002";
  assert.equal((await call({ ...generate, requestId: secondId, baseVersion: input.requestId, direction: "Make it blue" })).status, 202);
  completeIcon(state, secondId, Date.now());
  deps.configuration = async () => ({ ...config, enabled: false });
  const restored = await call({ action: "load" });
  const saved = await restored.json();
  assert.equal(saved.available, false);
  assert.equal(saved.state.image.base64, base64);
  assert.equal(saved.state.image.number, 2);
  assert.equal(saved.state.updatesRemaining, 2);
  assert.equal((await call({ action: "download", versionId: "00000000-0000-4000-8000-000000000003" })).status, 404);
  assert.equal((await call({ action: "download", versionId: 3 })).status, 400);
  const download = await call({ action: "download", versionId: input.requestId });
  assert.equal(download.status, 200);
  assert.equal(download.headers.get("Content-Type"), "image/png");
  assert.match(download.headers.get("Content-Disposition")!, /climb-icon-v1.png/);
  assert.equal(download.headers.get("Cache-Control"), "private, no-store");
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), png);
  assert.equal((await call({ action: "delete" })).status, 200);
  assert.equal((await call({ action: "download" })).status, 409);
  assert.equal(state.generated, 2);
});
