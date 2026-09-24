import { expect, test, type Page } from "@playwright/test";
import type { AiSnapshot, AiProject } from "../../src/lib/templates/ai-contract";

const token = "ab".repeat(32), order = "cs_test_1234567890abcdef";
const brief = { name: "BoulderMe", idea: "Find climbers with similar skills at my gym", features: "iOS", style: "cozy, fun", budget: "", decideBudget: false };
const project: AiProject = { brief, revision: 1, appliedRevision: null, appliedPlan: null, appliedBrief: null, plan: { overview: "Meet climbers at your gym.", features: [{ part: "Find climbers", description: "Find people at your gym with similar skills." }, { part: "Guest passes", description: "Offer a guest pass to another climber." }], assumptions: ["Memberships are self-reported."], questions: ["Should the first release include messaging?"], questionChoices: [{ question: "Should the first release include messaging?", options: ["Include in-app chat", "Keep invitations only"] }] }, history: [{ role: "assistant", text: "Here is your proposed first release." }] };
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
    if (data.action === "choices") state.projects["mobile-app"]!.plan.questionChoices = structuredClone(project.plan.questionChoices);
    if (data.action === "apply") { const saved = state.projects["mobile-app"]!; saved.appliedPlan = saved.plan; saved.appliedBrief = saved.brief; saved.appliedRevision = saved.revision; }
    if (data.action === "clear") state.projects = {};
    await route.fulfill({ json: { available: true, state } });
  });
  await page.goto(`/templates/library/#session_id=${order}&access=${token}`);
  await expect(page.getByRole("region", { name: "Shape your app with AI", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh conversation" })).toBeEnabled();
  return { requests, setState(value: AiSnapshot) { state = value; } };
}

test("free overview, feature list, reviewed application, chat and saved-link restoration", async ({ page }) => {
  const harness = await setup(page);
  await expect(page.getByRole("tab", { name: "Brief", exact: true })).toHaveCount(0);
  await page.getByLabel("App name").fill(brief.name);
  await page.getByLabel("What do you want to make?").fill(brief.idea);
  await page.getByLabel("Features & platforms").fill(brief.features);
  await page.getByLabel("Look & feel").fill(brief.style);
  await page.getByRole("tab", { name: "Plan", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create my free overview" })).toBeDisabled();
  const overviewConsent = page.getByLabel("Allow sending my app details and messages to OpenAI");
  const chatConsent = page.getByLabel("Send my app details and messages to OpenAI");
  await overviewConsent.check();
  await expect(chatConsent).toBeChecked();
  await chatConsent.uncheck();
  await expect(overviewConsent).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Create my free overview" })).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await overviewConsent.check();
  await page.getByRole("button", { name: "Create my free overview" }).click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole("list", { name: /Features for/ })).toContainText("Guest passes");
  await page.getByRole("region", { name: "Shape your app with AI", exact: true }).screenshot({ path: "/tmp/runit-templates-ai-overview.png" });
  await expect(page.getByText("20 of 20 messages left")).toBeVisible();
  await expect(page.locator("#full-prompt")).not.toContainText("REVIEWED APP SPECIFICATION");
  await page.getByRole("button", { name: "Use this plan" }).click();
  await expect(page.locator("#full-prompt")).toContainText("REVIEWED APP SPECIFICATION");
  await expect(page.locator("#full-prompt")).toContainText("NATIVE_FOUNDATION");
  await page.getByLabel("What would you like to change?").fill("Add invitations for a climbing session.");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("19 of 20 messages left")).toBeVisible();
  await expect(page.getByRole("list", { name: /Features for/ })).toContainText("Sessions");
  await expect(page.locator("#full-prompt")).not.toContainText("Invite another climber to a session.");
  await page.getByRole("button", { name: "Use this plan" }).click();
  await expect(page.locator("#full-prompt")).toContainText("Invite another climber to a session.");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByLabel("App name")).toHaveValue("BoulderMe");
  await expect(page.getByText("19 of 20 messages left")).toBeVisible();
  await expect(page.locator("#full-prompt")).toContainText("Invite another climber to a session.");
  expect(harness.requests.filter((value) => value.action === "overview")).toHaveLength(1);
  await page.getByText("App details & build mode", { exact: false }).click();
  await page.getByLabel("What do you want to make?").fill("A completely different idea");
  await expect(page.locator("#full-prompt")).not.toContainText("REVIEWED APP SPECIFICATION");
  await page.getByRole("tab", { name: "Plan", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("region", { name: "Shape your app with AI", exact: true }).screenshot({ path: "/tmp/runit-templates-ai-mobile.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.getByRole("button", { name: "Browser game", exact: true }).click();
  await expect(page.locator("#full-prompt")).toContainText("BROWSER_FOUNDATION");
  await expect(page.getByRole("list", { name: /Features for/ })).toHaveCount(0);
});

test("exhausted quota preserves downloads and applying; deleting content keeps usage", async ({ page }) => {
  await setup(page, { ...emptyState(), used: 20, remaining: 0, projects: { "mobile-app": structuredClone(project) }, overviewUsed: ["mobile-app"] });
  await expect(page.getByRole("button", { name: "Send message", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Use this plan" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Download prompt", exact: false })).toBeEnabled();
  await page.getByText("Manage saved content", { exact: true }).click();
  await page.getByRole("button", { name: "Delete saved AI content" }).click();
  await page.getByRole("button", { name: "Delete content for this purchase" }).click();
  await expect(page.getByRole("list", { name: /Features for/ })).toHaveCount(0);
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
  await page.getByLabel("Send my app details and messages to OpenAI").check();
  await page.getByLabel("What would you like to change?").fill("Keep guest passes optional");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "No message was deducted" })).toBeVisible();
  await expect(page.getByLabel("What would you like to change?")).toHaveValue("Keep guest passes optional");
  await expect(page.getByText("20 of 20 messages left")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download prompt", exact: false })).toBeEnabled();
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
  await page.getByLabel("Send my app details and messages to OpenAI").check();
  await page.getByLabel("What would you like to change?").fill("Keep guest passes optional");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(page.getByText("Your response was saved. Review the updated plan below.")).toBeVisible();
  await expect(page.getByLabel("What would you like to change?")).toHaveValue("");
  await expect(page.getByText("19 of 20 messages left")).toBeVisible();
  expect(sent).toBe(1);
});

test("workspace tabs keep chat and drafts intact with two-column feature cards", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const harness = await setup(page, { ...emptyState(), projects: { "mobile-app": structuredClone(project) }, overviewUsed: ["mobile-app"] });
  await page.route("**/api/templates/library/**", (route) => route.fulfill({ json: { templates: [{ id: "mobile-app", foundation: "FOUNDATION" }], subagents: true, subagentInstructions: "PURCHASED_WORKFLOW" } }));
  await page.reload();
  const chat = page.getByRole("complementary", { name: "AI editing chat" });
  const composer = page.getByLabel("What would you like to change?");
  await expect(composer).toBeEnabled();
  await composer.fill("Keep this draft while I review my files.");
  await page.getByLabel("Send my app details and messages to OpenAI").check();
  for (const name of ["Build files", "Add-ons", "Plan"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(page.getByRole("tabpanel")).toHaveCount(1);
    await expect(chat).toBeVisible();
    await expect(composer).toHaveValue("Keep this draft while I review my files.");
    await expect(page.getByLabel("Send my app details and messages to OpenAI")).toBeChecked();
    const panelBox = await page.getByRole("tabpanel").boundingBox();
    const chatBox = await chat.boundingBox();
    expect(chatBox!.x).toBeGreaterThan(panelBox!.x + panelBox!.width);
  }
  const rows = page.getByRole("list", { name: /Features for/ }).getByRole("listitem");
  const first = await rows.nth(0).boundingBox(), second = await rows.nth(1).boundingBox();
  expect(second!.x).toBeGreaterThan(first!.x + first!.width);
  expect(Math.abs(second!.y - first!.y)).toBeLessThan(2);
  await page.screenshot({ path: "/tmp/runit-purchase-tabs-desktop.png", fullPage: true });
  await page.getByRole("tab", { name: "Plan", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Build files", exact: true })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Build files", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Plan", exact: true }).click();
  await page.getByText("App details & build mode", { exact: false }).click();
  await page.getByLabel("App name").fill("My renamed app");
  await page.getByRole("tab", { name: "Add-ons", exact: true }).click();
  await expect(page.getByRole("article", { name: "Subagent workflow" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Your purchased extras" }).getByRole("checkbox")).toHaveCount(0);
  await page.getByRole("tab", { name: "Build files", exact: true }).click();
  const downloads = page.getByRole("group", { name: "Download file structure" });
  await expect(downloads).toContainText("mobile-app-prompt.txt");
  await expect(downloads).toContainText("my-renamed-app-complete-guide.html");
  await expect(downloads).toContainText("subagent-workflow.txt");
  await expect(downloads).not.toContainText("skill-tree-setup-prompt.txt");
  await expect(page.getByRole("list", { name: "Example generated project structure" })).toContainText("SETUP.md");
  await expect(page.getByText("Your coding AI creates these during the build; they are not included in the downloads above.", { exact: false })).toBeVisible();
  await expect(page.locator("#full-prompt")).toContainText("PURCHASED_WORKFLOW");
  await page.getByRole("tab", { name: "Plan", exact: true }).click();
  await expect(page.getByLabel("App name")).toHaveValue("My renamed app");
  await expect(page.getByLabel("Running budget")).toBeVisible();
  await expect(composer).toHaveValue("Keep this draft while I review my files.");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "Add-ons", exact: true }).click();
  await page.getByRole("button", { name: /AI chat ·/ }).click();
  await expect(composer).toHaveValue("Keep this draft while I review my files.");
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Add-ons", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("article", { name: "Subagent workflow" })).toBeVisible();
  await page.getByRole("tab", { name: "Plan", exact: true }).click();
  await page.screenshot({ path: "/tmp/runit-purchase-tabs-mobile.png", fullPage: true });
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of ["Plan", "Build files", "Add-ons"]) {
      await page.getByRole("tab", { name, exact: true }).click();
      const overflow = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, nodes: [...document.querySelectorAll("body *")].filter((node) => node.getBoundingClientRect().right > document.documentElement.clientWidth + 1).slice(0, 8).map((node) => ({ tag: node.tagName, className: node.className, text: node.textContent?.slice(0, 35), right: Math.round(node.getBoundingClientRect().right) })) }));
      expect(overflow.scroll, JSON.stringify({ width, tab: name, ...overflow })).toBeLessThanOrEqual(overflow.viewport);
    }
  }
  expect(harness.requests.every((request) => request.action === "load")).toBe(true);
});

test("paid decisions appear below the composer and add AI answers to the draft", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const saved = structuredClone(project);
  saved.plan.questions.push("Which gyms should launch first?");
  saved.plan.questionChoices?.push({ question: "Which gyms should launch first?", options: ["Start with one gym", "Include nearby gyms"] });
  const harness = await setup(page, { ...emptyState(), projects: { "mobile-app": saved }, overviewUsed: ["mobile-app"] });
  const chat = page.getByRole("complementary", { name: "AI editing chat" });
  const composer = chat.getByLabel("What would you like to change?");
  const decisions = chat.getByRole("region", { name: "Decisions to make" });
  await expect(decisions.getByRole("button", { name: "Include in-app chat", exact: true })).toBeVisible();
  await expect(decisions.getByRole("button", { name: "Start with one gym", exact: true })).toBeVisible();
  const composerBox = await composer.boundingBox(), decisionBox = await decisions.boundingBox(), conversationBox = await chat.getByRole("log", { name: "Conversation" }).boundingBox();
  expect(decisionBox!.y).toBeGreaterThan(composerBox!.y + composerBox!.height);
  expect(conversationBox!.y).toBeGreaterThan(decisionBox!.y + decisionBox!.height - 1);
  await decisions.getByRole("button", { name: "Include in-app chat", exact: true }).click();
  await expect(composer).toHaveValue("About “Should the first release include messaging?”: Include in-app chat");
  await expect(decisions.getByText(saved.plan.questions[0])).toHaveCount(0);
  await decisions.getByRole("button", { name: "Write my own answer" }).click();
  await decisions.getByLabel("Your answer").fill("Only gyms in Toronto.");
  await decisions.getByRole("button", { name: "Add answer" }).click();
  await expect(composer).toHaveValue("About “Should the first release include messaging?”: Include in-app chat\n\nAbout “Which gyms should launch first?”: Only gyms in Toronto.");
  await expect(decisions).toHaveCount(0);
  await chat.getByLabel("Send my app details and messages to OpenAI").check();
  await chat.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(chat.getByText("Only gyms in Toronto.", { exact: false })).toBeVisible();
  await expect(decisions).toHaveCount(0);
  expect(harness.requests.filter((request) => request.action === "message")).toHaveLength(1);
});

test("paid legacy questions gain AI examples after consent without using an editing message", async ({ page }) => {
  const saved = structuredClone(project);
  saved.plan.questionChoices = undefined;
  const harness = await setup(page, { ...emptyState(), projects: { "mobile-app": saved }, overviewUsed: ["mobile-app"] });
  const decisions = page.getByRole("region", { name: "Decisions to make" });
  await expect(decisions.getByRole("button", { name: "Write my answer" })).toBeVisible();
  await page.getByLabel("Send my app details and messages to OpenAI").check();
  await expect(decisions.getByRole("button", { name: "Include in-app chat" })).toBeVisible();
  await expect(page.getByText("20 of 20 messages left")).toBeVisible();
  expect(harness.requests.filter((request) => request.action === "choices")).toHaveLength(1);
  expect(harness.requests.filter((request) => request.action === "message")).toHaveLength(0);
});
