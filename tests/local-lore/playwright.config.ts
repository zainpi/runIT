import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: ["layout.spec.ts", "location.spec.ts"],
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: process.env.LOCAL_LORE_BASE_URL || "http://localhost:4173",
    headless: true,
  },
  reporter: "list",
  outputDir: "/tmp/local-lore-layout-results",
});
