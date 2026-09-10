import { test, expect } from "@playwright/test";
test("employee help, admin file response, isolation, risk simulation and export", async ({
  page,
}) => {
  await page.goto("/neutronium/");
  await expect(
    page.getByRole("heading", { name: "Welcome back, Jamie" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "People", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Create test employee", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Test employee created");
  const persona = page.getByLabel("Development persona");
  await persona.selectOption({ label: "Sarah Chen · Employee" });
  await expect(persona).toBeEnabled();
  await page
    .getByRole("button", { name: "Employee help", exact: true })
    .first()
    .click();
  await page.getByLabel("Subject", { exact: true }).fill("New monitor");
  await page
    .getByLabel("Your request", { exact: true })
    .fill("Please send a monitor for my home office.");
  await page.getByRole("button", { name: "Send request", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "New monitor", exact: true }),
  ).toBeVisible();
  await persona.selectOption("admin");
  await expect(persona).toBeEnabled();
  await page
    .getByRole("button", { name: "Employee help", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "New monitor", exact: true }).click();
  await page
    .getByLabel("Reply", { exact: true })
    .fill("Your order is attached.");
  await page.getByLabel("Attach a file (up to 50 KB)").setInputFiles({
    name: "order.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Order 123"),
  });

  await page
    .getByRole("button", { name: "Send response", exact: true })
    .click();
  await expect(
    page.getByText("Your order is attached.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: ".neutronium-dev/help-inbox.png",
    fullPage: true,
  });
  await persona.selectOption({ label: "Alex Patel · Employee" });
  await expect(persona).toBeEnabled();
  await page
    .getByRole("button", { name: "Employee help", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "New monitor", exact: true }),
  ).toHaveCount(0);
  await persona.selectOption({ label: "Sarah Chen · Employee" });
  await expect(persona).toBeEnabled();
  await page
    .getByRole("button", { name: "Employee help", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "New monitor", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download order.txt" }).click();
  expect((await download).suggestedFilename()).toBe("order.txt");
  await persona.selectOption("admin");
  await expect(persona).toBeEnabled();
  await page
    .getByRole("button", { name: "Account risk", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Simulate compromised account" })
    .click();
  await expect(
    page.getByText("Simulated compromised account — test data"),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "People", exact: true })
    .first()
    .click();
  const csv = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export employee CSV" }).click();
  expect((await csv).suggestedFilename()).toBe("employees.csv");
});
