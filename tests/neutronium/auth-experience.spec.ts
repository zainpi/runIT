import { test, expect, type Page } from "@playwright/test";

async function authPage(page: Page, user: unknown = null) {
  await page.route("**/neutronium/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
    const data = path.endsWith("/config")
      ? {
          demoAvailable: false,
          authConfigured: true,
          socialProviders: [],
          microsoftFeatures: {},
        }
      : path.endsWith("/auth/status")
        ? { user }
        : path.endsWith("/auth/mfa")
          ? { enabled: false, verified: false, required: true }
          : { error: "Sign in to continue." };
    await route.fulfill({
      json: data,
      status: path.endsWith("/session") ? 401 : 200,
    });
  });
}

test("a signed-in employee without a workspace can return to sign-in", async ({
  page,
}) => {
  await authPage(page, {
    signup_role: "employee",
    email: "employee@example.com",
  });
  let logoutAttempts = 0;
  await page.route("**/neutronium/api/logout", async (route) => {
    expect(route.request().method()).toBe("POST");
    logoutAttempts++;
    await route.fulfill(
      logoutAttempts === 1
        ? {
            status: 503,
            json: { error: "Could not sign out. Please try again." },
          }
        : { json: { ok: true } },
    );
  });
  await page.goto("/neutronium/");
  await expect(
    page.getByRole("heading", { name: "Join your company" }),
  ).toBeVisible();
  await expect(
    page.getByText("employee@example.com", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create workspace", exact: true }),
  ).toHaveCount(0);
  const switchAccount = page.getByRole("button", {
    name: "Sign in with a different account",
  });
  await switchAccount.click();
  await expect(page.locator(".nt-root").getByRole("alert")).toContainText(
    "Could not sign out",
  );
  await expect(
    page.getByRole("heading", { name: "Join your company" }),
  ).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
  await switchAccount.click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await expect(page.getByLabel("Work email")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText("employee@example.com", { exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".nt-root").getByRole("alert")).toHaveCount(0);
  expect(logoutAttempts).toBe(2);
});

test("organization validation explains the missing field and preserves a failed submission", async ({
  page,
}) => {
  await authPage(page, { signup_role: "admin" });
  let submissions = 0;
  await page.route("**/neutronium/api/organization", async (route) => {
    submissions++;
    await route.fulfill({
      status: 503,
      contentType: "text/html",
      body: "Service unavailable",
    });
  });
  await page.goto("/neutronium/");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(page.locator(".nt-root").getByRole("alert")).toContainText(
    "Enter your organization’s name, for example Acme Inc.",
  );
  await expect(page.getByLabel("Organization name")).toBeFocused();
  await expect(page.getByLabel("Organization name")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByLabel("Organization name").fill("   ");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  expect(submissions).toBe(0);
  await page.getByLabel("Organization name").fill("Acme Studio");
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(page.locator(".nt-root").getByRole("alert")).toContainText(
    "Neutronium couldn’t complete this request. Please try again in a few minutes.",
  );
  await expect(page.getByLabel("Organization name")).toHaveValue("Acme Studio");
  expect(submissions).toBe(1);
  await page.screenshot({
    path: ".neutronium-dev/auth-error.png",
    fullPage: true,
  });
  await page.route("**/neutronium/api/logout", (route) =>
    route.fulfill({ json: { ok: true } }),
  );
  await page
    .getByRole("button", { name: "Sign in with a different account" })
    .click();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  expect(submissions).toBe(1);
});

test("signup validates email and password, confirms email delivery and clears old errors", async ({
  page,
}) => {
  await authPage(page);
  await page.route("**/neutronium/api/signup", (route) =>
    route.fulfill({ json: { ok: true, confirmationRequired: true } }),
  );
  await page.goto("/neutronium/");
  await page
    .getByRole("button", { name: "New here? Create an account" })
    .click();
  await page.getByLabel("Work email").fill("not-an-email");
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.locator(".nt-root").getByRole("alert")).toContainText(
    "Enter a valid email address",
  );
  await expect(page.locator(".nt-root").getByRole("alert")).toContainText(
    "Password needs at least 12 characters.",
  );
  await page.getByLabel("Work email").fill("tester@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("a test password with spaces");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "check your email to confirm your account",
  );
  await page
    .getByRole("button", { name: "Already have an account? Sign in" })
    .click();
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.locator(".nt-root").getByRole("alert")).toHaveCount(0);
});

test("an invalid email confirmation opens a useful canonical page without leaking a token", async ({
  request,
  page,
}) => {
  const response = await request.get(
    "/neutronium/api/auth/confirm/?type=invalid&token_hash=test-only-invalid-token",
    { maxRedirects: 0 },
  );
  expect(response.status()).toBe(307);
  expect(response.headers()["cache-control"]).toBe("no-store");
  const location = new URL(response.headers().location);
  expect(location.pathname).toBe("/neutronium/");
  expect(location.searchParams.has("token_hash")).toBe(false);
  expect(location.searchParams.get("authError")).toContain(
    "incomplete or invalid",
  );
  await authPage(page);
  await page.goto(location.pathname + location.search);
  await expect(page.locator(".nt-root").getByRole("alert")).toContainText(
    "Open the full link from your latest Neutronium email.",
  );
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
});

test("authenticator enrollment displays a local QR code, validates input and hides it after verification", async ({
  page,
}) => {
  await authPage(page, { mfa_required: true, mfa_verified_at: null });
  await page.route("**/neutronium/api/auth/mfa/enroll", (route) =>
    route.fulfill({
      json: {
        secret: "JBSWY3DPEHPK3PXP",
        uri: "otpauth://totp/Neutronium:test%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Neutronium&algorithm=SHA1&digits=6&period=30",
      },
    }),
  );
  let challenges = 0;
  await page.route("**/neutronium/api/auth/mfa/challenge", (route) => {
    challenges++;
    return route.fulfill({ json: { recoveryCodes: ["test-recovery-code"] } });
  });
  await page.goto("/neutronium/?view=profile");
  await page.getByRole("button", { name: "Set up authenticator" }).click();
  const qr = page.getByRole("img", {
    name: "QR code for setting up the Neutronium authenticator",
  });
  await expect(qr).toBeVisible();
  await expect(qr).toHaveAttribute("src", /^data:image\/png;base64,/);
  await expect
    .poll(() => qr.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Verify session" }).click();
  await expect(page.locator(".nt-root").getByRole("alert")).toContainText(
    "Enter the current code from your authenticator app",
  );
  expect(challenges).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page
      .locator(".nt-form-errors")
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".neutronium-dev/mfa-qr-mobile.png",
    fullPage: true,
  });
  await page
    .getByLabel("Authenticator or recovery code", { exact: true })
    .fill("123456");
  await page.getByRole("button", { name: "Verify session" }).click();
  await expect(qr).toHaveCount(0);
  await expect(
    page.getByText("test-recovery-code", { exact: true }),
  ).toBeVisible();
  expect(challenges).toBe(1);
});

test("verified signup directs the user to sign in; resend gives a truthful confirmation message", async ({
  page,
}) => {
  await authPage(page);
  await page.route("**/neutronium/api/signup", (route) =>
    route.fulfill({
      json: { ok: true, confirmationRequired: true, existingAccount: true },
    }),
  );
  let resends = 0;
  await page.route("**/neutronium/api/auth/resend-confirmation", (route) => {
    resends++;
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto("/neutronium/");
  await page
    .getByRole("button", { name: "New here? Create an account" })
    .click();
  await page.getByLabel("Work email").fill("verified@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("verified account password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Your account is already verified",
  );
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Work email").fill("unverified@example.com");
  await page.getByRole("button", { name: "Resend confirmation email" }).click();
  await expect.poll(() => resends).toBe(1);
  await expect(page.getByRole("status")).toContainText(
    "If this account still needs verification",
  );
});
