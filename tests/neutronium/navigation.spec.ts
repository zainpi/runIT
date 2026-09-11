import { test, expect, type Page } from "@playwright/test";
import { seed, uid, type Role } from "../../src/lib/neutronium/model";

async function fixture(page: Page, role: Role = "ORG_OWNER") {
  const w = seed();
  w.demo = false;
  const actor = {
    id: uid(),
    name: "Jamie Morgan",
    orgId: w.id,
    role,
    employeeId: ["EMPLOYEE", "MANAGER", "APPROVER"].includes(role)
      ? w.employees[0].id
      : undefined,
    demo: false,
  };
  let filters = new URLSearchParams();
  await page.route("**/neutronium/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname
      .replace(/^\/neutronium\/api\//, "")
      .replace(/\/$/, "");
    let data: unknown = {};
    if (path === "config")
      data = {
        demoAvailable: false,
        authConfigured: true,
        microsoftFeatures: {},
      };
    else if (path === "session") data = { actor };
    else if (path === "state") data = { actor, workspace: w };
    else if (path === "auth/workspaces")
      data = { workspaces: [{ id: w.id, name: w.name }] };
    else if (path === "attention")
      data = {
        pendingApplications: 1,
        applications: [],
        access: 1,
        workflows: 0,
        help: 0,
      };
    else if (path === "onboarding/applications")
      data = { applications: [], pendingCount: 0, links: [] };
    else if (path === "people/overview") {
      filters = url.searchParams;
      data = {
        total: 1,
        rows: [
          {
            id: w.employees[0].id,
            employee_id: w.employees[0].id,
            name: "Sarah Chen",
            email: "sarah@acme.example",
            kind: "employee",
            department: "Engineering",
            status: "active",
            start_date: "2026-09-01",
          },
        ],
      };
    }
    await route.fulfill({ json: data });
  });
  return { w, filters: () => filters };
}

const sidebar = (page: Page) =>
  page.getByRole("navigation", { name: "Workspace navigation" });

test("five admin sections retain every existing destination in the tool finder", async ({
  page,
}) => {
  await fixture(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/neutronium/");
  await expect(sidebar(page).getByRole("button")).toHaveText([
    /Home/,
    /People/,
    /Requests/,
    /Apps/,
    /Settings/,
  ]);
  await expect(
    page.getByRole("heading", { name: "What would you like to do?" }),
  ).toBeVisible();
  await page.screenshot({
    path: ".neutronium-dev/ux-simplified-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /Find a tool/ }).click();
  const finder = page.getByRole("dialog", { name: "Find a tool" });
  for (const name of [
    "Home",
    "People",
    "Workflows",
    "Employee approvals",
    "Access requests",
    "Employee help",
    "Applications",
    "Permissions",
    "Integrations",
    "Account risk",
    "Role templates",
    "Migration & import",
    "Settings",
    "Test environments",
    "Audit log",
    "My profile",
    "Notifications",
  ])
    await expect(
      finder.locator("strong", {
        hasText: new RegExp(`^${name}$`),
      }),
    ).toHaveCount(1);
  await finder.getByRole("searchbox").fill("import");
  await finder.getByRole("searchbox").press("Enter");
  await expect(finder).not.toBeVisible();
  await expect(page).toHaveURL(/view=import/);
  await expect(
    sidebar(page).getByRole("button", { name: "People", exact: true }),
  ).toHaveAttribute("aria-current", "true");
  await expect(
    page
      .getByRole("navigation", { name: "People pages" })
      .getByRole("button", { name: "Import employees" }),
  ).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Control+k");
  await expect(finder).toBeVisible();
  await finder.getByRole("searchbox").fill("nothing-matches-this");
  await expect(finder.getByRole("status")).toContainText("No tools found");
  await page.keyboard.press("Escape");
  await expect(finder).not.toBeVisible();
  expect(errors).toEqual([]);
});

test("existing deep links select the right group and all related pages remain reachable", async ({
  page,
}) => {
  const { w } = await fixture(page);
  await page.goto(`/neutronium/?view=employee-approvals&org=${w.id}`);
  await expect(
    sidebar(page).getByRole("button", { name: "Requests", exact: true }),
  ).toHaveAttribute("aria-current", "true");
  const requests = page.getByRole("navigation", { name: "Requests pages" });
  await expect(requests.getByRole("button")).toHaveCount(3);
  await requests.getByRole("button", { name: /Access requests/ }).click();
  await expect(page).toHaveURL(new RegExp(`view=access&org=${w.id}`));
  await sidebar(page)
    .getByRole("button", { name: "People", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "People pages" })
    .getByRole("button", { name: "Role templates" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Role templates", exact: true }),
  ).toBeVisible();
  await sidebar(page)
    .getByRole("button", { name: "Settings", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Settings pages" })
    .getByRole("button", { name: "Audit log" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Audit log", exact: true }),
  ).toBeVisible();
});

test("extra People filters preserve applied values when collapsed and can be cleared", async ({
  page,
}) => {
  const f = await fixture(page);
  await page.goto("/neutronium/?view=people");
  await expect(page.getByLabel("Search people", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Department / team", exact: true }),
  ).not.toBeVisible();
  await page.getByText("More filters", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "Department / team", exact: true })
    .selectOption("Engineering");
  await page.getByLabel("Start date from", { exact: true }).fill("2026-09-01");
  await expect.poll(() => f.filters().get("startFrom")).toBe("2026-09-01");
  await page.locator(".nt-more-filters > summary").click();
  await expect(page.locator(".nt-more-filters > summary")).toContainText(
    "2 active",
  );
  expect(f.filters().get("department")).toBe("Engineering");
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect.poll(() => f.filters().get("department")).toBe("");
  await expect.poll(() => f.filters().get("startFrom")).toBe("");
  await page.screenshot({
    path: ".neutronium-dev/ux-simplified-people.png",
    fullPage: true,
  });
});

test("employees and managers keep personal apps and approvals without admin navigation", async ({
  page,
}) => {
  await fixture(page, "MANAGER");
  await page.goto("/neutronium/");
  await expect(sidebar(page).getByRole("button")).toHaveCount(4);
  await sidebar(page).getByRole("button", { name: "My apps" }).click();
  await page
    .getByRole("navigation", { name: "My apps pages" })
    .getByRole("button", { name: "My access" })
    .click();
  await expect(page).toHaveURL(/view=myaccess/);
  await sidebar(page)
    .getByRole("button", { name: "Requests", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Requests pages" })
    .getByRole("button", { name: /Access requests/ })
    .click();
  await expect(page).toHaveURL(/view=access/);
  await page.getByRole("button", { name: /Find a tool/ }).click();
  await expect(
    page.getByRole("dialog").locator("strong", {
      hasText: /^(Settings|Account risk|Employee approvals|Integrations)$/,
    }),
  ).toHaveCount(0);
});

test("mobile menu, section pages, and keyboard dismissal work without horizontal overflow", async ({
  page,
}) => {
  await fixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/neutronium/");
  await expect(
    page.getByRole("heading", { name: "Welcome back, Jamie" }),
  ).toBeVisible();
  await expect(sidebar(page)).not.toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Find a tool" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Find a tool" }),
  ).not.toBeVisible();
  await page.screenshot({
    path: ".neutronium-dev/ux-simplified-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(sidebar(page)).toBeVisible();
  await expect(page.locator(".nt-sidebar")).toHaveCSS(
    "transform",
    "matrix(1, 0, 0, 1, 0, 0)",
  );
  await page.screenshot({
    path: ".neutronium-dev/ux-simplified-mobile-menu.png",
  });
  await page.keyboard.press("Escape");
  await expect(sidebar(page)).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await sidebar(page)
    .getByRole("button", { name: "People", exact: true })
    .click();
  await expect(sidebar(page)).not.toBeVisible();
  await page
    .getByRole("navigation", { name: "People pages" })
    .getByRole("button", { name: "Workflows" })
    .click();
  await expect(page).toHaveURL(/view=onboarding/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
