// OpenNext serves the HTTP surface. This thin wrapper adds the Cloudflare
// scheduled handler without changing the existing Worker service binding.
// @ts-ignore OpenNext generates this module during the Cloudflare build.
import openNextWorker from "./.open-next/worker.js";
import { handleLocalLore, cleanupLocalLore } from "./src/lib/local-lore/live/api.mjs";

type WorkerEnvironment = {
  HEATERDEALS_CRON_SECRET?: string;
  WORKER_SELF_REFERENCE?: { fetch(input: RequestInfo, init?: RequestInit): Promise<Response> };
};

type HeaterDealsScheduledController = {
  cron: string;
  scheduledTime: number;
  noRetry(): void;
};

type HeaterDealsExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
};

const marketplaces = ["us", "ca", "de", "uk"] as const;

export default {
  async fetch(
    request: Request,
    env: WorkerEnvironment,
    ctx: HeaterDealsExecutionContext,
  ) {
    const localLore = await handleLocalLore(request, env);
    if (localLore) return localLore;
    const url = new URL(request.url);
    if (
      (url.hostname === "runsit.ca" || url.hostname === "www.runsit.ca") &&
      (url.pathname === "/neutronium" || url.pathname.startsWith("/neutronium/"))
    ) {
      url.hostname = "neutronium.runsit.ca";
      return Response.redirect(url.toString(), 307);
    }
    return openNextWorker.fetch(request, env, ctx);
  },
  async scheduled(
    _controller: HeaterDealsScheduledController,
    env: WorkerEnvironment,
    ctx: HeaterDealsExecutionContext,
  ) {
    if (_controller.cron !== "*/5 * * * *") return;
    ctx.waitUntil(cleanupLocalLore(env));
    const secret = env.HEATERDEALS_CRON_SECRET;
    if (!secret) return;
    const marketplace = marketplaces[Math.floor(Date.now() / (5 * 60_000)) % marketplaces.length];
    const request = new Request(
      `https://runsit.ca/heaterdeals/api/v1/internal/sync?marketplace=${marketplace}`,
      { method: "POST", headers: { "x-heater-cron-secret": secret } },
    );
    const responsePromise = env.WORKER_SELF_REFERENCE
      ? env.WORKER_SELF_REFERENCE.fetch(request)
      : fetch(request);
    ctx.waitUntil(responsePromise);
  },
};
