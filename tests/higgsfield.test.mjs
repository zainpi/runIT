import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { submit, status, wait } from "../scripts/higgsfield.mjs";

const job = "c413143e-c5ce-44c3-a38e-93d127309dc1";
const requestId = "38fd48e0-760c-465f-988e-f3ba57a5101f";
const flags = { job, prompt: "A cinematic ad featuring an adult Asian woman reviewing an AI app template", duration: "5", resolution: "720p", aspect: "9:16" };
const env = { HF_API_KEY_ID: "test-id", HF_API_KEY_SECRET: "test-secret" };
const response = (value, statusCode = 200) => new Response(JSON.stringify(value), { status: statusCode, headers: { "x-correlation-id": "corr-1" } });

test("stores request ID, prevents duplicate paid submission, and retrieves completed video", async () => {
  const dir = await mkdtemp(join(tmpdir(), "higgsfield-test-"));
  let posts = 0;
  try {
    const fetchImpl = async (url, init) => {
      assert.equal(init.headers.Authorization, "Key test-id:test-secret");
      if (init.method === "POST") {
        posts++;
        assert.equal(url, "https://api.higgsfield.ai/bytedance/seedance-2.0/text-to-video");
        assert.equal(JSON.parse(init.body).aspect_ratio, "9:16");
        return response({ status: "queued", request_id: requestId, status_url: `https://api.higgsfield.ai/requests/${requestId}/status` });
      }
      return response({ status: "completed", request_id: requestId, video: { url: "https://cdn.example.com/ad.mp4" } });
    };
    const submitted = await submit(flags, { dir, env, fetchImpl });
    assert.equal(submitted.request_id, requestId);
    await assert.rejects(submit(flags, { dir, env, fetchImpl }), /already exists/);
    assert.equal(posts, 1);
    const finished = await status(job, { dir, env, fetchImpl });
    assert.equal(finished.status, "completed");
    assert.equal(finished.video_url, "https://cdn.example.com/ad.mp4");
    assert.equal((await wait(job, { dir, env, fetchImpl })).status, "completed");
    assert.equal(posts, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("uncertain submission is retained and never automatically retried", async () => {
  const dir = await mkdtemp(join(tmpdir(), "higgsfield-test-"));
  let calls = 0;
  try {
    const fetchImpl = async () => { calls++; throw new Error("network timeout"); };
    await assert.rejects(submit(flags, { dir, env, fetchImpl }), /outcome is uncertain/);
    const saved = JSON.parse(await readFile(join(dir, `${job}.json`), "utf8"));
    assert.equal(saved.status, "uncertain");
    await assert.rejects(submit(flags, { dir, env, fetchImpl }), /already exists/);
    assert.equal(calls, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test("validates inputs before submission", async () => {
  const dir = await mkdtemp(join(tmpdir(), "higgsfield-test-"));
  try {
    await assert.rejects(submit({ ...flags, duration: "16" }, { dir, env, fetchImpl: () => assert.fail("no request expected") }), /Duration/);
    await assert.rejects(submit(flags, { dir, env: {}, fetchImpl: () => assert.fail("no request expected") }), /HF_API_KEY_ID/);
    await assert.rejects(status("e2aef10e-10a3-4522-9ec5-0ad41f9232e6", { dir, env }), /not found/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
