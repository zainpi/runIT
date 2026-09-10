import { test, expect } from "@playwright/test";
test("company → onboard → employee → request → manager → revoke → offboard", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/neutronium/");
  await expect(
    page.getByRole("heading", { name: "Welcome back, Jamie" }),
  ).toBeVisible();
  await page.screenshot({
    path: ".neutronium-dev/neutronium-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Onboard employee", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Enter details manually", exact: true })
    .click();
  await page.getByLabel("First name", { exact: true }).fill("Sam");
  await page.getByLabel("Last name", { exact: true }).fill("Lee");
  await page
    .getByLabel("Company email", { exact: true })
    .fill(`sam-${Date.now()}@acme.example`);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Start onboarding" }).click();
  await expect(
    page.getByRole("heading", { name: "Workflows", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".nt-job-row").first().getByText("success", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await page
    .getByLabel("Development persona")
    .selectOption({ label: "Sam Lee · Employee" });
  await expect(page.getByRole("heading", { name: "Hi, Sam" })).toBeVisible();
  await page
    .getByRole("button", { name: "Request access", exact: true })
    .first()
    .click();
  const requestDialog = page.getByRole("dialog");
  await requestDialog
    .getByLabel("Application", { exact: true })
    .selectOption({ label: "GitHub" });
  await requestDialog.getByLabel("Permission level").selectOption("Admin");
  await requestDialog.getByLabel("Duration").selectOption("1");
  await requestDialog
    .getByLabel("Why do you need access?")
    .fill("Verify the one-minute temporary access flow.");
  await requestDialog.getByRole("button", { name: "Submit request" }).click();
  await page
    .getByLabel("Development persona")
    .selectOption({ label: "Michael Ross · Manager" });
  await page.getByRole("button", { name: /Access requests/ }).click();
  await page
    .locator(".nt-request")
    .filter({ hasText: "Sam Lee" })
    .getByRole("button", { name: "Review request" })
    .click();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page
    .getByLabel("Development persona")
    .selectOption({ label: "Sam Lee · Employee" });
  await page.getByRole("button", { name: "My access", exact: true }).click();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Admin" })
      .getByText("active", { exact: true }),
  ).toBeVisible({ timeout: 20000 });
  // Drive the expiry timestamp through the local persistent store in a separate security-tested worker.
  const session = await page.request.get("/neutronium/api/session/");
  const actor = (await session.json()).actor;
  const fs = await import("node:fs/promises");
  const filename = `.neutronium-dev/${actor.orgId}.json`;
  const state = JSON.parse(await fs.readFile(filename, "utf8"));
  const grant = state.grants.find(
    (g: any) => g.employeeId === actor.employeeId && g.level === "Admin",
  );
  grant.expiresAt = new Date(Date.now() - 1000).toISOString();
  await fs.writeFile(filename, JSON.stringify(state));
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Admin" })
      .getByText("revoked", { exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await page
    .getByLabel("Development persona")
    .selectOption({ label: "Company admin" });
  await page
    .getByRole("button", { name: "Handle a departure", exact: false })
    .click();
  const offboard = page.getByRole("dialog");
  await offboard.getByLabel("Employee", { exact: true }).selectOption({
    label: `Sam Lee — ${state.employees.find((e: any) => e.id === actor.employeeId).email}`,
  });
  await offboard
    .getByLabel(/Type .* to confirm/)
    .fill(state.employees.find((e: any) => e.id === actor.employeeId).email);
  await offboard.getByRole("button", { name: "Confirm offboarding" }).click();
  await expect(
    page.locator(".nt-job-row").first().getByText("success", { exact: true }),
  ).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "Audit log", exact: true }).click();
  await expect(
    page.getByRole("cell", {
      name: "offboard workflow completed",
      exact: false,
    }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("mobile layout and keyboard dialog navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/neutronium/");
  await expect(
    page.getByRole("heading", { name: "Welcome back, Jamie" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: ".neutronium-dev/neutronium-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "People", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "People", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Onboard employee", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("API rejects CSRF, tenant switching and forged employee writes", async ({
  page,
}) => {
  await page.goto("/neutronium/");
  await expect(
    page.getByRole("heading", { name: "Welcome back, Jamie" }),
  ).toBeVisible();
  const csrf = await page.request.post("/neutronium/api/settings/", {
    data: { name: "Bad" },
  });
  expect(csrf.status()).toBe(403);
  const origin = "http://127.0.0.1:3010";
  const session = await page.request.get("/neutronium/api/session/");
  const actor = (await session.json()).actor;
  const cross = await page.request.get(
    "/neutronium/api/state/?org=00000000-0000-0000-0000-000000000000",
  );
  expect(cross.status()).toBe(404);
  await page.request.post("/neutronium/api/persona/", {
    headers: { origin },
    data: { persona: "employee" },
  });
  const forbidden = await page.request.post("/neutronium/api/onboard/", {
    headers: { origin },
    data: { orgId: actor.orgId },
  });
  expect(forbidden.status()).toBe(403);
});
