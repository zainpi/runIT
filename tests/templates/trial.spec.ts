import { expect, test, type Page } from "@playwright/test";
import type { AiSnapshot, AppPlan } from "../../src/lib/templates/ai-contract";

const token = "ab".repeat(32), sessionId = `trial_${"1".repeat(64)}`;
const trialUrl = `/templates/trial/#session_id=${sessionId}&access=${token}`;
const brief = { name: "BoulderMe", idea: "A place for climbers with similar skills to meet at their gym, share guest passes and plan a session together.", features: "iOS", style: "cozy, fun", budget: "" };
const plan: AppPlan = { overview: "BoulderMe helps climbers find their people. Meet someone at your level, at a gym you already love, and turn a solo session into a shared one.", features: [
  { part: "Onboarding", description: "Choose your climbing level, preferred gyms, and availability." },
  { part: "Climber profiles", description: "Show your bouldering grade, gym memberships, and whether you have a guest pass." },
  { part: "Find climbers", description: "Browse people at the same gym with a similar skill level." },
  { part: "Plan a session", description: "Invite someone to climb and agree on a gym and time." },
  { part: "Look & feel", description: "A cozy, playful design with friendly copy and approachable cards." },
], assumptions: ["Gym memberships and guest passes are self-reported."], questions: ["Should climbers connect one-to-one, or join small group sessions?", "Which gyms should be included at launch?"], questionChoices: [
  { question: "Should climbers connect one-to-one, or join small group sessions?", options: ["One-to-one sessions", "Small group sessions"] },
  { question: "Which gyms should be included at launch?", options: ["Start with my gym", "Include nearby gyms"] },
], technicalDetails: ["Keep gym, profile, and session records scoped to each account.", "Validate invitations on the server before notifying another climber."] };
const fresh = (): AiSnapshot => ({ used: 0, remaining: 3, limit: 3, pending: false, projects: {}, overviewUsed: [], initialBrief: brief, overviewConsent: true, canStartOverview: true });

async function mockWorkspace(page: Page, initial = fresh(), failOverview = false, loseMessage = false) {
  let state = structuredClone(initial);
  const requests: Record<string, unknown>[] = [];
  await page.route("**/api/templates/trial/**", (route) => route.fulfill({ json: { templateId: "mobile-app", messageLimit: 3 } }));
  await page.route("**/api/templates/ai/**", async (route) => {
    const data = route.request().postDataJSON();
    requests.push(data);
    if (data.action === "overview" || data.action === "message") {
      state.canStartOverview = false;
      if (failOverview) { failOverview = false; return route.fulfill({ status: 502, json: { error: "The AI response could not be completed. No message was deducted. Try again." } }); }
      if (data.action === "message") { state.used++; state.remaining--; }
      state.overviewUsed = ["mobile-app"];
      const updatedPlan = data.action === "message" ? { ...(state.projects["mobile-app"]?.plan ?? plan), overview: "Your revised climbing app includes small group sessions." } : plan;
      state.projects["mobile-app"] = { brief: data.brief, plan: updatedPlan, revision: (state.projects["mobile-app"]?.revision ?? 0) + 1, appliedRevision: null, appliedPlan: null, appliedBrief: null, history: [...(state.projects["mobile-app"]?.history ?? []), ...(data.action === "message" ? [{ role: "user" as const, text: data.message }] : []), { role: "assistant", text: data.action === "overview" ? "I’ve shaped your brief into a first plan. Take a look at the features — tell me what you’d like to change." : "I’ve added small group sessions and saved your updated plan." }] };
      if (data.action === "message" && loseMessage) { loseMessage = false; return route.abort("failed"); }
    }
    if (data.action === "clear") state = { ...state, projects: {}, initialBrief: undefined, overviewConsent: false, canStartOverview: false };
    return route.fulfill({ json: { available: true, state } });
  });
  return { requests, state: () => state };
}

test("free checkout requires a template and description, preserves the brief and retries safely", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route("**/api/templates/config/**", (route) => route.fulfill({ json: { available: true, testMode: true, currency: "usd" } }));
  const workspace = await mockWorkspace(page);
  const redemptions: Record<string, unknown>[] = [];
  await page.route("**/api/templates/trial/**", async (route) => {
    const data = route.request().postDataJSON();
    if (data.action === "load") return route.fulfill({ json: { templateId: "mobile-app", messageLimit: 3 } });
    redemptions.push(data);
    if (redemptions.length === 1) return route.abort("failed");
    return route.fulfill({ json: { sessionId, templateId: "mobile-app", messageLimit: 3 } });
  });
  await page.goto("/templates/");
  await page.getByRole("button", { name: "Have a free-trial code?" }).click();
  await page.getByLabel("Free-trial code", { exact: true }).fill("sample-code");
  const checkout = page.getByRole("button", { name: "Start free trial" });
  await expect(page.getByLabel("Template", { exact: true })).toHaveValue("");
  await expect(checkout).toBeDisabled();
  await page.getByRole("button", { name: "Add Mobile app", exact: true }).click();
  await expect(page.getByLabel("Template", { exact: true })).toHaveValue("mobile-app");
  await page.getByLabel("Use OpenAI to create my plan").check();
  await expect(checkout).toBeDisabled();
  await page.getByLabel("What do you want to make?").fill(brief.idea);
  await expect(checkout).toBeEnabled();
  await expect(page.locator("#bundle")).toContainText("No card needed");
  await expect(page.getByRole("button", { name: "Try test checkout" })).toHaveCount(0);
  await page.locator("#free-trial").screenshot({ path: "/tmp/runit-dashboard-checkout.png" });
  await checkout.click();
  await expect(page.locator("#free-trial").getByRole("alert")).toBeVisible();
  await checkout.click();
  await expect(page).toHaveURL(new RegExp(`/templates/trial/#session_id=${sessionId}&access=[a-f0-9]{64}`));
  expect(redemptions).toHaveLength(2);
  expect(redemptions[1].accessToken).toBe(redemptions[0].accessToken);
  expect(redemptions[1]).toMatchObject({ code: "SAMPLE-CODE", templateId: "mobile-app", brief: { name: "", idea: brief.idea, features: "", style: "", budget: "" }, consent: true });
  await expect(page.getByRole("heading", { name: "BoulderMe", exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: /Features for/ })).toContainText("Find climbers");
  expect(workspace.requests.filter((data) => data.action === "overview")).toHaveLength(1);
  await expect(page.getByText("3 of 3 editing messages left")).toBeVisible();
  await expect(page.getByLabel("What do you want to make?")).toHaveCount(0);
  await page.getByText("Save private link", { exact: false }).click();
  await expect(page.getByLabel("Your private trial URL")).toHaveValue(new RegExp(sessionId));
});

test("dashboard keeps the plan beside chat, updates it, restores on a clean browser and preserves exhausted access", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const workspace = await mockWorkspace(page);
  await page.goto(trialUrl);
  const featureList = page.getByRole("list", { name: /Features for/ });
  await expect(featureList).toContainText("Plan a session");
  const featureCard = featureList.getByRole("button", { name: /Find climbers/ });
  await featureCard.click();
  await expect(featureCard).toHaveAttribute("aria-pressed", "true");
  await featureCard.click();
  await expect(featureCard).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => featureCard.locator("span").first().evaluate((node) => getComputedStyle(node).transform)).toBe("none");
  await expect(page.getByText("Working assumptions")).toHaveCount(0);
  await page.locator("details").filter({ hasText: "Technical details" }).locator("summary").click();
  await expect(page.getByText("Validate invitations on the server before notifying another climber.")).toBeVisible();
  const planBox = await page.getByRole("region", { name: "Your project plan" }).boundingBox();
  const chatBox = await page.getByRole("complementary", { name: "AI editing chat" }).boundingBox();
  expect(chatBox!.x).toBeGreaterThan(planBox!.x + planBox!.width);
  expect(chatBox!.y).toBe(planBox!.y);
  await page.screenshot({ path: "/tmp/runit-dashboard-desktop.png", fullPage: true });
  await expect(page.locator("#full-prompt")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Apply plan" })).toHaveCount(0);
  const chat = page.getByRole("complementary", { name: "AI editing chat" });
  await expect(page.getByRole("region", { name: "Your project plan" }).getByText("Decisions to make")).toHaveCount(0);
  await expect(chat.getByText("I’ve shaped your brief into a first plan.", { exact: false })).toBeVisible();
  const decisions = chat.getByRole("region", { name: "Decisions to make" });
  await expect(decisions).toContainText(plan.questions[0]);
  await page.getByLabel("Ask for a change").fill("Keep the design welcoming.");
  const composerBox = await page.getByLabel("Ask for a change").boundingBox();
  const conversationBox = await chat.getByRole("log", { name: "Conversation" }).boundingBox();
  expect(composerBox!.y).toBeLessThan(conversationBox!.y);
  const collapse = chat.getByRole("button", { name: "Collapse" });
  await collapse.click();
  await expect(chat.getByRole("log", { name: "Conversation" })).toBeHidden();
  await expect(page.getByLabel("Ask for a change")).toBeHidden();
  await expect(chat.getByRole("button", { name: "Expand" })).toHaveAttribute("aria-expanded", "false");
  await chat.getByRole("button", { name: "Expand" }).click();
  await expect(page.getByLabel("Ask for a change")).toHaveValue("Keep the design welcoming.");
  await decisions.getByRole("listitem").filter({ hasText: plan.questions[0] }).getByRole("button", { name: "Small group sessions", exact: true }).click();
  await expect(page.getByLabel("Ask for a change")).toHaveValue(`Keep the design welcoming.\n\nAbout “${plan.questions[0]}”: Small group sessions`);
  await expect(decisions.getByRole("listitem").filter({ hasText: plan.questions[0] })).toHaveCount(0);
  await decisions.getByRole("listitem").filter({ hasText: plan.questions[1] }).getByRole("button", { name: /Write my (own )?answer/ }).click();
  await decisions.getByLabel("Your answer").fill("Start with downtown gyms.");
  await decisions.getByRole("button", { name: "Add answer" }).click();
  await expect(page.getByLabel("Ask for a change")).toHaveValue(`Keep the design welcoming.\n\nAbout “${plan.questions[0]}”: Small group sessions\n\nAbout “${plan.questions[1]}”: Start with downtown gyms.`);
  await expect(decisions).toHaveCount(0);
  await page.getByRole("button", { name: "Suggest a starting budget" }).click();
  await expect(page.getByLabel("Ask for a change")).toHaveValue(/Keep the design welcoming\.[\s\S]*Should climbers connect[\s\S]*Which gyms[\s\S]*recommend a practical starting budget/);
  for (let i = 0; i < 3; i++) {
    await page.getByLabel("Ask for a change").fill(i === 0 ? `About “${plan.questions[0]}”: Let people join small group sessions.` : `Add small group sessions ${i}`);
    await page.getByRole("button", { name: "Send changes" }).click();
    await expect(page.getByText(`${2 - i} of 3 editing messages left`)).toBeVisible();
    await expect(page.getByRole("region", { name: "Your project plan" })).toContainText("Your revised climbing app includes small group sessions.");
  }
  await expect(chat.getByText("I’ve shaped your brief into a first plan.", { exact: false })).toBeVisible();
  await expect(chat.getByText(`About “${plan.questions[0]}”: Let people join small group sessions.`)).toBeVisible();
  await expect(chat.getByText("I’ve added small group sessions and saved your updated plan.").first()).toBeVisible();
  await expect(decisions).toContainText(plan.questions[1]);
  await expect(decisions).not.toContainText(plan.questions[0]);
  await expect(page.getByLabel("Ask for a change")).toHaveCount(0);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await expect(page.getByRole("heading", { name: "BoulderMe", exact: true })).toBeVisible();
  await expect(page.getByText("0 of 3 editing messages left")).toBeVisible();
  expect(workspace.requests.filter((data) => data.action === "overview")).toHaveLength(1);
  const downloadButtons = page.getByRole("button", { name: "Download plan", exact: false });
  await expect(downloadButtons).toHaveCount(2);
  const download = page.waitForEvent("download");
  await downloadButtons.last().click();
  expect((await download).suggestedFilename()).toBe("boulderme-plan.json");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("list", { name: /Features for/ })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "AI editing chat" })).toBeHidden();
  await page.screenshot({ path: "/tmp/runit-dashboard-mobile-plan.png", fullPage: true });
  await page.getByRole("button", { name: "AI chat" }).click();
  await expect(page.getByRole("complementary", { name: "AI editing chat" })).toBeVisible();
  await expect(decisions).toContainText(plan.questions[1]);
  await expect(chat.getByText("I’ve shaped your brief into a first plan.", { exact: false })).toBeVisible();
  expect(await chat.getByRole("log", { name: "Conversation" }).evaluate((node) => node.scrollHeight <= node.clientHeight)).toBe(true);
  await expect(page.getByRole("list", { name: /Features for/ })).toBeHidden();
  await page.screenshot({ path: "/tmp/runit-dashboard-mobile-chat.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.getByText("Manage saved content", { exact: true }).click();
  await page.getByRole("button", { name: "Delete saved content", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete", exact: true }).click();
  await expect(page.getByText("Saved brief, plan, and chat deleted.", { exact: false })).toBeVisible();
  await expect(page.getByRole("list", { name: /Features for/ })).toHaveCount(0);
  await expect(page.getByText("0 of 3 editing messages left")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "BoulderMe", exact: true })).toHaveCount(0);
  expect(workspace.requests.filter((data) => data.action === "overview")).toHaveLength(1);
});

test("decisions show three at a time and collect seven answers in one message", async ({ page }) => {
  const questions = [
    "Which city should launch first?",
    "Should gym partners approve guest passes?",
    "Should members save favorite gyms?",
    "Should sessions support groups?",
    "Should profiles show climbing grades?",
    "Should invites expire after one day?",
    "Should new members get a welcome tour?",
  ];
  const options: [string, string][] = [
    ["Start in my city", "Start near partner gyms"],
    ["Require gym approval", "Use self-reported passes"],
    ["Save favorite gyms", "Browse without favorites"],
    ["Support group sessions", "Keep sessions one-to-one"],
    ["Show climbing grades", "Keep grades private"],
    ["Expire after one day", "Keep invites open"],
    ["Include a welcome tour", "Go straight to the app"],
  ];
  const initial = fresh();
  initial.canStartOverview = false;
  initial.overviewUsed = ["mobile-app"];
  initial.projects["mobile-app"] = {
    brief,
    plan: { ...plan, questions, questionChoices: questions.map((question, index) => ({ question, options: options[index] })) },
    revision: 1,
    appliedRevision: null,
    appliedPlan: null,
    appliedBrief: null,
    history: [{ role: "assistant", text: "Here is your first plan." }],
  };
  const workspace = await mockWorkspace(page, initial);
  await page.goto(trialUrl);
  const decisions = page.getByRole("region", { name: "Decisions to make" });
  const cards = decisions.getByRole("listitem");
  const composer = page.getByLabel("Ask for a change");
  await expect(cards).toHaveCount(3);
  await expect(decisions).toContainText("7 left");
  await expect(decisions).not.toContainText(questions[3]);
  await composer.fill("Keep the interface welcoming.");

  await cards.filter({ hasText: questions[0] }).getByRole("button", { name: /Write my (own )?answer/ }).click();
  await decisions.getByLabel("Your answer").fill("Toronto first.");
  await decisions.getByRole("button", { name: "Add answer" }).click();
  await expect(cards.filter({ hasText: questions[0] })).toHaveCount(0);
  await expect(cards).toHaveCount(3);
  await expect(decisions).toContainText(questions[3]);
  await expect(decisions).toContainText("6 left");

  const answers = [options[1][1], options[2][0], options[3][0], options[4][1], options[5][0], options[6][1]];
  for (let index = 1; index < questions.length; index++) {
    await cards.filter({ hasText: questions[index] }).getByRole("button", { name: answers[index - 1], exact: true }).click();
    await expect(cards.filter({ hasText: questions[index] })).toHaveCount(0);
    expect(await composer.inputValue()).toContain(`About “${questions[index]}”: ${answers[index - 1]}`);
  }
  await expect(decisions).toHaveCount(0);
  await expect(composer).toHaveValue(`Keep the interface welcoming.\n\nAbout “${questions[0]}”: Toronto first.${questions.slice(1).map((question, index) => `\n\nAbout “${question}”: ${answers[index]}`).join("")}`);

  await page.getByRole("button", { name: "Send changes" }).click();
  await expect(page.getByText("2 of 3 editing messages left")).toBeVisible();
  expect(workspace.requests.filter((request) => request.action === "message")).toHaveLength(1);
  await expect(decisions).toHaveCount(0);
  await page.reload();
  await expect(decisions).toHaveCount(0);
});

test("contextual answers and the sparkle button fit mobile and only draft changes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const workspace = await mockWorkspace(page);
  await page.goto(trialUrl);
  await expect(page.getByRole("heading", { name: "BoulderMe", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "AI chat" }).click();
  const decisions = page.getByRole("region", { name: "Decisions to make" });
  const choices = decisions.getByRole("group", { name: plan.questions[0], exact: true });
  const composer = page.getByLabel("Ask for a change");
  await expect(choices.getByRole("button")).toHaveCount(3);
  await expect(choices.getByRole("button", { name: "One-to-one sessions", exact: true })).toBeVisible();
  await expect(choices.getByRole("button", { name: "Small group sessions", exact: true })).toBeVisible();
  await expect(decisions.getByRole("button", { name: /^(Yes|No)$/ })).toHaveCount(0);
  const decide = choices.getByRole("button", { name: "Decide for me", exact: true });
  await expect(decide).toHaveAttribute("title", "Decide for me");
  expect((await decide.boundingBox())!.width).toBeLessThan((await choices.getByRole("button", { name: "Small group sessions", exact: true }).boundingBox())!.width);
  await decisions.screenshot({ path: "/tmp/runit-decision-choices-mobile.png" });
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect(await choices.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  }
  await decisions.screenshot({ path: "/tmp/runit-decision-choices-desktop.png" });
  await composer.fill("x".repeat(1980));
  for (const button of await choices.getByRole("button").all()) await expect(button).toBeDisabled();
  await composer.fill("Keep the design welcoming.");
  await decide.focus();
  await decide.press("Enter");
  const recommendation = "Decide for me. Recommend the simplest practical option for my app and explain why.";
  await expect(composer).toHaveValue(`Keep the design welcoming.\n\nAbout “${plan.questions[0]}”: ${recommendation}`);
  await expect(choices).toHaveCount(0);
  await expect(decisions).toContainText(plan.questions[1]);
  await expect(page.getByText("3 of 3 editing messages left")).toBeVisible();
  expect(workspace.requests.filter((request) => request.action === "message")).toHaveLength(0);
  await page.getByRole("button", { name: "Send changes" }).click();
  await expect(page.getByText("2 of 3 editing messages left")).toBeVisible();
  expect(workspace.requests.filter((request) => request.action === "message")).toHaveLength(1);
  await page.reload();
  await expect(decisions).toContainText(plan.questions[1]);
  await expect(decisions).not.toContainText(plan.questions[0]);
});

for (const mode of ["legacy", "pending", "exhausted"] as const) {
  test(`${mode} saved plans keep appropriate decision controls`, async ({ page }) => {
    const initial = fresh();
    initial.canStartOverview = false;
    initial.overviewUsed = ["mobile-app"];
    initial.pending = mode === "pending";
    initial.remaining = mode === "exhausted" ? 0 : 3;
    initial.used = mode === "exhausted" ? 3 : 0;
    initial.projects["mobile-app"] = { brief, plan: { ...plan, questionChoices: mode === "legacy" ? undefined : plan.questionChoices }, revision: 1, appliedRevision: null, appliedPlan: null, appliedBrief: null, history: [] };
    const workspace = await mockWorkspace(page, initial);
    await page.goto(trialUrl);
    const decisions = page.getByRole("region", { name: "Decisions to make" });
    await expect(decisions).toBeVisible();
    if (mode !== "legacy") {
      for (const button of await decisions.getByRole("button").all()) await expect(button).toBeDisabled();
      return;
    }
    await expect(decisions.getByRole("button", { name: /^(Yes|No)$/ })).toHaveCount(0);
    const first = decisions.getByRole("listitem").filter({ hasText: plan.questions[0] });
    await first.getByRole("button", { name: "Write my answer", exact: true }).click();
    await first.getByLabel("Your answer").fill("Start with groups of four.");
    await first.getByRole("button", { name: "Add answer", exact: true }).click();
    await expect(first).toHaveCount(0);
    await decisions.getByRole("button", { name: "Decide for me", exact: true }).click();
    await expect(decisions).toHaveCount(0);
    await expect(page.getByLabel("Ask for a change")).toHaveValue(/Start with groups of four\.[\s\S]*Decide for me/);
    expect(workspace.requests.filter((request) => request.action === "overview" || request.action === "message")).toHaveLength(0);
  });
}

test("managed launch request describes mobile hosting and omits the private trial credential", async ({ page }) => {
  await mockWorkspace(page);
  await page.goto(trialUrl);
  await page.getByRole("button", { name: "Have us launch it" }).click();
  const card = page.locator("#managed-launch");
  await expect(card).toContainText("backend, database and other cloud services");
  await card.getByLabel("Host my app’s cloud services").check();
  await card.getByLabel("Anything we should know?").fill("Need iOS release and sign-in.");
  const href = await card.getByRole("link", { name: "Email us a request" }).getAttribute("href");
  const request = new URL(href!);
  expect(request.protocol).toBe("mailto:");
  expect(request.searchParams.get("body")).toContain("Need iOS release and sign-in.");
  expect(request.searchParams.get("body")).toContain("Host my app’s cloud services");
  expect(href).not.toContain(token);
  expect(href).not.toContain(sessionId);
  await expect(page).toHaveURL(trialUrl);
});

test("quick options keep their labels and fill detailed, fully visible drafts", async ({ page }) => {
  await mockWorkspace(page);
  await page.goto(trialUrl);
  const composer = page.getByLabel("Ask for a change");
  for (const [label, detail] of [
    ["Keep only the essentials", "core user journey"],
    ["Make the design feel warmer", "typography"],
    ["Suggest a starting budget", "monthly operating costs"],
  ]) {
    await page.getByRole("button", { name: label }).click();
    const draft = await composer.inputValue();
    expect(draft.length).toBeGreaterThan(300);
    expect(draft).toContain(detail);
    await expect.poll(() => composer.evaluate((node) => node.scrollHeight <= node.clientHeight)).toBe(true);
  }
});

test("a failed overview offers a manual retry without an automatic request loop", async ({ page }) => {
  const workspace = await mockWorkspace(page, fresh(), true);
  await page.goto(trialUrl);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("No message was deducted");
  await expect(page.getByRole("button", { name: "Create free overview" })).toBeEnabled();
  expect(workspace.requests.filter((data) => data.action === "overview")).toHaveLength(1);
  await page.getByRole("button", { name: "Create free overview" }).click();
  await expect(page.getByRole("list", { name: /Features for/ })).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  expect(workspace.requests.filter((data) => data.action === "overview")).toHaveLength(2);
  await expect(page.getByText("3 of 3 editing messages left")).toBeVisible();
});

test("a lost message response recovers the saved reply and clears the composer without another charge", async ({ page }) => {
  const workspace = await mockWorkspace(page, fresh(), false, true);
  await page.goto(trialUrl);
  await expect(page.getByRole("list", { name: /Features for/ })).toBeVisible();
  await page.getByLabel("Ask for a change").fill("Add small group sessions");
  await page.getByRole("button", { name: "Send changes" }).click();
  await expect(page.getByText("2 of 3 editing messages left")).toBeVisible();
  await expect(page.getByLabel("Ask for a change")).toHaveValue("");
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  expect(workspace.requests.filter((data) => data.action === "message")).toHaveLength(1);
});

test("existing private links without a checkout brief have a compact setup", async ({ page }) => {
  await mockWorkspace(page, { used: 0, remaining: 3, limit: 3, pending: false, projects: {}, overviewUsed: [] });
  await page.goto(trialUrl);
  await page.getByLabel("Project name").fill(brief.name);
  await page.getByLabel("Project description").fill(brief.idea);
  await page.getByRole("button", { name: "Save idea", exact: true }).click();
  await page.getByLabel("Allow OpenAI to use my brief").check();
  await page.getByRole("button", { name: "Create free overview" }).click();
  await expect(page.getByRole("list", { name: /Features for/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "BoulderMe", exact: true })).toBeVisible();
});

test("exhausted code stays at checkout and does not create a dashboard", async ({ page }) => {
  await page.route("**/api/templates/config/**", (route) => route.fulfill({ json: { available: false, testMode: false } }));
  await page.route("**/api/templates/trial/**", (route) => route.fulfill({ status: 410, json: { error: "This trial code has reached its 50-use limit." } }));
  await page.goto("/templates/");
  await page.getByRole("button", { name: "Have a free-trial code?" }).click();
  await page.getByLabel("Free-trial code", { exact: true }).fill("USED-CODE");
  await page.getByLabel("Template", { exact: true }).selectOption("mobile-app");
  await page.getByLabel("What do you want to make?").fill(brief.idea);
  await page.getByLabel("Use OpenAI to create my plan").check();
  await page.getByRole("button", { name: "Start free trial" }).click();
  await expect(page.locator("#free-trial").getByRole("alert")).toContainText("50-use limit");
  await expect(page).toHaveURL(/\/templates\/$/);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test("reopening a pending overview polls the saved result without starting another generation", async ({ page }) => {
  let loads = 0, generations = 0, ready = false;
  await page.route("**/api/templates/trial/**", (route) => route.fulfill({ json: { templateId: "mobile-app", messageLimit: 3 } }));
  await page.route("**/api/templates/ai/**", (route) => {
    const data = route.request().postDataJSON();
    if (data.action !== "load") generations++;
    loads++;
    const state: AiSnapshot = { ...fresh(), pending: !ready, canStartOverview: false };
    if (ready) {
      state.overviewUsed = ["mobile-app"];
      state.projects["mobile-app"] = { brief, plan, revision: 1, appliedRevision: null, appliedPlan: null, appliedBrief: null, history: [{ role: "assistant", text: "Your plan is ready." }] };
    }
    return route.fulfill({ json: { available: true, state } });
  });
  await page.goto(trialUrl);
  await expect(page.getByRole("heading", { name: "Turning your idea into a plan" })).toBeVisible();
  ready = true;
  await expect(page.getByRole("list", { name: /Features for/ })).toBeVisible();
  expect(loads).toBeGreaterThan(1);
  expect(generations).toBe(0);
  await expect(page.getByText("3 of 3 editing messages left")).toBeVisible();
});

test("mobile overview failure remains visible on the plan tab", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockWorkspace(page, fresh(), true);
  await page.goto(trialUrl);
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create free overview" })).toBeEnabled();
  await page.getByRole("button", { name: "Create free overview" }).click();
  await expect(page.getByRole("list", { name: /Features for/ })).toBeVisible();
  await page.getByRole("button", { name: "AI chat" }).click();
  await expect(page.getByLabel("Ask for a change")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Make it yours" })).toBeInViewport();
  await page.getByLabel("Ask for a change").scrollIntoViewIfNeeded();
  const composer = await page.getByLabel("Ask for a change").boundingBox();
  expect(composer!.y + composer!.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: "/tmp/runit-dashboard-mobile-composer.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
