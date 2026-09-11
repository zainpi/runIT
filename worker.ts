import { getPulseDealsEnv } from "./src/lib/pulsedeals/compatibility";
// OpenNext serves the HTTP surface. This thin wrapper adds the Cloudflare
// scheduled handler without depending on a deployment-specific service name.
// @ts-ignore OpenNext generates this module during the Cloudflare build.
import openNextWorker from "./.open-next/worker.js";
import { handleLocalLore, cleanupLocalLore } from "./src/lib/local-lore/live/api.mjs";

type WorkerEnvironment = {
  PULSEDEALS_CRON_SECRET?: string;
  HEATERDEALS_CRON_SECRET?: string;
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
  async fetch(
    request: Request,
    env: WorkerEnvironment,
    ctx: PulseDealsExecutionContext,
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
    _controller: PulseDealsScheduledController,
    env: WorkerEnvironment,
    ctx: PulseDealsExecutionContext,
  ) {
    if (_controller.cron !== "*/5 * * * *") return;
    ctx.waitUntil(cleanupLocalLore(env));
    const secret = getPulseDealsEnv("PULSEDEALS_CRON_SECRET", env);
    if (!secret) return;
    const marketplace = marketplaces[Math.floor(Date.now() / (5 * 60_000)) % marketplaces.length];
    const request = new Request(
      `https://runsit.ca/pulsedeals/api/v1/internal/sync/?marketplace=${marketplace}`,
      { method: "POST", headers: { "x-pulsedeals-cron-secret": secret } },
    );
    const responsePromise = openNextWorker.fetch(request, env, ctx).then((response: Response) => {
      if (!response.ok) {
        throw new Error(`PulseDeals scheduled sync failed with HTTP ${response.status}`);
      }
    });
    ctx.waitUntil(responsePromise);
  },
};
