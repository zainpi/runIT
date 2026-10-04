import { defineConfig, devices } from "@playwright/test";

const production = process.env.SEARCH_TEST_PRODUCTION === "true";

export default defineConfig({
  testDir: ".",
  testMatch: "public-search.spec.ts",
  timeout: 30_000,
  workers: 1,
  reporter: "line",
  outputDir: "/tmp/runit-search-test-results",
  use: { baseURL: "http://127.0.0.1:3114", ...devices["Desktop Chrome"] },
  webServer: {
    command: `npm run ${production ? "start" : "dev"} -- --hostname 127.0.0.1 --port 3114`,
    env: { NEUTRONIUM_DIST_DIR: production ? ".next-aeo-build" : ".next-aeo-test" },
    url: "http://127.0.0.1:3114/templates/mobile-app/",
    reuseExistingServer: !production,
    timeout: 120_000,
  },
});
