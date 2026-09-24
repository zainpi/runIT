import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { authHeaders, check, generate, priceFromEstimate, ratePer1kTokens, videoDimensions, videoTokens } from "./higgsfield-jobs.mjs";

const env = { HF_API_KEY_ID: "test-id", HF_API_KEY_SECRET: "test-secret" };
const description = "Token-metered pricing. Billable video tokens = ceil((input video seconds + generated video seconds) × output width × output height × 24 fps / 1024) ... each 1,000 video tokens cost $0.0214 ...";
const ids = { hero: "11111111-1111-4111-8111-111111111111", hook: "22222222-2222-4222-8222-222222222222", montage: "33333333-3333-4333-8333-333333333333" };
const shots = (budgetUsd = 7.5) => ({
  campaign: "test", budgetUsd,
  jobs: [
    { id: "hero", kind: "image", model: "marketing-studio/image", output: "keyframes/hero.png", maxUsd: 0.6, input: { prompt: "desk", aspect_ratio: "9:16" } },
    { id: "hook", kind: "video", model: "bytedance/seedance-2.5/image-to-video", fromImage: "hero", imageField: "image_url", output: "clips/hook.mp4", input: { prompt: "talk", duration: 5, resolution: "720p", aspect_ratio: "9:16", generate_audio: true } },
    { id: "montage", kind: "video", model: "bytedance/seedance-2.5/text-to-video", output: "clips/montage.mp4", input: { prompt: "montage", duration: 5, resolution: "720p", aspect_ratio: "9:16", generate_audio: true } },
  ],
});

async function campaign(budget) {
  const dir = await mkdtemp(join(tmpdir(), "ads-jobs-"));
  await mkdir(join(dir, "campaign"));
  await writeFile(join(dir, "campaign", "shots.json"), JSON.stringify(shots(budget)));
  return dir;
}

function fakeApi({ failSubmit } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const path = new URL(url).pathname;
    calls.push({ method: init.method ?? "GET", path, body: init.body ? JSON.parse(init.body) : undefined });
    if (url.startsWith("https://cdn.example.com/")) return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": url.endsWith(".png") ? "image/png" : "video/mp4" } });
    assert.equal(init.headers.Authorization, "Key test-id:test-secret");
    if (path.startsWith("/estimate/marketing-studio")) return Response.json({ type: "estimate", usd: "0.1400" });
    if (path.startsWith("/estimate/")) return Response.json({ type: "description", pricing_description: description });
    const job = path.includes("marketing-studio") ? "hero" : path.includes("image-to-video") ? "hook" : "montage";
    if (init.method === "POST") {
      if (failSubmit === job) throw new Error("socket hang up");
      return Response.json({ status: "queued", request_id: ids[job] });
    }
    const id = path.split("/")[2];
    const name = Object.keys(ids).find((key) => ids[key] === id);
    return Response.json({ status: "completed", request_id: id, ...(name === "hero" ? { images: [{ url: "https://cdn.example.com/hero.png" }] } : { video: { url: `https://cdn.example.com/${name}.mp4` } }) });
  };
  return { calls, fetchImpl };
}

test("prices token-metered video from the vendor rate", () => {
  assert.equal(ratePer1kTokens(description), 0.0214);
  assert.deepEqual(videoDimensions("720p", "9:16"), [720, 1280]);
  assert.equal(videoTokens({ duration: 5, resolution: "720p", aspect_ratio: "9:16" }), 108000);
  assert.equal(priceFromEstimate({ pricing_description: description }, shots().jobs[2]).usd, 2.3112);
  assert.throws(() => priceFromEstimate({ type: "description", pricing_description: "call sales" }, { id: "x", kind: "image" }), /maxUsd/);
});

test("uses env keys when present, or leaves auth to the environment proxy", () => {
  assert.deepEqual(authHeaders(env), { Authorization: "Key test-id:test-secret" });
  assert.deepEqual(authHeaders({}), {});
  assert.throws(() => authHeaders({ HF_API_KEY_ID: "only-id" }), /both/);
});

test("check is free and reports the planned spend", async () => {
  const dir = await campaign();
  try {
    const api = fakeApi();
    const result = await check(join(dir, "campaign"), { env, fetchImpl: api.fetchImpl, log: () => {} });
    assert.equal(result.ok, true);
    assert.equal(Math.round(result.planned * 100) / 100, 4.76);
    assert.ok(api.calls.every((call) => call.path.startsWith("/estimate/")));
    const hookEstimate = api.calls.find((call) => call.path.includes("image-to-video"));
    assert.match(hookEstimate.body.image_url, /^https:\/\//);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("generate submits each job once, chains the keyframe, and resumes without paying twice", async () => {
  const dir = await campaign();
  try {
    const api = fakeApi();
    const options = { env, fetchImpl: api.fetchImpl, sleep: async () => {}, log: () => {} };
    await generate(join(dir, "campaign"), join(dir, "out"), options);
    const submits = api.calls.filter((call) => call.method === "POST" && !call.path.startsWith("/estimate/"));
    assert.deepEqual(submits.map((call) => call.path), ["/marketing-studio/image", "/bytedance/seedance-2.5/image-to-video", "/bytedance/seedance-2.5/text-to-video"]);
    assert.equal(submits[1].body.image_url, "https://cdn.example.com/hero.png");
    assert.deepEqual([...(await readFile(join(dir, "out", "clips", "hook.mp4")))], [1, 2, 3]);
    const manifest = JSON.parse(await readFile(join(dir, "campaign", "manifest.json"), "utf8"));
    assert.equal(manifest.jobs.hook.request_id, ids.hook);
    assert.equal(manifest.jobs.hero.estimated_usd, 0.14);

    const before = api.calls.length;
    await generate(join(dir, "campaign"), join(dir, "out"), options);
    assert.equal(api.calls.slice(before).filter((call) => call.method === "POST" && !call.path.startsWith("/estimate/")).length, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("an uncertain submission stops the run and is never retried automatically", async () => {
  const dir = await campaign();
  try {
    const api = fakeApi({ failSubmit: "hook" });
    const options = { env, fetchImpl: api.fetchImpl, sleep: async () => {}, log: () => {} };
    await assert.rejects(generate(join(dir, "campaign"), join(dir, "out"), options), /uncertain/);
    await assert.rejects(generate(join(dir, "campaign"), join(dir, "out"), options), /uncertain/);
    const hookSubmits = api.calls.filter((call) => call.method === "POST" && call.path === "/bytedance/seedance-2.5/image-to-video");
    assert.equal(hookSubmits.length, 1);
    const manifest = JSON.parse(await readFile(join(dir, "campaign", "manifest.json"), "utf8"));
    assert.equal(manifest.jobs.hook.status, "uncertain");
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("refuses to start when the plan exceeds the budget", async () => {
  const dir = await campaign(3);
  try {
    const api = fakeApi();
    await assert.rejects(generate(join(dir, "campaign"), join(dir, "out"), { env, fetchImpl: api.fetchImpl, sleep: async () => {}, log: () => {} }), /over budget/);
    assert.equal(api.calls.filter((call) => call.method === "POST" && !call.path.startsWith("/estimate/")).length, 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
