import { test, expect as baseExpect, type Page, type Route } from "@playwright/test";
import { seed, uid } from "../../src/lib/neutronium/model";

test.setTimeout(240000);
const expect = baseExpect.configure({ timeout: 20000 });

function scenario(baseURL: string, existing = false) {
  const w = seed();
  w.demo = false;
  w.name = "Pilot Studio";
  const token = "J".repeat(43),
    path = `/neutronium/join/?token=${token}`;
  const actor = {
    id: uid(),
    orgId: w.id,
    name: "Jamie Morgan",
    role: "ORG_OWNER",
    demo: false,
  };
  const user = { id: uid(), email: "sam@example.com", signup_role: "employee" };
  let signedIn = existing,
    linksCreated = 0;
  let application: any = existing ? makeApplication() : null;
  function makeApplication() {
    return {
      id: uid(),
      organization_id: w.id,
      user_id: user.id,
      email: user.email,
      details: {
        firstName: "Sam",
        lastName: "Lee",
        title: "Developer",
        location: "Toronto",
        note: "Joining the web team",
      },
      status: "pending",
      submitted_at: new Date().toISOString(),
      decision_note: "",
    };
  }
  async function install(page: Page, admin: boolean) {
    await page.route("**/neutronium/api/**", async (route: Route) => {
      const url = new URL(route.request().url()),
        endpoint = url.pathname
          .replace(/^\/neutronium\/api\//, "")
          .replace(/\/$/, "");
      const body =
        route.request().method() === "POST"
          ? route.request().postDataJSON()
          : {};
      let data: any,
        status = 200;
      if (endpoint === "config")
        data = {
          demoAvailable: false,
          authConfigured: true,
          socialProviders: [],
          microsoftFeatures: {},
        };
      else if (endpoint === "auth/status")
        data = {
          user: admin
            ? {
                id: actor.id,
                signup_role: "admin",
                mfa_verified_at: new Date().toISOString(),
              }
            : signedIn
              ? user
              : null,
        };
      else if (endpoint === "session") {
        data = admin ? { actor } : { error: "Sign in" };
        status = admin ? 200 : 401;
      } else if (endpoint === "state") data = { workspace: w, actor };
      else if (endpoint === "onboarding/link") {
        expect(admin).toBe(true);
        expect(body.orgId).toBe(w.id);
        linksCreated++;
        data = {
          id: uid(),
          url: baseURL + path,
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        };
      } else if (endpoint === "onboarding/invitation") {
        expect(url.searchParams.get("token")).toBe(token);
        data = {
          companyName: w.name,
          available: !application,
          expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
          application: !admin && signedIn ? application : null,
        };
      } else if (endpoint === "signup") {
        expect(body.joinToken).toBe(token);
        expect(body.signupRole).toBe("employee");
        data = { confirmationRequired: true };
      } else if (endpoint === "login") {
        signedIn = true;
        data = { confirmationRequired: false };
      } else if (endpoint === "onboarding/apply") {
        expect(signedIn).toBe(true);
        expect(body.token).toBe(token);
        application = {
          ...makeApplication(),
          details: {
            firstName: body.firstName,
            lastName: body.lastName,
            title: body.title,
            location: body.location,
            note: body.note,
          },
        };
        data = { application };
      } else if (endpoint === "onboarding/applications") {
        expect(admin).toBe(true);
        expect(url.searchParams.get("org")).toBe(w.id);
        data = {
          applications:
            application &&
            application.status === (url.searchParams.get("status") || "pending")
              ? [application]
              : [],
          links: [],
          pendingCount: application?.status === "pending" ? 1 : 0,
          nextCursor: null,
        };
      } else if (endpoint === "onboarding/review") {
        expect(admin).toBe(true);
        expect(body.id).toBe(application.id);
        application.status = body.decision;
        application.decision_note = body.note;
        application.reviewed_at = new Date().toISOString();
        if (body.decision === "accepted") {
          expect(body.templateId).toBe(w.templates[0].id);
          w.employees.push({
            ...w.employees[0],
            ...application.details,
            id: uid(),
            email: body.email,
            department: body.department,
            startDate: body.startDate,
            status: "onboarding",
          });
        }
        data = { application };
      } else {
        data = { error: `Unexpected test endpoint: ${endpoint}` };
        status = 404;
      }
      await route.fulfill({ status, json: data });
    });
  }
  return {
    install,
    path,
    token,
    w,
    verified: () => {
      signedIn = true;
    },
    signedOut: () => { signedIn = false; },
    linkCount: () => linksCreated,
  };
}

test("admin shares a link; employee creates account and submits; admin reviews and accepts", async ({
  page,
  browser,
  baseURL,
}) => {
  const s = scenario(baseURL!);
  const employeeContext = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
  });
  try {
    const employee = await employeeContext.newPage();
    await s.install(page, true);
    await s.install(employee, false);
    await page.goto("/neutronium/");
    await page
      .getByRole("button", { name: "Onboard employee", exact: true })
      .first()
      .click();
    const field = page.getByLabel("Employee invitation link", { exact: true });
    await expect(field).toHaveValue(baseURL! + s.path);
    expect(s.linkCount()).toBe(1);
    await page.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw new Error("Denied");
          },
        },
      }),
    );
    await page.getByRole("button", { name: "Copy invitation link" }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "The link is selected",
    );
    await expect(field).toBeFocused();
    await employee.goto(s.path);
    await expect(
      employee.getByRole("heading", { name: "Join Pilot Studio" }),
    ).toBeVisible();
    await employee.getByLabel("Email address").fill("sam@example.com");
    await employee
      .getByLabel("Password", { exact: true })
      .fill("A long test password 123");
    await employee
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(employee.getByRole("status")).toContainText(
      "confirmation link will bring you back here",
    );
    // Simulate returning from email verification; server identity rules are covered by database tests.
    s.verified();
    await employee.reload();
    await employee.getByLabel("First name", { exact: true }).fill("Sam");
    await employee.getByLabel("Last name", { exact: true }).fill("Lee");
    await employee.getByLabel("Job title (optional)").fill("Developer");
    await employee.getByLabel("Location (optional)").fill("Toronto");
    await employee
      .getByLabel("Message for your administrator (optional)")
      .fill("Joining the web team");
    await employee.getByRole("button", { name: "Submit for approval" }).click();
    await expect(
      employee.getByRole("heading", {
        name: "Waiting for administrator approval",
      }),
    ).toBeVisible();
    await expect(
      employee.getByRole("link", { name: "Open my workspace" }),
    ).toHaveCount(0);
    await employee.screenshot({
      path: ".neutronium-dev/employee-application-mobile.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "View employee approvals" }).click();
    await page.getByRole("button", { name: "Review Sam Lee" }).click();
    await expect(
      page.getByText("Joining the web team", { exact: false }),
    ).toBeVisible();
    await page
      .getByLabel("Company email", { exact: true })
      .fill("sam@pilot.example");
    await page.getByLabel("Department", { exact: true }).fill("Engineering");
    await page
      .getByLabel("Note for the employee (optional)")
      .fill("Welcome to the team!");
    await page.screenshot({
      path: ".neutronium-dev/employee-application-review.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Accept and start onboarding" })
      .click();
    await expect(page.getByRole("status")).toContainText("Employee accepted");
    await employee
      .getByRole("button", { name: "Check status", exact: true })
      .click();
    await expect(
      employee.getByRole("heading", { name: "You’re accepted" }),
    ).toBeVisible();
    await expect(
      employee.getByText("Welcome to the team!", { exact: false }),
    ).toBeVisible();
    await expect(
      employee.getByRole("link", { name: "Open my workspace" }),
    ).toHaveAttribute("href", `/neutronium/?org=${s.w.id}`);
    await page
      .getByRole("button", { name: "People", exact: true })
      .first()
      .click();
    await expect(
      page.getByText("sam@pilot.example", { exact: true }),
    ).toBeVisible();
    expect(
      await employee.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await employeeContext.close();
  }
});

test("admin can decline without completing onboarding fields; employee sees the decision without access", async ({
  page,
  browser,
  baseURL,
}) => {
  const s = scenario(baseURL!, true);
  const context = await browser.newContext({ baseURL });
  try {
    const employee = await context.newPage();
    await s.install(page, true);
    await s.install(employee, false);
    await page.goto("/neutronium/?view=employee-approvals");
    await page.getByRole("button", { name: "Review Sam Lee" }).click();
    await page.getByLabel("Company email", { exact: true }).clear();
    await page
      .getByRole("combobox", { name: "Onboarding template", exact: true })
      .selectOption("");
    await page
      .getByLabel("Note for the employee (optional)")
      .fill("Please contact HR about the start date.");
    await page.getByRole("button", { name: "Decline employee" }).click();
    await employee.goto(s.path);
    await expect(
      employee.getByRole("heading", { name: "Your application was declined" }),
    ).toBeVisible();
    await expect(
      employee.getByText("Please contact HR about the start date.", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(
      employee.getByRole("link", { name: "Open my workspace" }),
    ).toHaveCount(0);
    await page.getByLabel("Application review status").selectOption("declined");
    await expect(
      page.getByRole("button", { name: "Review Sam Lee" }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

test("used invitation still allows an existing applicant to sign in and check their status", async ({
  page,
  baseURL,
}) => {
  const s = scenario(baseURL!, true);
  s.signedOut();
  await s.install(page, false);
  await page.goto(s.path);
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Already have an account? Sign in" })
    .click();
  await page.getByLabel("Email address").fill("sam@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("A long test password 123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Waiting for administrator approval" }),
  ).toBeVisible();
});
