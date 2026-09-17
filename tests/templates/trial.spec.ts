import { expect, test } from "@playwright/test";
import type { AiSnapshot } from "../../src/lib/templates/ai-contract";

const token = "ab".repeat(32), sessionId = `trial_${"1".repeat(64)}`;
const brief = { name: "BoulderMe", idea: "Find climbers at the same gym with similar skills", features: "iOS", style: "cozy, fun", budget: "" };
const plan = { overview: "Meet a climbing partner at your gym.", features: [{ part: "Find climbers", description: "Find people with similar skills." }, { part: "Guest passes", description: "Show whether you can offer a pass." }], assumptions: ["Memberships are self-reported."], questions: [] };

test("trial code entry selects a template, retries safely and opens a private link", async ({ page }) => {
  const requests: Record<string, unknown>[] = [];
  await page.route("**/api/templates/config/**", (route) => route.fulfill({ json: { available: true, testMode: true, currency: "usd" } }));
  await page.route("**/api/templates/trial/**", async (route) => {
    const data = route.request().postDataJSON();
    if (data.action === "load") return route.fulfill({ json: { templateId: "mobile-app", messageLimit: 3 } });
    requests.push(data);
    if (requests.length === 1) return route.abort("failed");
    return route.fulfill({ json: { sessionId, templateId: "mobile-app", messageLimit: 3 } });
  });
  await page.route("**/api/templates/ai/**", (route) => route.fulfill({ json: { available: true, state: { used: 0, remaining: 3, limit: 3, pending: false, projects: {}, overviewUsed: [] } } }));
  await page.goto("/templates/");
  await page.getByRole("button", { name: "Add Mobile app", exact: true }).click();
  await page.getByLabel("Free-trial code", { exact: true }).fill("sample-code");
  await expect(page.locator("#free-trial")).toContainText("Try Mobile app");
  await page.locator("#free-trial").screenshot({ path: "/tmp/runit-template-trial-code.png" });
  await page.getByRole("button", { name: "Redeem free trial" }).click();
  await expect(page.locator("#free-trial").getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Redeem free trial" }).click();
  await expect(page).toHaveURL(new RegExp(`/templates/trial/#session_id=${sessionId}&access=[a-f0-9]{64}`));
  expect(requests).toHaveLength(2);
  expect(requests[1].accessToken).toBe(requests[0].accessToken);
  expect(requests[1].code).toBe("SAMPLE-CODE");
  expect(requests[1].templateId).toBe("mobile-app");
  await expect(page.getByLabel("Your private trial URL")).toHaveValue(new RegExp(sessionId));
  await expect(page.getByText("3 of 3 messages left")).toBeVisible();
});

test("trial overview and three edits preserve plan access without unlocking paid downloads", async ({ page }) => {
  let state: AiSnapshot = { used: 0, remaining: 3, limit: 3, pending: false, projects: {}, overviewUsed: [] };
  await page.route("**/api/templates/trial/**", (route) => route.fulfill({ json: { templateId: "mobile-app", messageLimit: 3 } }));
  await page.route("**/api/templates/ai/**", async (route) => {
    const data = route.request().postDataJSON();
    if (data.action === "overview" || data.action === "message") {
      if (data.action === "message") { state.used++; state.remaining--; }
      state.overviewUsed = ["mobile-app"];
      state.projects["mobile-app"] = { brief: data.brief, plan, revision: (state.projects["mobile-app"]?.revision ?? 0) + 1, appliedRevision: null, appliedPlan: null, appliedBrief: null, history: [...(state.projects["mobile-app"]?.history ?? []), ...(data.action === "message" ? [{ role: "user" as const, text: data.message }] : []), { role: "assistant", text: "Your updated plan is ready." }] };
    }
    if (data.action === "clear") state = { ...state, projects: {} };
    return route.fulfill({ json: { available: true, state } });
  });
  await page.goto(`/templates/trial/#session_id=${sessionId}&access=${token}`);
  await expect(page.getByRole("button", { name: "Refresh conversation" })).toBeEnabled();
  await page.getByLabel("App name").fill(brief.name);
  await page.getByLabel("What do you want to make?").fill(brief.idea);
  await page.getByLabel("Send my brief and messages to OpenAI").check();
  await page.getByRole("button", { name: "Create my free overview" }).click();
  await expect(page.getByRole("table")).toContainText("Guest passes");
  await expect(page.getByText("3 of 3 messages left")).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply plan to my prompt" })).toHaveCount(0);
  await expect(page.locator("#full-prompt")).toHaveCount(0);
  for (let i = 0; i < 3; i++) {
    await page.getByLabel("What would you like to change?").fill("Simplify the first version");
    await page.getByRole("button", { name: "Send message", exact: true }).click();
    await expect(page.getByText(`${2 - i} of 3 messages left`)).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Send message", exact: true })).toBeDisabled();
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByLabel("App name")).toHaveValue("BoulderMe");
  await expect(page.getByText("0 of 3 messages left")).toBeVisible();
  await expect(page.getByRole("button", { name: "Download plan & chat" })).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("section").filter({ has: page.getByRole("heading", { name: "Shape your app with AI" }) }).screenshot({ path: "/tmp/runit-template-trial-mobile.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.getByRole("button", { name: "Delete saved AI content" }).click();
  await page.getByRole("button", { name: "Delete content for this trial" }).click();
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByText("0 of 3 messages left")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create my free overview" })).toHaveCount(0);
});

test("exhausted trial code stays on the form with a clear error", async ({ page }) => {
  await page.route("**/api/templates/config/**", (route) => route.fulfill({ json: { available: false, testMode: false } }));
  await page.route("**/api/templates/trial/**", (route) => route.fulfill({ status: 410, json: { error: "This trial code has reached its 50-use limit." } }));
  await page.goto("/templates/");
  await page.getByLabel("Free-trial code", { exact: true }).fill("USED-CODE");
  await page.getByRole("button", { name: "Redeem free trial" }).click();
  await expect(page.locator("#free-trial").getByRole("alert")).toContainText("50-use limit");
  await expect(page).toHaveURL(/\/templates\/$/);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
