#!/usr/bin/env node
// Usage: npm run clips:check  -- [--campaign notes-app-ideas] [--only id,...] [--fallback hook,payoff]
//        npm run clips:generate -- [--campaign notes-app-ideas] [--only id,...] [--fallback id,...] [--regenerate id,...]
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { check, generate } from "../lib/higgsfield-jobs.mjs";

const adsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(adsRoot, "..");
const [command, ...rest] = process.argv.slice(2);
const flags = {};
for (let i = 0; i < rest.length; i += 2) {
  if (!rest[i]?.startsWith("--") || rest[i + 1] === undefined) { console.error("Use --name value arguments."); process.exit(1); }
  flags[rest[i].slice(2)] = rest[i + 1];
}
const campaign = flags.campaign ?? "notes-app-ideas";
if (!/^[a-z0-9-]+$/.test(campaign)) { console.error("Invalid campaign name."); process.exit(1); }
const list = (value) => (value ? value.split(",").map((item) => item.trim()).filter(Boolean) : []);
const campaignDir = join(adsRoot, "campaigns", campaign);
const outputDir = join(adsRoot, "public", "campaigns", campaign);

for (const file of [join(repoRoot, ".env.higgsfield.local"), join(adsRoot, ".env.local")]) {
  try { process.loadEnvFile(file); } catch (error) { if (error.code !== "ENOENT") throw error; }
}

try {
  if (command === "check") {
    const result = await check(campaignDir, { fallback: list(flags.fallback), only: list(flags.only) });
    process.exitCode = result.ok ? 0 : 1;
  } else if (command === "generate") {
    await generate(campaignDir, outputDir, { fallback: list(flags.fallback), regenerate: list(flags.regenerate), only: list(flags.only) });
    console.log(`Commit ads/campaigns/${campaign}/manifest.json and ads/public/campaigns/${campaign}/ so paid takes are kept.`);
  } else {
    console.error("Use: clips.mjs <check|generate> [--campaign name] [--only id,...] [--fallback id,...] [--regenerate id,...]");
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
