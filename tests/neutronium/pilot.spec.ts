import { test, expect } from "@playwright/test";
test("equipment checklist, completion evidence and private note in the service inbox", async ({
  page,
}) => {
  await page.goto("/neutronium/");
  await expect(
    page.getByRole("heading", { name: "Welcome back, Jamie" }),
  ).toBeVisible();
  const persona = page.getByLabel("Development persona");
  await persona.selectOption({ label: "Sarah Chen · Employee" });
  await page
    .getByRole("button", { name: "Get help", exact: true })
    .first()
    .click();
  await page
    .getByRole("combobox", { name: "Request type", exact: true })
    .selectOption("equipment");
  await page.getByLabel("Subject", { exact: true }).fill("Pilot monitor");
  await page
    .getByLabel("Your request", { exact: true })
    .fill("Deliver a monitor to the office.");
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pilot monitor", exact: true }),
  ).toBeVisible();
  await persona.selectOption("admin");
  await page
    .getByRole("navigation", { name: "Workspace navigation" })
    .getByRole("button", { name: "Requests", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Employee help", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Pilot monitor", exact: true })
    .click();
  await page
    .getByLabel("Reply", { exact: true })
    .fill("Internal purchasing reference 7781");
  await page.getByLabel("Internal admin note").check();
  await page
    .getByRole("button", { name: "Send response", exact: true })
    .click();
  const task = page.locator("details").filter({
    has: page.getByText("Arrange delivery or return · Required", {
      exact: true,
    }),
  });
  await task.locator("summary").click();
  await task.getByLabel("Provider / service").fill("Office IT");
  await task
    .getByLabel("Target account, item or document")
    .fill("Monitor serial TEST-123");
  await task
    .getByLabel("Verification method")
    .fill("Employee collected at reception");
  await task
    .getByLabel("Evidence", { exact: true })
    .fill("Signed collection receipt held by IT.");
  await task.getByRole("button", { name: "Confirm task completed" }).click();
  const manage = page
    .locator("details")
    .filter({ has: page.getByText("Manage fulfillment", { exact: true }) });
  await manage.locator("summary").click();
  await manage
    .getByRole("combobox", { name: "Fulfillment", exact: true })
    .selectOption("completed");
  await manage.getByLabel("Provider / service").fill("Office IT");
  await manage.getByLabel("Target", { exact: true }).fill("Monitor TEST-123");
  await manage.getByLabel("Verification method").fill("Collection receipt");
  await manage
    .getByLabel("Evidence", { exact: true })
    .fill("Required delivery task completed.");
  await manage.getByRole("button", { name: "Save fulfillment" }).click();
  await expect(
    page.getByText("Approval: not required · Fulfillment: completed"),
  ).toBeVisible();
  await persona.selectOption({ label: "Sarah Chen · Employee" });
  await page
    .getByRole("button", { name: "Get help", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Pilot monitor", exact: true })
    .click();
  await expect(
    page.getByText("Internal purchasing reference 7781"),
  ).toHaveCount(0);
  await expect(
    page.getByText("Approval: not required · Fulfillment: completed"),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(async () =>
      page
        .locator(".nt-sidebar")
        .evaluate((el) => el.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".neutronium-dev/pilot-mobile.png",
    fullPage: true,
  });
});
