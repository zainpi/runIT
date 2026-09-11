import { test, expect, type Page } from "@playwright/test";
import { seed, uid } from "../../src/lib/neutronium/model";
import { applicationPath } from "../../src/lib/neutronium/intake";

async function fixture(
  page: Page,
  role = "ORG_OWNER",
  initiallySignedIn = true,
) {
  const w = seed();
  w.demo = false;
  w.name = "Review Studio";
  const app = {
    id: uid(),
    organization_id: w.id,
    user_id: uid(),
    email: "sam@example.com",
    revision: 0,
    status: "pending",
    submitted_at: new Date().toISOString(),
    decision_note: "",
    details: {
      firstName: "Sam",
      lastName: "Lee",
      title: "Developer",
      location: "Toronto",
      department: "Engineering",
      startDate: "2026-10-01",
      employmentType: "Full-time",
      workArrangement: "Hybrid",
      note: "Please review",
    },
  };
  const actor = {
    id: uid(),
    name: "Administrator",
    orgId: w.id,
    role,
    demo: false,
  };
  let signedIn = initiallySignedIn;
  let logouts = 0;
  let lastFilters: URLSearchParams | undefined;
  let ownEdited = false;
  const token = "Z".repeat(43);
  await page.route("**/neutronium/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname
      .replace(/^\/neutronium\/api\//, "")
      .replace(/\/$/, "");
    const body =
      route.request().method() === "POST" ? route.request().postDataJSON() : {};
    let data: any = {},
      status = 200;
    if (path === "config")
      data = {
        demoAvailable: false,
        authConfigured: true,
        socialProviders: [],
      };
    else if (path === "auth/status")
      data = {
        user: signedIn
          ? {
              id: actor.id,
              email: "admin@example.com",
              signup_role: "admin",
              mfa_verified_at: new Date().toISOString(),
            }
          : null,
      };
    else if (path === "login") {
      signedIn = true;
      data = { confirmationRequired: false };
    } else if (path === "session" || path === "state") {
      data = signedIn
        ? path === "session"
          ? { actor }
          : { workspace: w, actor }
        : { error: "Sign in" };
      status = signedIn ? 200 : 401;
    } else if (path === "auth/workspaces")
      data = { workspaces: [{ id: w.id, name: w.name }] };
    else if (path === "onboarding/applications")
      data = {
        applications: [app],
        pendingCount: 1,
        links: [],
        nextCursor: null,
      };
    else if (path === "onboarding/update") {
      expect(body.revision).toBe(app.revision);
      app.revision++;
      app.status = body.status;
      app.details.firstName = body.firstName;
      data = { application: app };
    } else if (path === "attention")
      data = {
        pendingApplications: 1,
        applications: [app],
        access: 2,
        workflows: 1,
        help: 3,
      };
    else if (path === "people/overview") {
      lastFilters = url.searchParams;
      const matching =
        !url.searchParams.get("q") ||
        "Sam Lee sam@example.com"
          .toLowerCase()
          .includes(url.searchParams.get("q")!.toLowerCase());
      data = {
        total: matching ? 1 : 0,
        rows: matching
          ? [
              {
                id: app.id,
                kind: "application",
                name: "Sam Lee",
                email: app.email,
                department: "Engineering",
                start_date: "2026-10-01",
                title: "Developer",
                location: "Toronto",
                status: app.status,
                application_id: app.id,
              },
            ]
          : [],
      };
    } else if (path === "onboarding/invitation")
      data = {
        available: false,
        companyName: w.name,
        application: app,
        options: {
          titles: ["Developer", "Designer"],
          departments: ["Engineering", "Operations"],
          locations: ["Toronto", "Vancouver"],
        },
      };
    else if (path === "onboarding/edit-own") {
      expect(body.id).toBe(app.id);
      expect(body.revision).toBe(app.revision);
      app.details = { ...app.details, ...body };
      app.revision++;
      ownEdited = true;
      data = { application: app };
    } else if (path === "auth/mfa")
      data = { enabled: false, required: false, verified: true };
    else if (path === "auth/sessions")
      data = {
        sessions: [
          { id: uid(), current: true, created_at: new Date().toISOString() },
        ],
      };
    else if (path === "logout") {
      logouts++;
      signedIn = false;
      data = { ok: true };
    } else if (path === "auth/resend-confirmation") data = { ok: true };
    else {
      data = { error: `Unexpected ${path}` };
      status = 404;
    }
    await route.fulfill({ status, json: data });
  });
  return {
    w,
    app,
    token,
    logouts: () => logouts,
    filters: () => lastFilters,
    ownEdited: () => ownEdited,
  };
}
test("application email survives sign-in and opens the exact employee request", async ({
  page,
}) => {
  const f = await fixture(page, "ORG_OWNER", false);
  await page.goto(applicationPath(f.w.id, f.app.id));
  await page.getByLabel("Work email").fill("admin@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("correct-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sam Lee", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Accept and start onboarding" }),
  ).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`application=${f.app.id}`));
  await page.screenshot({
    path: ".neutronium-dev/review-application-desktop.png",
    fullPage: true,
  });
});
test("admin menus open profile; own session uses sign out; overview surfaces multiple attention categories", async ({
  page,
}) => {
  const f = await fixture(page);
  await page.goto("/neutronium/");
  for (const name of [
    "Employee applications",
    "Access requests",
    "Workflows needing action",
    "Employee help",
  ])
    await expect(
      page
        .locator(".nt-attention-list")
        .getByRole("button", { name: new RegExp(name) }),
    ).toBeVisible();
  await expect(
    page.locator(".nt-attention-list").getByRole("link", { name: /Sam Lee/ }),
  ).toHaveAttribute("href", /application=/);
  await page.getByLabel("Open workspace menu").click();
  await page
    .locator(".nt-workspace-menu-items")
    .getByRole("button", { name: "My profile", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your account", exact: true }),
  ).toBeVisible();
  const security = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Account security", exact: true }),
  });
  await expect(
    security.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
  await expect(
    security.getByRole("button", { name: "Revoke session" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: ".neutronium-dev/review-profile-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByRole("button", { name: "Open my profile" }).click();
  await expect(
    page.getByRole("heading", { name: "Your account", exact: true }),
  ).toBeVisible();
  await security.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect.poll(f.logouts).toBe(1);
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
});
test("HR can edit review stages without approval controls and People filters reach the server", async ({
  page,
}) => {
  const f = await fixture(page, "HR_ADMIN");
  await page.goto(applicationPath(f.w.id, f.app.id));
  await expect(
    page.getByRole("button", { name: "Accept and start onboarding" }),
  ).toHaveCount(0);
  await page.getByLabel("First name", { exact: true }).fill("Samuel");
  await page
    .getByRole("combobox", { name: "Review status", exact: true })
    .selectOption("in_review");
  await page
    .getByRole("button", { name: "Save application", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Samuel Lee", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "People", exact: true }).click();
  await page
    .getByLabel("Search people", { exact: true })
    .fill("sam@example.com");
  await page.getByText("More filters", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "Department / team", exact: true })
    .selectOption("Engineering");
  await page.getByLabel("Start date from", { exact: true }).fill("2026-09-01");
  await expect.poll(() => f.filters()?.get("startFrom")).toBe("2026-09-01");
  expect(f.filters()?.get("q")).toBe("sam@example.com");
  expect(f.filters()?.get("department")).toBe("Engineering");
  await expect(
    page.getByRole("link", { name: "View application" }),
  ).toHaveAttribute("href", applicationPath(f.w.id, f.app.id));
  await page.screenshot({
    path: ".neutronium-dev/review-people-desktop.png",
    fullPage: true,
  });
});
test("employee can correct a submitted application with dropdowns on mobile", async ({
  page,
}) => {
  const f = await fixture(page, "EMPLOYEE");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/neutronium/join/?token=${f.token}`);
  await page
    .getByRole("button", { name: "View / edit my application" })
    .click();
  await page.getByLabel("First name", { exact: true }).fill("Samuel");
  await page
    .getByRole("combobox", { name: "Job title (optional)", exact: true })
    .selectOption("Designer");
  await page
    .getByRole("combobox", { name: "Department / team", exact: true })
    .selectOption("Operations");
  await page
    .getByRole("combobox", { name: "Employment type", exact: true })
    .selectOption("Contractor");
  await page.screenshot({
    path: ".neutronium-dev/review-intake-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Save application", exact: true })
    .click();
  await expect.poll(f.ownEdited).toBe(true);
  await expect(
    page.getByText("Application updated and returned for review."),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
