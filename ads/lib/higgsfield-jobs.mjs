// Budget-guarded Higgsfield job runner for ad campaigns.
//
// A campaign's shots.json lists image and video jobs. `check` calls only the
// free /estimate endpoint, confirming each request schema and pricing before any
// spend. `generate` submits each job at most once, recording every step in the
// campaign's committed manifest.json so a rerun, another machine, or a new
// session resumes instead of paying again.
import { createHash } from "node:crypto";
import { access, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const BASE = "https://api.higgsfield.ai";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const terminal = new Set(["completed", "failed", "nsfw", "canceled"]);
const released = new Set(["rejected", "failed", "nsfw", "canceled"]);
// Stand-in public image used only to validate image-to-video estimates before the keyframe exists.
export const ESTIMATE_IMAGE_URL = "https://runsit.ca/products/build-your-room-artwork.jpg";

export class JobError extends Error {
  constructor(message, { status, retryable = false } = {}) { super(message); this.status = status; this.retryable = retryable; }
}

// With neither variable set, requests go without Authorization so a cloud
// environment's API credential (added by its proxy) can authenticate them.
export function authHeaders(env = process.env) {
  const id = env.HF_API_KEY_ID, secret = env.HF_API_KEY_SECRET;
  if (!id && !secret) return {};
  if (!id || !secret || /[:\r\n]/.test(id) || /[\r\n]/.test(secret)) throw new JobError("Set both HF_API_KEY_ID and HF_API_KEY_SECRET (repo-root .env.higgsfield.local or the environment).");
  return { Authorization: `Key ${id}:${secret}` };
}

function modelPath(model) {
  if (typeof model !== "string" || !/^[a-z0-9][a-z0-9._-]*(\/[a-z0-9._-]+)+$/i.test(model)) throw new JobError(`Invalid model path: ${model}`);
  return model;
}

export async function hf(path, { method = "GET", body, env = process.env, fetchImpl = fetch, submission = false } = {}) {
  let response;
  try {
    response = await fetchImpl(`${BASE}${path}`, {
      method,
      headers: { ...authHeaders(env), "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30_000),
      redirect: "error",
    });
  } catch (error) {
    if (error instanceof JobError) throw error;
    throw new JobError(submission ? "Submission outcome is uncertain" : "Higgsfield could not be reached", { retryable: !submission });
  }
  let data = null;
  try { data = await response.json(); } catch { /* handled below */ }
  if (!response.ok) {
    const status = response.status;
    const detail = typeof data?.detail === "string" ? `: ${data.detail.slice(0, 300)}` : Array.isArray(data?.detail) ? `: ${JSON.stringify(data.detail).slice(0, 300)}` : "";
    const hint = { 401: "check credentials: HF_API_KEY_ID/HF_API_KEY_SECRET, or an environment API credential for api.higgsfield.ai with header Authorization and prefix Key", 403: "check credits and model access", 404: "model or request not found", 422: "request fields rejected", 400: "request rejected" }[status] ?? "error";
    throw new JobError(`Higgsfield HTTP ${status} (${hint})${detail}`, { status, retryable: status >= 500 || status === 429 || status === 423 });
  }
  if (!data || typeof data !== "object") throw new JobError("Higgsfield returned invalid JSON");
  return data;
}

// Token-metered video pricing: the estimate endpoint returns a formula description.
export function ratePer1kTokens(description) {
  const match = /1,?000 video tokens cost \$([0-9]+(?:\.[0-9]+)?)/i.exec(description ?? "");
  return match ? Number(match[1]) : null;
}

export function videoDimensions(resolution, aspect) {
  const short = { "480p": 480, "720p": 720, "1080p": 1080 }[resolution];
  const [a, b] = String(aspect).split(":").map(Number);
  if (!short || !a || !b) throw new JobError(`Unsupported resolution/aspect: ${resolution} ${aspect}`);
  const long = Math.ceil((short * Math.max(a, b)) / Math.min(a, b) / 16) * 16;
  return a >= b ? [long, short] : [short, long];
}

export function videoTokens({ duration, resolution, aspect_ratio }) {
  const [width, height] = videoDimensions(resolution, aspect_ratio);
  return Math.ceil((duration * width * height * 24) / 1024);
}

export function priceFromEstimate(estimate, job) {
  if (estimate?.usd !== undefined && Number.isFinite(Number(estimate.usd))) return { usd: Number(estimate.usd), source: "estimate" };
  const rate = ratePer1kTokens(estimate?.pricing_description);
  if (rate !== null && job.kind === "video") return { usd: Math.round((videoTokens(job.input) / 1000) * rate * 10_000) / 10_000, source: "token formula" };
  if (Number.isFinite(job.maxUsd)) return { usd: job.maxUsd, source: "maxUsd cap" };
  throw new JobError(`${job.id}: the estimate did not include a price. Add "maxUsd" to this job to reserve budget for it.`);
}

export function inputHash(model, payload) {
  return createHash("sha256").update(JSON.stringify([model, payload])).digest("hex").slice(0, 16);
}

export async function loadCampaign(campaignDir) {
  const shots = JSON.parse(await readFile(join(campaignDir, "shots.json"), "utf8"));
  if (!Array.isArray(shots.jobs) || !Number.isFinite(shots.budgetUsd) || shots.budgetUsd <= 0) throw new JobError("shots.json needs budgetUsd and jobs.");
  const ids = new Set();
  for (const job of shots.jobs) {
    if (!/^[a-z0-9-]+$/.test(job.id ?? "") || ids.has(job.id)) throw new JobError(`Invalid or duplicate job id: ${job.id}`);
    if (!["image", "video"].includes(job.kind)) throw new JobError(`${job.id}: kind must be image or video.`);
    if (!/^(clips|keyframes)\/[a-z0-9-]+\.(mp4|png|jpg|webp)$/.test(job.output ?? "")) throw new JobError(`${job.id}: output must be clips/<name>.mp4 or keyframes/<name>.png.`);
    if (job.fromImage && !ids.has(job.fromImage)) throw new JobError(`${job.id}: fromImage must reference an earlier image job.`);
    modelPath(job.model);
    ids.add(job.id);
  }
  let manifest = { campaign: shots.campaign, jobs: {} };
  try { manifest = JSON.parse(await readFile(join(campaignDir, "manifest.json"), "utf8")); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  return { shots, manifest };
}

async function saveManifest(campaignDir, manifest) {
  const path = join(campaignDir, "manifest.json");
  const temp = `${path}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(manifest, null, 2) + "\n");
  await rename(temp, path);
}

// Resolve the model and payload actually sent for a job (fallback and chained image included).
export function resolveRequest(job, { useFallback = false, imageUrl } = {}) {
  const model = useFallback && job.fallback ? job.fallback.model : job.model;
  const payload = { ...job.input, ...(useFallback && job.fallback ? { prompt: job.fallback.prompt } : {}) };
  if (job.fromImage && !(useFallback && job.fallback)) {
    if (!imageUrl) throw new JobError(`${job.id}: needs the ${job.fromImage} image first.`);
    payload[job.imageField ?? "image_url"] = imageUrl;
  }
  return { model: modelPath(model), payload };
}

// Restrict a run to the listed job ids (all jobs when the list is empty).
export function selectJobs(jobs, only = []) {
  const unknown = only.filter((id) => !jobs.some((job) => job.id === id));
  if (unknown.length) throw new JobError(`Unknown job id: ${unknown.join(", ")}`);
  return only.length ? jobs.filter((job) => only.includes(job.id)) : jobs;
}

function spent(manifest) {
  return Object.values(manifest.jobs).filter((entry) => entry.request_id && !released.has(entry.status)).reduce((sum, entry) => sum + (entry.estimated_usd ?? 0), 0);
}

function mediaUrl(data, kind) {
  const url = kind === "image" ? data.images?.[0]?.url ?? data.image?.url : data.video?.url;
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) throw new JobError("Higgsfield returned an invalid media URL.");
  return parsed.href;
}

/** Free: validate every request against /estimate and report the planned spend. */
export async function check(campaignDir, { env, fetchImpl, fallback = [], only = [], log = console.log } = {}) {
  const { shots, manifest } = await loadCampaign(campaignDir);
  const rows = [];
  for (const job of selectJobs(shots.jobs, only)) {
    const done = manifest.jobs[job.id];
    const useFallback = fallback.includes(job.id);
    const imageUrl = job.fromImage ? manifest.jobs[job.fromImage]?.media_url ?? ESTIMATE_IMAGE_URL : undefined;
    const { model, payload } = resolveRequest(job, { useFallback, imageUrl });
    const hash = inputHash(model, payload);
    if (done?.request_id && !released.has(done.status)) {
      const changed = !job.fromImage && done.input_hash !== hash ? "; shots.json changed since — use --regenerate to pay for a new take" : "";
      rows.push({ id: job.id, model: done.model, status: `already ${done.status}${changed}`, usd: 0 });
      continue;
    }
    try {
      const estimate = await hf(`/estimate/${model}`, { method: "POST", body: payload, env, fetchImpl });
      const price = priceFromEstimate(estimate, job);
      rows.push({ id: job.id, model, status: "ok", usd: price.usd, source: price.source });
    } catch (error) {
      rows.push({ id: job.id, model, status: `FAILED: ${error.message}`, usd: null, fallback: Boolean(job.fallback) });
    }
  }
  const planned = rows.reduce((sum, row) => sum + (row.usd ?? 0), 0);
  const already = spent(manifest);
  const ok = rows.every((row) => row.usd !== null) && already + planned <= shots.budgetUsd + 1e-9;
  for (const row of rows) log(`${row.id.padEnd(10)} ${row.model.padEnd(42)} ${row.usd === null ? "" : `$${row.usd.toFixed(2)}`.padEnd(8)} ${row.status}${row.source ? ` (${row.source})` : ""}${row.fallback ? " — rerun with --fallback " + row.id : ""}`);
  log(`spent so far $${already.toFixed(2)} + planned $${planned.toFixed(2)} of $${shots.budgetUsd.toFixed(2)} budget → ${ok ? "OK" : "BLOCKED"}`);
  return { ok, rows, planned, already, budget: shots.budgetUsd };
}

async function download(url, destination, kind, fetchImpl) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(180_000), redirect: "error" });
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !type.startsWith(kind === "image" ? "image/" : "video/")) throw new JobError(`Could not download ${kind} (${response.status} ${type}).`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 250_000_000) throw new JobError("Downloaded file is empty or too large.");
  await mkdir(dirname(destination), { recursive: true });
  const partial = `${destination}.part`;
  await writeFile(partial, bytes, { flag: "w" });
  await rename(partial, destination);
  return bytes.length;
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

/**
 * Submit each job at most once, wait, and download. Stops at the first
 * uncertain submission, failure, or budget overrun; rerun to resume.
 */
export async function generate(campaignDir, outputDir, { env, fetchImpl = fetch, fallback = [], regenerate = [], only = [], sleep = (ms) => new Promise((r) => setTimeout(r, ms)), timeoutMs = 20 * 60_000, log = console.log } = {}) {
  const { shots, manifest } = await loadCampaign(campaignDir);
  const selected = selectJobs(shots.jobs, only);
  const preflight = await check(campaignDir, { env, fetchImpl, fallback, only, log: () => {} });
  if (!preflight.ok) throw new JobError(`Preflight failed or over budget ($${(preflight.already + preflight.planned).toFixed(2)} of $${shots.budgetUsd}). Run the check command for details.`);
  for (const job of selected) {
    const destination = join(outputDir, job.output);
    let entry = manifest.jobs[job.id];
    if (entry && regenerate.includes(job.id) && terminal.has(entry.status)) {
      manifest.jobs[`${job.id}@${entry.request_id ?? "rejected"}`] = entry;
      delete manifest.jobs[job.id];
      entry = undefined;
    }
    if (entry?.status === "submitting" || entry?.status === "uncertain") throw new JobError(`${job.id}: a previous submission outcome is uncertain. Check the Higgsfield dashboard, then set its manifest status to "rejected" (not charged) or add its request_id.`);
    if (entry && released.has(entry.status) && entry.status !== "rejected") throw new JobError(`${job.id}: generation ${entry.status}. Adjust the prompt and rerun with --regenerate ${job.id}.`);
    if (!entry || entry.status === "rejected") {
      const useFallback = fallback.includes(job.id);
      const imageUrl = job.fromImage ? manifest.jobs[job.fromImage]?.media_url : undefined;
      const { model, payload } = resolveRequest(job, { useFallback, imageUrl });
      const estimate = await hf(`/estimate/${model}`, { method: "POST", body: payload, env, fetchImpl });
      const price = priceFromEstimate(estimate, job);
      if (spent(manifest) + price.usd > shots.budgetUsd + 1e-9) throw new JobError(`${job.id}: $${price.usd.toFixed(2)} would exceed the $${shots.budgetUsd} budget.`);
      entry = manifest.jobs[job.id] = { status: "submitting", model, input_hash: inputHash(model, payload), estimated_usd: price.usd, price_source: price.source, fallback: useFallback, submitted_at: new Date().toISOString() };
      await saveManifest(campaignDir, manifest);
      try {
        const data = await hf(`/${model}`, { method: "POST", body: payload, env, fetchImpl, submission: true });
        if (!uuid.test(data.request_id ?? "")) throw new JobError("Accepted without a valid request_id");
        Object.assign(entry, { status: data.status ?? "queued", request_id: data.request_id });
      } catch (error) {
        entry.status = error.status && error.status < 500 ? "rejected" : "uncertain";
        entry.message = error.message;
        await saveManifest(campaignDir, manifest);
        throw new JobError(`${job.id}: ${error.message}`);
      }
      await saveManifest(campaignDir, manifest);
      log(`${job.id}: submitted ${entry.request_id} (~$${price.usd.toFixed(2)})`);
    }
    const deadline = Date.now() + timeoutMs;
    let delay = 3_000;
    while (!terminal.has(entry.status)) {
      if (Date.now() > deadline) throw new JobError(`${job.id}: still ${entry.status}; rerun later to resume.`);
      await sleep(delay);
      delay = Math.min(Math.ceil(delay * 1.5), 15_000);
      let data;
      try { data = await hf(`/requests/${entry.request_id}/status`, { env, fetchImpl }); }
      catch (error) { if (error.retryable) continue; throw error; }
      if (data.request_id !== entry.request_id) throw new JobError("Status response did not match the request.");
      if (data.status !== entry.status) log(`${job.id}: ${data.status}`);
      entry.status = data.status;
      entry.checked_at = new Date().toISOString();
      if (data.status === "completed") entry.media_url = mediaUrl(data, job.kind);
      await saveManifest(campaignDir, manifest);
    }
    if (entry.status !== "completed") throw new JobError(`${job.id}: generation ${entry.status}. Adjust the prompt and rerun with --regenerate ${job.id}.`);
    if (!(await exists(destination))) {
      const bytes = await download(entry.media_url, destination, job.kind, fetchImpl);
      entry.file = job.output;
      entry.bytes = bytes;
      await saveManifest(campaignDir, manifest);
      log(`${job.id}: saved ${job.output} (${(bytes / 1e6).toFixed(1)} MB)`);
    }
  }
  log(`done — estimated spend $${spent(manifest).toFixed(2)} of $${shots.budgetUsd.toFixed(2)}`);
  return manifest;
}
