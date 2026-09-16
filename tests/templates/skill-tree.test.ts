import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { templateCatalog, type TemplateId } from "../../src/lib/templates/catalog";
import { composePrompt, composeSkillSetupPrompt, emptyPersonalization } from "../../src/lib/templates/compose";
import { skillSourceGroups } from "../../src/lib/templates/skill-sources";
import { buildSkillTreeInstructions } from "../../src/lib/templates/prompts/skill-tree";

const allIds = templateCatalog.map((item) => item.id);
const allInstructions = buildSkillTreeInstructions(allIds);

test("skill tree covers every catalog branch and varies with the selection", () => {
  for (const id of allIds) assert.match(allInstructions, new RegExp(`- ${id}:`));

  const roblox = buildSkillTreeInstructions(["roblox-game"]);
  assert.match(roblox, /pinned Rokit, Rojo, Lune, StyLua/);
  assert.match(roblox, /built-in Roblox Studio MCP/);
  assert.doesNotMatch(roblox, /- storefront:/);

  const mobileGame = buildSkillTreeInstructions(["mobile-game"]);
  assert.match(mobileGame, /uses Godot/);
  assert.match(mobileGame, /exclude levelplay-unity-integration/);

  const store = buildSkillTreeInstructions(["storefront"]);
  assert.match(store, /official Stripe plugin/);
  assert.match(store, /Cloudflare deployment/);
});

test("directory includes every named skill and honestly classifies sources", () => {
  assert.equal(new Set(skillSourceGroups.map((group) => group.title)).size, skillSourceGroups.length);
  for (const group of skillSourceGroups) {
    assert.match(group.source, /^https:\/\//);
    assert.ok(group.names.length > 0);
    for (const name of group.names) assert.ok(allInstructions.includes(name), `missing ${name}`);
  }
  assert.match(allInstructions, /Kind: public skill/);
  assert.match(allInstructions, /Kind: built-in/);
  assert.match(allInstructions, /Kind: managed plugin/);
  assert.match(allInstructions, /Kind: tool/);
  assert.match(allInstructions, /no verified public repository/i);
  assert.match(allInstructions, /not a standalone SKILL\.md/i);
});

test("setup guidance preserves mode, authorization, provenance, and rollback boundaries", () => {
  assert.match(allInstructions, /Never use an unattended yes flag, global installation/);
  assert.match(allInstructions, /commit or immutable release/);
  assert.match(allInstructions, /content hash/);
  assert.match(allInstructions, /roll back/i);
  assert.match(allInstructions, /Never expose secrets/);
  assert.match(allInstructions, /manual mode[\s\S]{0,220}do not change the computer/i);
  assert.match(allInstructions, /Never claim a skill, plugin, MCP server, connection, or tool is installed/);
  assert.match(allInstructions, /Do not initiate unsolicited agent delegation/);
  assert.match(allInstructions, /Honor an explicit user request to delegate/);
  assert.match(allInstructions, /does not authorize account creation/);
});

test("skill tree remains independent optional content in both prompt types", () => {
  const sentinel = "SKILL TREE INDEPENDENCE SENTINEL";
  for (const mode of ["computer", "manual"] as const) {
    const buildWithout = composePrompt("sample", "foundation", emptyPersonalization, mode);
    const buildWith = composePrompt("sample", "foundation", emptyPersonalization, mode, undefined, sentinel);
    assert.doesNotMatch(buildWithout, /SKILL TREE INDEPENDENCE SENTINEL/);
    assert.match(buildWith, /=== SKILL TREE SETUP ===/);
    assert.match(buildWith, /SKILL TREE INDEPENDENCE SENTINEL/);

    const setup = composeSkillSetupPrompt(sentinel, { ...emptyPersonalization, name: "Example" }, mode);
    assert.match(setup, /SET UP MY BUSINESS SKILL TREE/);
    assert.match(setup, /Name: Example/);
    assert.match(setup, new RegExp(mode === "computer" ? "AI CONTROLS MY COMPUTER" : "I DO IT MYSELF"));
    assert.match(setup, /do not start building or publishing/i);
    assert.match(setup, /SKILL TREE INDEPENDENCE SENTINEL/);
  }
});

test("paid skill-tree modules stay server-only and free of private identifiers", async () => {
  const paths = [
    "src/lib/templates/prompts/skill-tree.ts",
    "src/lib/templates/skill-sources.ts",
  ];
  const privateMarkers = [/\/Users\//, /runsit\.ca/i, /Neutronium/i, /PulseDeals/i, /AncientHorizon/i, /Build_Your_Room/i];
  for (const relative of paths) {
    const source = await readFile(path.join(process.cwd(), relative), "utf8");
    assert.match(source, /^import "server-only";/m);
    for (const marker of privateMarkers) assert.doesNotMatch(source, marker);
  }
});

test("all template IDs are accepted without duplicate branch output", () => {
  for (const id of allIds as readonly TemplateId[]) assert.doesNotThrow(() => buildSkillTreeInstructions([id, id]));
  const duplicated = buildSkillTreeInstructions(["mobile-app", "mobile-app"]);
  assert.equal(duplicated.match(/- mobile-app:/g)?.length, 1);
});
