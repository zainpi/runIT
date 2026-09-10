import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  timeout: 90000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.NEUTRONIUM_TEST_BASE_URL || "http://127.0.0.1:3010",
    headless: true,
    viewport: { width: 1440, height: 1100 },
  },
  reporter: "list",
  outputDir: "../../.neutronium-dev/test-results",
});
