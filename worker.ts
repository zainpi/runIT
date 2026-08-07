// OpenNext serves the HTTP surface. This thin wrapper adds the Cloudflare
// scheduled handler without changing the existing Worker service binding.
// @ts-ignore OpenNext generates this module during the Cloudflare build.
import openNextWorker from "./.open-next/worker.js";

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
  fetch: openNextWorker.fetch,
  async scheduled(
    _controller: HeaterDealsScheduledController,
    env: WorkerEnvironment,
    ctx: HeaterDealsExecutionContext,
  ) {
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
