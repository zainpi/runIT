import { test, expect } from "@playwright/test";
test("manage environment URLs and associated tester accounts", async ({
  page,
}) => {
  await page.goto("/neutronium/");
  await expect(
    page.getByRole("heading", { name: "Welcome back, Jamie" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Test environments", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Add environment", exact: true })
    .click();
  await page
    .getByLabel("Environment name", { exact: true })
    .fill("Portal staging");
  await page
    .getByLabel("Environment URL", { exact: true })
    .fill("https://staging.example.com");
  await page
    .getByRole("button", { name: "Save environment", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "https://staging.example.com/ ↗" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add tester account to Portal staging" })
    .click();
  await page.getByLabel("Account label", { exact: true }).fill("QA admin");
  await page
    .getByLabel("Username or email", { exact: true })
    .fill("qa@example.com");
  await page
    .getByLabel("Assigned tester", { exact: true })
    .selectOption({ label: "Sarah Chen" });
  await page
    .getByLabel("Password manager link", { exact: true })
    .fill("https://vault.example.com/item/1");
  await page
    .getByRole("button", { name: "Save tester account", exact: true })
    .click();
  await expect(page.getByText("qa@example.com", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Edit QA admin", exact: true })
    .click();
  await page
    .getByLabel("Account status", { exact: true })
    .selectOption("archived");
  await page
    .getByRole("button", { name: "Save tester account", exact: true })
    .click();
  await expect(page.getByText("qa@example.com", { exact: true })).toHaveCount(
    0,
  );
  await page.getByLabel("Show archived environments and accounts").check();
  await expect(page.getByText("qa@example.com", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Edit QA admin", exact: true })
    .click();
  await page
    .getByLabel("Account status", { exact: true })
    .selectOption("active");
  await page
    .getByRole("button", { name: "Save tester account", exact: true })
    .click();
  await expect(page.getByRole("heading", {name: "Edit tester account", exact: true})).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("qa@example.com", { exact: true })).toBeVisible();
  await page.screenshot({
    path: ".neutronium-dev/test-environments.png",
    fullPage: true,
  });
  await page
    .getByLabel("Search environments and tester accounts")
    .fill("missing");
  await expect(
    page.getByRole("heading", { name: "No environments found" }),
  ).toBeVisible();
  await page.getByLabel("Search environments and tester accounts").fill("");
  await page
    .getByRole("button", { name: "Edit Portal staging", exact: true })
    .click();
  await page
    .getByLabel("Environment status", { exact: true })
    .selectOption("archived");
  await page
    .getByRole("button", { name: "Save environment", exact: true })
    .click();
  await page.getByLabel("Show archived environments and accounts").check();
  await expect(
    page.getByRole("button", { name: "Add tester account to Portal staging" }),
  ).toBeDisabled();
  const persona = page.getByLabel("Development persona");
  await persona.selectOption({ label: "Sarah Chen · Employee" });
  await expect(persona).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Test environments", exact: true }),
  ).toHaveCount(0);
});
