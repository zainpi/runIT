import { test, expect, type Page } from "@playwright/test";
import { seed, uid, type Actor } from "../../src/lib/neutronium/model";
import { command } from "../../src/lib/neutronium/service";

async function workspace(page: Page) {
  const w = seed();
  w.demo = false;
  const actor: Actor = {
    id: uid(),
    name: "Test administrator",
    orgId: w.id,
    role: "ORG_OWNER",
    demo: false,
  };
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let failReads = false;
  await page.route("**/neutronium/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname
      .replace(/^\/neutronium\/api\//, "")
      .replace(/\/$/, "");
    if (path === "state" && failReads)
      return route.fulfill({
        status: 503,
        contentType: "text/html",
        body: "Gateway unavailable",
      });
    const data =
      path === "config"
        ? {
            demoAvailable: false,
            authConfigured: true,
            socialProviders: [],
            microsoftFeatures: {},
          }
        : path === "session"
          ? { actor }
          : path === "state"
            ? { actor, workspace: w }
            : path === "auth/status"
              ? { user: null }
              : path === "auth/workspaces"
                ? { workspaces: [{ id: w.id, name: w.name }] }
                : path === "auth/mfa"
                  ? { enabled: false, required: false, verified: true }
                  : path === "auth/sessions"
                    ? { sessions: [] }
                    : path === "attention"
                      ? {
                          pendingApplications: 0,
                          applications: [],
                          access: 0,
                          workflows: 0,
                          help: 0,
                        }
                      : {};
    await route.fulfill({ json: data });
  });
  return {
    w,
    actor,
    errors,
    failReads: (value: boolean) => {
      failReads = value;
    },
  };
}

test("repeated saves create one environment and a failed refresh does not ask the user to save again", async ({
  page,
}) => {
  const f = await workspace(page);
  let posts = 0;
  let finish!: () => void;
  const hold = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route("**/neutronium/api/test-environment-save", async (route) => {
    posts++;
    await hold;
    const input = route.request().postDataJSON();
    command(f.w, f.actor, "test-environment-save", input);
    f.failReads(true);
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto(`/neutronium/?view=environments&org=${f.w.id}`);
  await page
    .getByRole("button", { name: "Add environment", exact: true })
    .click();
  const maliciousName = '<img src=x onerror="window.hacked=true">';
  await page
    .getByLabel("Environment name", { exact: true })
    .fill(maliciousName);
  await page
    .getByLabel("Environment URL", { exact: true })
    .fill("https://staging.example.test");
  await page
    .getByRole("button", { name: "Save environment", exact: true })
    .click();
  await expect.poll(() => posts).toBe(1);
  await page
    .getByLabel("Environment name", { exact: true })
    .evaluate((input) => {
      const form = (input as HTMLInputElement).form!;
      for (let i = 0; i < 15; i++) form.requestSubmit();
    });
  expect(posts).toBe(1);
  finish();
  await expect(
    page.getByRole("heading", { name: "New environment", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".nt-root").getByRole("alert")).toContainText(
    "Your changes were saved",
  );
  await expect(page.getByRole("status")).toContainText("Directory updated");
  f.failReads(false);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: maliciousName, exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).hacked)).toBeUndefined();
  expect(f.w.testEnvironments).toHaveLength(1);
  expect(f.errors).toEqual([]);
});

test("notification controls, dismiss buttons, profile shortcuts and failed sign-out remain usable", async ({
  page,
}) => {
  const f = await workspace(page);
  f.w.notifications.push({
    id: uid(),
    recipientId: "admins",
    title: "Test notification",
    body: "Please review",
    createdAt: new Date().toISOString(),
    read: false,
    emailStatus: "failed",
  });
  await page.route("**/neutronium/api/notification-retry", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Delivery is temporarily unavailable." },
    }),
  );
  await page.route("**/neutronium/api/notifications-read", (route) => {
    f.w.notifications.forEach((n) => {
      n.read = true;
    });
    return route.fulfill({ json: { ok: true } });
  });
  let logouts = 0;
  await page.route("**/neutronium/api/logout", (route) => {
    logouts++;
    return route.fulfill(
      logouts === 1
        ? { status: 503, contentType: "text/html", body: "Gateway error" }
        : { json: { ok: true } },
    );
  });
  await page.goto("/neutronium/?view=notifications");
  await page.getByRole("button", { name: "Retry delivery" }).click();
  await expect(page.locator(".nt-root").getByRole("alert")).toContainText(
    "Delivery is temporarily unavailable",
  );
  await page.getByRole("button", { name: "Dismiss error" }).click();
  await expect(page.locator(".nt-root").getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Mark all as read" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Notifications marked as read",
  );
  await page.getByRole("button", { name: "Dismiss notification" }).click();
  await expect(page.getByRole("status")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Open my profile", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "My profile", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.locator(".nt-root").getByRole("alert")).toContainText(
    "Neutronium couldn’t complete this request",
  );
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  expect(logouts).toBe(2);
  expect(f.errors).toEqual([]);
});

test("service inbox reads and reports keep the selected organization and explain non-JSON errors", async ({
  page,
}) => {
  const f = await workspace(page);
  const paths: string[] = [];
  await page.route(
    /\/neutronium\/api\/(operations|pilot\/report)\/?\?/,
    (route) => {
      const url = new URL(route.request().url());
      expect(url.searchParams.get("org")).toBe(f.w.id);
      paths.push(url.pathname);
      return route.fulfill(
        url.pathname.includes("report")
          ? {
              status: 502,
              contentType: "text/html",
              body: "Provider gateway error",
            }
          : { json: { items: [], nextCursor: null } },
      );
    },
  );
  await page.goto(`/neutronium/?view=help&org=${f.w.id}`);
  await expect(
    page.getByRole("heading", { name: "Service requests", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".nt-root").getByRole("alert").first(),
  ).toContainText("Neutronium couldn’t complete this request");
  await expect
    .poll(() => paths.some((path) => path.includes("operations")))
    .toBe(true);
  expect(paths.some((path) => path.includes("report"))).toBe(true);
  expect(f.errors).toEqual([]);
});

test("API rejects oversized and malformed input and expires the actual demo cookie on sign-out", async ({
  page,
}) => {
  await page.goto("/neutronium/");
  await expect(
    page.getByRole("heading", { name: "Welcome back, Jamie" }),
  ).toBeVisible();
  const origin = new URL(page.url()).origin;
  for (const [data, expected] of [
    ["[null]", 400],
    ['{"__proto__":{"admin":true}}', 400],
    [JSON.stringify({ name: "🌍".repeat(30_000) }), 413],
    ['{"employees":[null]}', 400],
  ] as const) {
    const response = await page.request.post("/neutronium/api/import/", {
      headers: { origin, "content-type": "application/json" },
      data,
    });
    expect(response.status()).toBe(expected);
    expect((await response.json()).error).toBeTruthy();
  }
  const invalidOrg = await page.request.get(
    "/neutronium/api/state/?org=------------------------------------",
  );
  expect(invalidOrg.status()).toBe(400);
  const response = await page.request.post("/neutronium/api/logout/", {
    headers: { origin },
    data: {},
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["set-cookie"]).toContain("Path=/neutronium");
  expect(
    (await page.context().cookies()).some((c) => c.name === "neutronium_demo"),
  ).toBe(false);
  expect((await page.request.get("/neutronium/api/session/")).status()).toBe(
    401,
  );
});

test("a revoked session clears the workspace on the next poll", async ({
  page,
}) => {
  const f = await workspace(page);
  await page.goto("/neutronium/?view=environments");
  await expect(
    page.getByRole("button", { name: "Add environment", exact: true }),
  ).toBeVisible();
  await page.route(/\/neutronium\/api\/state\/?\?/, (route) =>
    route.fulfill({
      status: 401,
      json: { error: "Your session has expired. Sign in again to continue." },
    }),
  );
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible({ timeout: 12_000 });
  await expect(
    page.getByRole("button", { name: "Add environment", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".nt-root").getByRole("alert")).toContainText(
    "session has expired",
  );
  expect(f.errors).toEqual([]);
});

test("MFA gate sign-out failures remain on screen and can be retried", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/neutronium/api/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
    return route.fulfill(
      path.endsWith("/session")
        ? { status: 403, json: { error: "Verify your authenticator code." } }
        : {
            json: path.endsWith("/config")
              ? {
                  demoAvailable: false,
                  authConfigured: true,
                  socialProviders: [],
                }
              : path.endsWith("/auth/status")
                ? { user: { mfa_required: true, mfa_verified_at: null } }
                : { enabled: true, verified: false, required: true },
          },
    );
  });
  let attempts = 0;
  await page.route("**/neutronium/api/logout", (route) => {
    attempts++;
    return route.fulfill({
      status: 503,
      contentType: "text/html",
      body: "Gateway error",
    });
  });
  await page.goto("/neutronium/");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.locator(".nt-root").getByRole("alert")).toContainText(
    "couldn’t complete this request",
  );
  await expect(
    page.getByRole("heading", { name: "Secure your session" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect.poll(() => attempts).toBe(2);
  expect(errors).toEqual([]);
});
