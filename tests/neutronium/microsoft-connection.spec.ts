import { test, expect, type Page } from "@playwright/test";
import { seed, uid, type Role } from "../../src/lib/neutronium/model";

const tenant = "aabbccdd-1234-5678-9012-aabbccddeeff";
async function fixture(
  page: Page,
  options: { ready?: boolean; connected?: boolean; role?: Role } = {},
) {
  const w = seed();
  w.demo = false;
  w.applications[0].mode = "microsoft";
  const integration = w.integrations.find(
    (i) => i.provider === "Microsoft 365",
  )!;
  integration.status = options.connected ? "connected" : "disconnected";
  integration.features = options.connected ? ["groups"] : [];
  integration.tenantId = options.connected ? tenant : undefined;
  // A different provider must not be mistaken for the Microsoft connection.
  w.integrations.unshift({
    id: uid(),
    provider: "github",
    status: "connected",
    features: [],
  });
  const actor = {
    id: uid(),
    name: "Jamie Morgan",
    orgId: w.id,
    role: options.role || "ORG_OWNER",
    demo: false,
    employeeId: options.role === "EMPLOYEE" ? w.employees[0].id : undefined,
  };
  let ready = options.ready === true;
  const submissions: unknown[] = [];
  await page.route("**/neutronium/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname
      .replace(/^\/neutronium\/api\//, "")
      .replace(/\/$/, "");
    let data: unknown = {};
    if (path === "config")
      data = {
        demoAvailable: false,
        authConfigured: true,
        microsoftConfigured: ready,
        microsoftFeatures: {
          inventory: {
            name: "Account inventory",
            permissions: ["User.Read.All"],
            reason: "Read company accounts.",
          },
          groups: {
            name: "Application and group access",
            permissions: ["GroupMember.ReadWrite.All"],
            reason: "Manage group access.",
          },
        },
      };
    else if (path === "session") data = { actor };
    else if (path === "state") data = { actor, workspace: w };
    else if (path === "auth/workspaces")
      data = { workspaces: [{ id: w.id, name: w.name }] };
    else if (path === "microsoft/connect") {
      submissions.push(route.request().postDataJSON());
      await route.fulfill({
        status: 503,
        json: {
          error:
            "Microsoft 365 connection needs server setup. Ask the Neutronium operator to configure the application credentials.",
        },
      });
      return;
    }
    await route.fulfill({ json: data });
  });
  return {
    setReady: (value: boolean) => {
      ready = value;
    },
    submissions,
  };
}

test("Apps opens tenant setup and rechecks server readiness without losing input", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto("/neutronium/?view=applications");
  await page
    .getByRole("button", { name: "Connect Microsoft 365", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Connect Microsoft 365" });
  await expect(
    dialog.getByText("Microsoft 365 connection needs server setup", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Continue to Microsoft" }),
  ).toBeDisabled();
  await dialog.getByLabel("Microsoft tenant ID").fill(tenant);
  await dialog.getByLabel("Microsoft tenant ID").press("Enter");
  expect(state.submissions).toHaveLength(0);
  await dialog.getByRole("button", { name: "Check setup again" }).click();
  await expect(dialog.getByRole("status")).toContainText("still incomplete");
  state.setReady(true);
  await dialog.getByRole("button", { name: "Check setup again" }).click();
  await expect(dialog.getByRole("status")).toContainText(
    "Server setup is ready",
  );
  await expect(dialog.getByLabel("Microsoft tenant ID")).toHaveValue(tenant);
  await dialog.getByRole("button", { name: "Continue to Microsoft" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Neutronium operator");
  expect(state.submissions).toEqual([
    { tenantId: tenant, features: ["inventory"] },
  ]);
  await expect(dialog.getByLabel("Microsoft tenant ID")).toHaveValue(tenant);
  await expect(
    dialog.getByRole("button", { name: "Continue to Microsoft" }),
  ).toBeEnabled();
});

test("application settings and Integrations share the tenant setup form", async ({
  page,
}) => {
  await fixture(page, { ready: true });
  await page.goto("/neutronium/?view=applications");
  const card = page
    .locator(".nt-app-card")
    .filter({
      has: page.getByRole("heading", { name: "Microsoft 365", exact: true }),
    });
  await card.getByRole("button", { name: "Manage application" }).click();
  await page
    .getByRole("button", { name: "Set up Microsoft tenant connection" })
    .click();
  await expect(page.getByLabel("Microsoft tenant ID")).toBeVisible();
  await page.goto("/neutronium/?view=integrations");
  await page
    .getByRole("button", { name: "Connect Microsoft 365", exact: true })
    .click();
  await expect(page.getByLabel("Microsoft tenant ID")).toBeVisible();
  await page.getByLabel("Microsoft tenant ID").fill(tenant);
  await page.getByLabel("Account inventory").uncheck();
  await page.getByRole("button", { name: "Continue to Microsoft" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Select at least one",
  );
});

test("existing Microsoft connections prefill the correct tenant and features", async ({
  page,
}) => {
  await fixture(page, { ready: true, connected: true });
  await page.goto("/neutronium/?view=applications");
  await page
    .getByRole("button", { name: "Manage Microsoft connection" })
    .click();
  await expect(page.getByLabel("Microsoft tenant ID")).toHaveValue(tenant);
  await expect(page.getByLabel("Application and group access")).toBeChecked();
  await expect(page.getByLabel("Account inventory")).not.toBeChecked();
});

test("ready setup continues to the Microsoft consent URL", async ({ page }) => {
  await fixture(page, { ready: true });
  const consentUrl = `https://login.microsoftonline.com/${tenant}/v2.0/adminconsent?state=synthetic`;
  await page.route("**/neutronium/api/microsoft/connect", (route) =>
    route.fulfill({ json: { url: consentUrl } }),
  );
  await page.route("https://login.microsoftonline.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<h1>Mock Microsoft consent</h1>",
    }),
  );
  await page.goto("/neutronium/?view=applications");
  await page
    .getByRole("button", { name: "Connect Microsoft 365", exact: true })
    .click();
  await page.getByLabel("Microsoft tenant ID").fill(tenant);
  await page.getByRole("button", { name: "Continue to Microsoft" }).click();
  await expect(page).toHaveURL(consentUrl);
});

for (const role of ["HR_ADMIN", "EMPLOYEE"] as const) {
  test(`${role} cannot open Microsoft tenant administration from Apps`, async ({
    page,
  }) => {
    await fixture(page, { ready: true, role });
    await page.goto(
      `/neutronium/?view=${role === "EMPLOYEE" ? "apps" : "applications"}`,
    );
    await expect(
      page.getByRole("heading", {
        name: role === "EMPLOYEE" ? "My applications" : "Applications",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Connect Microsoft 365", exact: true }),
    ).toHaveCount(0);
  });
}

test("mobile setup stays within the viewport and can be dismissed", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page);
  await page.goto("/neutronium/?view=applications");
  await page
    .getByRole("button", { name: "Connect Microsoft 365", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Connect Microsoft 365" });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: ".neutronium-dev/microsoft-setup-mobile.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});
