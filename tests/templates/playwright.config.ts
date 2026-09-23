import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["store.spec.ts", "ai-editor.spec.ts", "trial.spec.ts", "icon.spec.ts"],
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  outputDir: "/tmp/runit-templates-test-results",
  use: {
    baseURL: "http://127.0.0.1:3102",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3102",
    env: { NEUTRONIUM_DIST_DIR: ".next-templates-test" },
    url: "http://127.0.0.1:3102/templates/",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
