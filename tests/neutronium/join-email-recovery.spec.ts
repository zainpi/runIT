import { test, expect } from "@playwright/test";

test("an invitation signup can retry a failed email and resend to the entered employee address", async ({
  page,
}) => {
  const token = "J".repeat(43);
  const email = "employee@example.com";
  const password = "An employee test password";
  let signups = 0;
  let resends = 0;
  await page.route("**/neutronium/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/onboarding/invitation/"))
      return route.fulfill({
        json: {
          companyName: "Pilot Studio",
          available: true,
          application: null,
        },
      });
    if (path.endsWith("/auth/status/"))
      return route.fulfill({ json: { user: null } });
    const body = route.request().postDataJSON();
    expect(body.email).toBe(email);
    expect(body.joinToken).toBe(token);
    if (path.endsWith("/signup/")) {
      expect(body.password).toBe(password);
      expect(body.signupRole).toBe("employee");
      signups++;
      return route.fulfill(
        signups === 1
          ? {
              status: 503,
              json: {
                error: "Authentication email could not be sent. Please retry.",
              },
            }
          : { json: { ok: true, confirmationRequired: true } },
      );
    }
    expect(path).toBe("/neutronium/api/auth/resend-confirmation/");
    resends++;
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto(`/neutronium/join/?token=${token}`);
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  const submit = page.getByRole("button", {
    name: "Create account",
    exact: true,
  });
  await submit.click();
  await expect(page.locator(".nt-root").getByRole("alert")).toContainText(
    "email could not be sent",
  );
  await expect(submit).toBeEnabled();
  await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(
    email,
  );
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
    password,
  );
  await submit.click();
  await expect(page.getByRole("status")).toContainText(
    "confirmation link returns here",
  );
  await expect(page.locator(".nt-root").getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Resend confirmation email" }).click();
  await expect(page.getByRole("status")).toContainText(
    "a new link has been requested",
  );
  expect(signups).toBe(2);
  expect(resends).toBe(1);
});
