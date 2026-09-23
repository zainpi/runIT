#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, writeFile } from "node:fs/promises";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const base = "https://api.higgsfield.ai";
const model = "bytedance/seedance-2.0/text-to-video";
const terminal = new Set(["completed", "failed", "nsfw", "canceled"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const stateDir = join(root, ".higgsfield", "requests");

function fail(message) { throw new Error(message); }
function credentials(env = process.env) {
  const id = env.HF_API_KEY_ID;
  const secret = env.HF_API_KEY_SECRET;
  if (!id || !secret || /[:\r\n]/.test(id) || /[\r\n]/.test(secret)) fail("Set HF_API_KEY_ID and HF_API_KEY_SECRET in the agent's server-side environment.");
  return `Key ${id}:${secret}`;
}
function requestUrl(value, id) {
  const url = new URL(value);
  if (url.origin !== base || url.pathname !== `/requests/${id}/status` || url.search || url.hash) fail("Higgsfield returned an unexpected status URL.");
  return url.href;
}
function mediaUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || ["localhost", "127.0.0.1", "::1"].includes(url.hostname)) fail("Higgsfield returned an invalid media URL.");
  return url.href;
}
function recordPath(id, dir = stateDir) {
  if (!uuid.test(id)) fail("Job ID must be a UUID.");
  return join(dir, `${id}.json`);
}
async function load(id, dir = stateDir) {
  let record;
  try { record = JSON.parse(await readFile(recordPath(id, dir), "utf8")); }
  catch (error) { if (error.code === "ENOENT") fail("Job not found in this workspace."); throw error; }
  if (record.job_id !== id || record.workspace !== workspaceId()) fail("This job does not belong to this workspace.");
  return record;
}
function workspaceId() { return createHash("sha256").update(root).digest("hex"); }
async function save(record, dir = stateDir) {
  const path = recordPath(record.job_id, dir);
  const temp = `${path}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(record, null, 2) + "\n", { mode: 0o600, flag: "wx" });
  await rename(temp, path);
}
async function api(path, { method = "GET", body, fetchImpl = fetch, env = process.env, generation = false } = {}) {
  const authorization = credentials(env);
  let response;
  try {
    response = await fetchImpl(`${base}${path}`, {
      method,
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30_000),
      redirect: "error",
    });
  } catch {
    fail(generation ? "Submission outcome is uncertain. Check the Higgsfield dashboard before starting a new job; this job ID cannot be resubmitted." : "Higgsfield request could not be reached.");
  }
  let data;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok) {
    const status = response.status;
    const retryable = status >= 500 || status === 423 || status === 429;
    const message = status === 401 ? "Check Higgsfield credentials." : status === 403 ? "Check account credits and model access." : status === 404 ? "Model or request unavailable to this account." : status === 422 ? "Higgsfield rejected the request fields." : status === 400 ? "Request rejected; check model concurrency and inputs." : `Higgsfield returned HTTP ${status}.`;
    const error = new Error(message);
    error.retryable = retryable;
    error.status = status;
    throw error;
  }
  if (!data || typeof data !== "object") fail("Higgsfield returned an invalid JSON response.");
  return { data, correlationId: response.headers.get("x-correlation-id") || null };
}
function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (!rest[i]?.startsWith("--") || rest[i + 1] === undefined) fail("Use --name value arguments.");
    const name = rest[i].slice(2);
    if (flags[name] !== undefined) fail(`Duplicate --${name}.`);
    flags[name] = rest[i + 1];
  }
  return { command, flags };
}
function input(flags) {
  const prompt = flags.prompt?.trim();
  if (!prompt || prompt.length > 2000) fail("Provide a prompt between 1 and 2000 characters.");
  const duration = Number(flags.duration ?? 5);
  if (!Number.isInteger(duration) || duration < 4 || duration > 15) fail("Duration must be an integer from 4 to 15 seconds.");
  const resolution = flags.resolution ?? "720p";
  if (!["480p", "720p", "1080p", "4k"].includes(resolution)) fail("Unsupported resolution.");
  const aspect_ratio = flags.aspect ?? "9:16";
  if (!["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"].includes(aspect_ratio)) fail("Unsupported aspect ratio.");
  const generate_audio = flags.audio === undefined ? true : flags.audio === "true" ? true : flags.audio === "false" ? false : fail("Audio must be true or false.");
  return { prompt, duration, resolution, aspect_ratio, generate_audio };
}
export async function submit(flags, options = {}) {
  const payload = input(flags);
  credentials(options.env ?? process.env);
  const id = flags.job ?? randomUUID();
  const dir = options.dir ?? stateDir;
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const path = recordPath(id, dir);
  const record = { job_id: id, workspace: workspaceId(), model, input: payload, status: "submitting", created_at: new Date().toISOString(), request_id: null, status_url: null };
  let handle;
  try { handle = await open(path, "wx", 0o600); }
  catch (error) { if (error.code === "EEXIST") fail(`Job ${id} already exists. Use status or wait; submit will not charge twice.`); throw error; }
  try { await handle.writeFile(JSON.stringify(record, null, 2) + "\n"); } finally { await handle.close(); }
  try {
    const { data, correlationId } = await api(`/${model}`, { method: "POST", body: payload, generation: true, ...options });
    if (!uuid.test(data.request_id) || typeof data.status_url !== "string") fail("Higgsfield accepted a request but returned an invalid request ID or status URL. Check the dashboard before retrying.");
    record.request_id = data.request_id;
    record.status_url = requestUrl(data.status_url, data.request_id);
    record.status = data.status;
    record.correlation_id = correlationId;
  } catch (error) {
    record.status = error.status && error.status < 500 ? "rejected" : "uncertain";
    record.message = error.message;
    await save(record, dir);
    throw error;
  }
  await save(record, dir);
  return publicRecord(record);
}
function publicRecord(record) {
  const { workspace, input, status_url, ...visible } = record;
  return { ...visible, input: { ...input, prompt: input.prompt } };
}
export async function status(id, options = {}) {
  const dir = options.dir ?? stateDir;
  const record = await load(id, dir);
  if (!record.request_id) return publicRecord(record);
  if (terminal.has(record.status)) return publicRecord(record);
  const { data, correlationId } = await api(new URL(requestUrl(record.status_url, record.request_id)).pathname, options);
  if (data.request_id !== record.request_id || !["queued", "in_progress", ...terminal].includes(data.status)) fail("Higgsfield returned an unexpected request state.");
  record.status = data.status;
  record.correlation_id = correlationId ?? record.correlation_id;
  record.checked_at = new Date().toISOString();
  if (data.status === "completed") {
    record.video_url = mediaUrl(data.video?.url);
  } else if (data.status === "failed") record.message = "Generation failed. Check the Higgsfield dashboard with the request ID.";
  else if (data.status === "nsfw") record.message = "Higgsfield rejected the content.";
  else if (data.status === "canceled") record.message = "Generation was canceled.";
  await save(record, dir);
  return publicRecord(record);
}
export async function wait(id, options = {}) {
  const deadline = Date.now() + Number(options.timeoutMs ?? 20 * 60_000);
  let delay = 2_000;
  while (Date.now() < deadline) {
    try {
      const record = await status(id, options);
      options.onProgress?.(record);
      if (terminal.has(record.status) || ["rejected", "uncertain"].includes(record.status)) return record;
    } catch (error) { if (!error.retryable && error.message !== "Higgsfield request could not be reached.") throw error; }
    await (options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms))))(delay + Math.floor(Math.random() * 500));
    delay = Math.min(Math.ceil(delay * 1.5), 10_000);
  }
  fail("Polling timed out. The job is still saved; run status or wait again later.");
}
export async function estimate(flags, options = {}) {
  const { data } = await api(`/estimate/${model}`, { method: "POST", body: input(flags), ...options });
  return data;
}
export async function download(id, options = {}) {
  const record = await load(id, options.dir ?? stateDir);
  if (record.status !== "completed" || !record.video_url) fail("Video is not complete. Run status or wait first.");
  const url = mediaUrl(record.video_url);
  const destination = resolve(options.output ?? join(root, ".higgsfield", "output", `${id}.mp4`));
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  const response = await (options.fetchImpl ?? fetch)(url, { signal: AbortSignal.timeout(120_000), redirect: "error" });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("video/")) fail("Could not download a video from the output URL.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 250_000_000) fail("Video is empty or exceeds 250 MB.");
  await writeFile(destination, bytes, { mode: 0o600, flag: "wx" });
  return { file: destination, bytes: bytes.length };
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  let result;
  if (command === "estimate") result = await estimate(flags);
  else if (command === "submit") result = await submit(flags);
  else if (command === "status") result = await status(flags.job);
  else if (command === "wait") result = await wait(flags.job, { onProgress: item => console.error(`${item.status} ${item.job_id}`) });
  else if (command === "download") result = await download(flags.job, { output: flags.output });
  else fail("Use: npm run higgsfield -- <estimate|submit|status|wait|download> [--job UUID] [--prompt TEXT] [--duration 5] [--resolution 720p] [--aspect 9:16] [--audio true] [--output FILE]");
  console.log(JSON.stringify(result, null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.loadEnvFile(join(root, ".env.higgsfield.local")); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
