import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { composePrompt, emptyPersonalization, modeInstructions } from "../../src/lib/templates/compose";
import { templateCatalog, type TemplateId } from "../../src/lib/templates/catalog";

const promptNames: Record<TemplateId, string> = {
  "discord-bot": "discordBotPrompt",
  "roblox-game": "robloxGamePrompt",
  "mobile-game": "mobileGamePrompt",
  "mobile-app": "mobileAppPrompt",
  storefront: "storefrontPrompt",
  "browser-game": "browserGamePrompt",
};

const meaningfulCoverage: Record<TemplateId, RegExp[]> = {
  "discord-bot": [/Discord/i, /SQLite/i, /Keepa/i, /OpenAI/i, /Apify/i, /HMAC/i, /systemd/i],
  "roblox-game": [/Roblox Studio/i, /DataStore/i, /MarketplaceService/i, /PolicyService/i, /Rojo/i, /Lune/i],
  "mobile-game": [/Godot/i, /GDScript/i, /Supabase/i, /StoreKit/i, /Google Play Billing/i, /LevelPlay/i],
  "mobile-app": [/SwiftUI/i, /Supabase/i, /StoreKit/i, /notification/i, /OpenAI/i, /App Store/i],
  storefront: [/Stripe/i, /Cloudflare/i, /webhook/i, /durable (order )?(storage|database)/i, /fulfillment/i, /domain/i],
  "browser-game": [/Cloudflare/i, /D1/i, /Street View/i, /Maps Static/i, /OpenStreetMap/i, /(rate|usage)[\s\S]{0,30}(limit|quota)/i],
};

const officialDomains: Record<TemplateId, string[]> = {
  "discord-bot": ["discord.com/developers", "keepa.com/#!api", "platform.openai.com", "console.apify.com"],
  "roblox-game": ["create.roblox.com/docs", "rojo.space/docs"],
  "mobile-game": ["docs.godotengine.org", "developer.apple.com", "developer.android.com"],
  "mobile-app": ["developer.apple.com", "supabase.com/docs", "developers.openai.com"],
  storefront: ["docs.stripe.com", "developers.cloudflare.com"],
  "browser-game": ["developers.cloudflare.com", "developers.google.com/maps", "openstreetmap.org"],
};

const privateMarkers = [
  /KeepaBot/i,
  /Build Your Room/i,
  /PulseDeals/i,
  /Neutronium/i,
  /runsit\.ca/i,
  /cybrancee/i,
  /95318676575728/,
  /10766043287/,
  /3712467828/,
  /1980080478/,
];

async function sourceFor(id: TemplateId): Promise<string> {
  return readFile(path.join(process.cwd(), "src/lib/templates/prompts", `${id}.ts`), "utf8");
}

function promptBody(source: string): string {
  const start = source.indexOf("`");
  const end = source.lastIndexOf("`");
  assert.ok(start >= 0 && end > start, "prompt source must contain a template literal");
  return source.slice(start + 1, end);
}

test("composePrompt includes editable answers and the selected foundation", () => {
  const details = {
    name: "Orbit Garden",
    idea: "A calm planning tool for volunteer groups",
    features: "Shared schedules and offline notes",
    style: "Warm, spacious, and accessible",
    budget: "CAD 40 monthly for 200 members",
  };
  const output = composePrompt("community app", "FOUNDATION SENTINEL", details, "computer");
  for (const value of Object.values(details)) assert.match(output, new RegExp(value));
  assert.match(output, /FOUNDATION SENTINEL/);
  assert.match(output, /AI CONTROLS MY COMPUTER/);
  assert.doesNotMatch(output, /WORKING MODE: I DO IT MYSELF/);
});

test("composePrompt preserves useful placeholders for an empty editable brief", () => {
  const output = composePrompt("sample", "foundation", emptyPersonalization, "manual");
  for (const placeholder of ["Your app name", "Describe your idea and audience", "Describe the features you want", "Describe the look and feel", "Your budget"]) {
    assert.ok(output.includes(`[${placeholder}`), `missing placeholder for ${placeholder}`);
  }
  assert.match(output, /I DO IT MYSELF/);
  assert.match(output, /one small numbered step at a time/i);
});

test("both public build modes contain distinct safety and handoff guidance", () => {
  assert.match(modeInstructions.computer, /available.*tools/i);
  assert.match(modeInstructions.computer, /explicit (approval|authorization)/i);
  assert.match(modeInstructions.manual, /Do not operate my computer/i);
  assert.match(modeInstructions.manual, /Wait for me to confirm/i);
});

test("optional subagent instructions are inserted only when purchased", () => {
  const addon = "SUBAGENT ADDON SENTINEL: supervisor reviews every worker result";
  for (const mode of ["computer", "manual"] as const) {
    const withoutAddon = composePrompt("sample", "foundation", emptyPersonalization, mode);
    const withAddon = composePrompt("sample", "foundation", emptyPersonalization, mode, addon);
    assert.doesNotMatch(withoutAddon, /SUBAGENT ADDON SENTINEL/);
    assert.match(withAddon, /SUBAGENT ADDON SENTINEL/);
    assert.match(withAddon, new RegExp(modeInstructions[mode].split("\n")[0]));
    assert.ok(withAddon.indexOf(modeInstructions[mode].split("\n")[0]) < withAddon.indexOf(addon), "add-on must follow working mode");
    assert.ok(withAddon.indexOf(addon) < withAddon.indexOf("HOW TO GUIDE ME"), "add-on must precede common guidance");
  }
});

test("paid subagent source is server-only and preserves capability, manual-mode, and budget boundaries", async () => {
  const source = await readFile(path.join(process.cwd(), "src/lib/templates/prompts/subagents.ts"), "utf8");
  const body = promptBody(source);
  const words = body.trim().split(/\s+/).length;
  assert.match(source, /^import "server-only";/m);
  assert.match(source, /export const subagentInstructions\s*=/);
  assert.ok(words >= 500 && words <= 900, `subagent add-on has ${words} words`);
  assert.match(body, /primary supervisor/i);
  assert.match(body, /architecture[\s\S]{0,80}security/i);
  assert.match(body, /native (delegation|orchestration).*only when/i);
  assert.match(body, /never claim this prompt enables subagents/i);
  assert.match(body, /at most two workers/i);
  assert.match(body, /must not recursively spawn/i);
  assert.match(body, /manual mode[\s\S]{0,220}(may change|side-effect-free)/i);
  assert.match(body, /does not guarantee savings/i);
  assert.match(body, /explicit user approval/i);
  assert.match(body, /developers\.openai\.com\/api\/docs\/guides\/latest-model/);
  assert.match(body, /developers\.openai\.com\/api\/docs\/models/);
});

for (const item of templateCatalog) {
  test(`${item.id} prompt is substantial, server-only, sanitized, and operational`, async () => {
    const source = await sourceFor(item.id);
    const body = promptBody(source);
    const words = body.trim().split(/\s+/).length;

    assert.match(source, /^import "server-only";/m);
    assert.match(source, new RegExp(`export const ${promptNames[item.id]}\\s*=`));
    assert.ok(words >= 1_400, `${item.id} has only ${words} words`);
    assert.match(body, /https:\/\//, "must link at least one official setup or reference page");
    assert.match(body, /test/i);
    assert.match(body, /(deploy|publish|release)/i);
    assert.match(body, /(backup|restore|rollback)/i);
    for (const pattern of meaningfulCoverage[item.id]) assert.match(body, pattern);
    for (const domain of officialDomains[item.id]) assert.ok(body.includes(domain), `${item.id} is missing ${domain}`);
    for (const marker of privateMarkers) assert.doesNotMatch(body, marker);
  });
}

test("the mobile game foundation consistently uses Godot rather than Unity engine architecture", async () => {
  const body = promptBody(await sourceFor("mobile-game"));
  assert.match(body, /Godot 4/i);
  assert.match(body, /GDScript/i);
  assert.doesNotMatch(body, /UnityEngine|MonoBehaviour|ScriptableObjects?/i);
});

test("every catalog entry has a matching prompt module and useful marketing detail", async () => {
  assert.equal(templateCatalog.length, Object.keys(promptNames).length);
  for (const item of templateCatalog) {
    await sourceFor(item.id);
    assert.ok(item.description.length >= 50);
    assert.ok(item.includes.length >= 4);
    assert.ok(item.stack.split("·").length >= 3);
  }
});
