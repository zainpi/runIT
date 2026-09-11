import { getPulseDealsEnv } from "./src/lib/pulsedeals/compatibility";
// OpenNext serves the HTTP surface. This thin wrapper adds the Cloudflare
// scheduled handler without changing the existing Worker service binding.
// @ts-ignore OpenNext generates this module during the Cloudflare build.
import openNextWorker from "./.open-next/worker.js";

type WorkerEnvironment = {
  PULSEDEALS_CRON_SECRET?: string;
  HEATERDEALS_CRON_SECRET?: string;
  WORKER_SELF_REFERENCE?: { fetch(input: RequestInfo, init?: RequestInit): Promise<Response> };
};

type PulseDealsScheduledController = {
  cron: string;
  scheduledTime: number;
  noRetry(): void;
};

type PulseDealsExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
};

const marketplaces = ["de", "uk", "es", "fr", "it"] as const;

export default {
  fetch(
    request: Request,
    env: WorkerEnvironment,
    ctx: PulseDealsExecutionContext,
  ) {
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
    _controller: PulseDealsScheduledController,
    env: WorkerEnvironment,
    ctx: PulseDealsExecutionContext,
  ) {
    if (_controller.cron !== "*/5 * * * *") return;
    const secret = getPulseDealsEnv("PULSEDEALS_CRON_SECRET", env);
    if (!secret) return;
    const marketplace = marketplaces[Math.floor(Date.now() / (5 * 60_000)) % marketplaces.length];
    const request = new Request(
      `https://runsit.ca/pulsedeals/api/v1/internal/sync?marketplace=${marketplace}`,
      { method: "POST", headers: { "x-pulsedeals-cron-secret": secret } },
    );
    const responsePromise = env.WORKER_SELF_REFERENCE
      ? env.WORKER_SELF_REFERENCE.fetch(request)
      : fetch(request);
    ctx.waitUntil(responsePromise);
  },
};
