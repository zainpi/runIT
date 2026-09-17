import { expect, test, type Page } from "@playwright/test";
import type { AiSnapshot, AiProject } from "../../src/lib/templates/ai-contract";

const token = "ab".repeat(32), order = "cs_test_1234567890abcdef";
const brief = { name: "BoulderMe", idea: "Find climbers with similar skills at my gym", features: "iOS", style: "cozy, fun", budget: "", decideBudget: false };
const project: AiProject = { brief, revision: 1, appliedRevision: null, appliedPlan: null, appliedBrief: null, plan: { overview: "Meet climbers at your gym.", features: [{ part: "Find climbers", description: "Find people at your gym with similar skills." }, { part: "Guest passes", description: "Offer a guest pass to another climber." }], assumptions: ["Memberships are self-reported."], questions: ["Should the first release include messaging?"] }, history: [{ role: "assistant", text: "Here is your proposed first release." }] };
const emptyState = (): AiSnapshot => ({ used: 0, remaining: 20, limit: 20, pending: false, projects: {}, overviewUsed: [] });

async function setup(page: Page, initial = emptyState()) {
  let state = structuredClone(initial);
  const requests: Record<string, unknown>[] = [];
  await page.route("**/api/templates/library/**", (route) => route.fulfill({ json: { templates: [{ id: "mobile-app", foundation: "NATIVE_FOUNDATION: Keep authorization and tests." }, { id: "browser-game", foundation: "BROWSER_FOUNDATION" }] } }));
  await page.route("**/api/templates/ai/**", async (route) => {
    const data = route.request().postDataJSON(); requests.push(data);
    if (data.action === "overview") { state.projects["mobile-app"] = structuredClone(project); state.overviewUsed.push("mobile-app"); }
    if (data.action === "message") {
      state.used++; state.remaining--;
      const saved = state.projects["mobile-app"]!;
      saved.revision++; saved.brief = data.brief;
      saved.history.push({ role: "user", text: data.message }, { role: "assistant", text: "I added session invitations." });
      saved.plan = { ...saved.plan, features: [...saved.plan.features, { part: "Sessions", description: "Invite another climber to a session." }] };
    }
    if (data.action === "apply") { const saved = state.projects["mobile-app"]!; saved.appliedPlan = saved.plan; saved.appliedBrief = saved.brief; saved.appliedRevision = saved.revision; }
    if (data.action === "clear") state.projects = {};
    await route.fulfill({ json: { available: true, state } });
  });
  await page.goto(`/templates/library/#session_id=${order}&access=${token}`);
  await expect(page.getByRole("heading", { name: "Shape your app with AI" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh conversation" })).toBeEnabled();
  return { requests, setState(value: AiSnapshot) { state = value; } };
}

test("free overview, feature table, reviewed application, chat and saved-link restoration", async ({ page }) => {
  const harness = await setup(page);
  await page.getByLabel("App name").fill(brief.name);
  await page.getByLabel("What do you want to make?").fill(brief.idea);
  await page.getByLabel("Features & platforms").fill(brief.features);
  await page.getByLabel("Look & feel").fill(brief.style);
  await expect(page.getByRole("button", { name: "Create my free overview" })).toBeDisabled();
  await page.getByLabel("Send my brief and messages to OpenAI").check();
  await page.getByRole("button", { name: "Create my free overview" }).click();
  await expect(page.getByRole("table")).toContainText("Guest passes");
  await page.locator("section").filter({ has: page.getByRole("heading", { name: "Shape your app with AI" }) }).screenshot({ path: "/tmp/runit-templates-ai-overview.png" });
  await expect(page.getByText("20 of 20 messages left")).toBeVisible();
  await expect(page.locator("#full-prompt")).not.toContainText("REVIEWED APP SPECIFICATION");
  await page.getByRole("button", { name: "Apply plan to my prompt" }).click();
  await expect(page.locator("#full-prompt")).toContainText("REVIEWED APP SPECIFICATION");
  await expect(page.locator("#full-prompt")).toContainText("NATIVE_FOUNDATION");
  await page.getByLabel("What would you like to change?").fill("Add invitations for a climbing session.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("19 of 20 messages left")).toBeVisible();
  await expect(page.getByRole("table")).toContainText("Sessions");
  await expect(page.locator("#full-prompt")).not.toContainText("Invite another climber to a session.");
  await page.getByRole("button", { name: "Apply plan to my prompt" }).click();
  await expect(page.locator("#full-prompt")).toContainText("Invite another climber to a session.");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByLabel("App name")).toHaveValue("BoulderMe");
  await expect(page.getByText("19 of 20 messages left")).toBeVisible();
  await expect(page.locator("#full-prompt")).toContainText("Invite another climber to a session.");
  expect(harness.requests.filter((value) => value.action === "overview")).toHaveLength(1);
  await page.getByLabel("What do you want to make?").fill("A completely different idea");
  await expect(page.locator("#full-prompt")).not.toContainText("REVIEWED APP SPECIFICATION");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("section").filter({ has: page.getByRole("heading", { name: "Shape your app with AI" }) }).screenshot({ path: "/tmp/runit-templates-ai-mobile.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.getByRole("button", { name: "Browser game", exact: true }).click();
  await expect(page.locator("#full-prompt")).toContainText("BROWSER_FOUNDATION");
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("exhausted quota preserves downloads and applying; deleting content keeps usage", async ({ page }) => {
  await setup(page, { ...emptyState(), used: 20, remaining: 0, projects: { "mobile-app": structuredClone(project) }, overviewUsed: ["mobile-app"] });
  await expect(page.getByRole("button", { name: "Send message", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Apply plan to my prompt" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Download .txt", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Delete saved AI content" }).click();
  await page.getByRole("button", { name: "Delete content for this purchase" }).click();
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByText("0 of 20 messages left")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create my free overview" })).toHaveCount(0);
});

test("provider failure preserves the message and template; pending state can be refreshed", async ({ page }) => {
  await setup(page, { ...emptyState(), projects: { "mobile-app": structuredClone(project) }, overviewUsed: ["mobile-app"] });
  await page.route("**/api/templates/ai/**", async (route) => {
    const data = route.request().postDataJSON();
    if (data.action === "message") return route.fulfill({ status: 502, json: { error: "The AI could not finish. No message was deducted." } });
    return route.fulfill({ json: { available: true, state: { ...emptyState(), projects: { "mobile-app": project }, overviewUsed: ["mobile-app"] } } });
  });
  await page.getByLabel("Send my brief and messages to OpenAI").check();
  await page.getByLabel("What would you like to change?").fill("Keep guest passes optional");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "No message was deducted" })).toBeVisible();
  await expect(page.getByLabel("What would you like to change?")).toHaveValue("Keep guest passes optional");
  await expect(page.getByText("20 of 20 messages left")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download .txt", exact: true })).toBeEnabled();
});

test("a lost response is recovered from saved history without sending the message twice", async ({ page }) => {
  await setup(page, { ...emptyState(), projects: { "mobile-app": structuredClone(project) }, overviewUsed: ["mobile-app"] });
  let sent = 0;
  const saved = structuredClone(project);
  await page.route("**/api/templates/ai/**", async (route) => {
    const data = route.request().postDataJSON();
    if (data.action === "message") {
      sent++; saved.revision++; saved.history.push({ role: "user", text: data.message }, { role: "assistant", text: "Saved your change." });
      await route.abort("failed"); return;
    }
    await route.fulfill({ json: { available: true, state: { ...emptyState(), used: sent, remaining: 20 - sent, projects: { "mobile-app": saved }, overviewUsed: ["mobile-app"] } } });
  });
  await page.getByLabel("Send my brief and messages to OpenAI").check();
  await page.getByLabel("What would you like to change?").fill("Keep guest passes optional");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("Your response was saved. Review the updated plan below.")).toBeVisible();
  await expect(page.getByLabel("What would you like to change?")).toHaveValue("");
  await expect(page.getByText("19 of 20 messages left")).toBeVisible();
  expect(sent).toBe(1);
});
