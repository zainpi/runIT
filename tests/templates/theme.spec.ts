import { expect, test } from "@playwright/test";
import { THEME_STORAGE_KEY } from "../../src/components/theme/theme";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/templates/config/**", (route) => route.fulfill({ json: { available: true, testMode: true, currency: "cad" } }));
});

test("the system theme and saved override apply before hydration", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  // Block React bundles to check the first rendered page, before the provider mounts.
  await page.route("**/_next/static/**/*.js", (route) => route.abort());
  await page.goto("/about/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("[data-os]")).toHaveCSS("background-color", "rgb(23, 24, 28)");
  await page.evaluate((key) => localStorage.setItem(key, "light"), THEME_STORAGE_KEY);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("[data-os]")).toHaveCSS("background-color", "rgb(237, 228, 211)");
});

test("keyboard toggle persists through navigation and reload", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Switch to dark mode" });
  await toggle.focus();
  await toggle.press("Enter");
  await expect(page.getByRole("button", { name: "Switch to light mode" })).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY)).toBe("dark");
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute("content", "#17181c");
  await page.screenshot({ path: "/tmp/runit-dark-home.png", fullPage: true });
  await page.getByRole("navigation", { name: "Primary", exact: true }).getByRole("link", { name: "AI templates" }).click();
  await expect(page).toHaveURL(/\/templates\/$/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.getByRole("button", { name: "Switch to light mode" })).toBeVisible();
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("system changes follow automatically and choices sync across tabs", async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/about/");
  await expect(page.getByRole("button", { name: "Switch to dark mode" })).toBeVisible();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.getByRole("button", { name: "Switch to light mode" })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), THEME_STORAGE_KEY)).toBeNull();
  const other = await context.newPage();
  await other.emulateMedia({ colorScheme: "dark" });
  await other.goto("/contact/");
  await expect(other.getByRole("button", { name: "Switch to light mode" })).toBeVisible();
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(other.getByRole("button", { name: "Switch to dark mode" })).toBeVisible();
  await page.emulateMedia({ colorScheme: "light" });
  await other.evaluate((key) => localStorage.removeItem(key), THEME_STORAGE_KEY);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.getByRole("button", { name: "Switch to light mode" })).toBeVisible();
  await other.close();
});

test("blocked storage still allows a choice for the current visit", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => {
    Storage.prototype.getItem = Storage.prototype.setItem = () => { throw new Error("Storage blocked"); };
  });
  await page.goto("/about/");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.getByRole("navigation", { name: "Primary", exact: true }).getByRole("link", { name: "Contact" }).click();
  await expect(page).toHaveURL(/\/contact\/$/);
  await expect(page.getByRole("button", { name: "Switch to light mode" })).toBeVisible();
  await page.emulateMedia({ colorScheme: "dark" });
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("dark mode covers public pages and stays reachable on small screens", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of ["/", "/about/", "/contact/", "/privacy/", "/terms/", "/zainpi/", "/templates/", "/templates/mobile-app/", "/templates/library/", "/templates/trial/"]) {
    await page.goto(path);
    await expect(page.getByRole("button", { name: "Switch to light mode" })).toBeInViewport();
    await expect(page.locator("[data-os]")).toHaveCSS("background-color", "rgb(23, 24, 28)");
    await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.goto("/about/");
  for (const width of [768, 900, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    const contact = await page.getByRole("navigation", { name: "Primary", exact: true }).getByRole("link", { name: "Contact" }).boundingBox();
    const toggle = await page.getByRole("button", { name: "Switch to light mode" }).boundingBox();
    expect(contact!.x + contact!.width).toBeLessThan(toggle!.x);
  }
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/contact/");
  await expect(page.getByLabel("Your name")).toHaveCSS("background-color", "rgb(36, 37, 43)");
  await expect(page.getByLabel("Your name")).toHaveCSS("color", "rgb(243, 238, 228)");
  await page.screenshot({ path: "/tmp/runit-dark-contact-mobile.png", fullPage: true });
  await page.goto("/templates/");
  await page.getByRole("button", { name: "Add Mobile app", exact: true }).click();
  await page.screenshot({ path: "/tmp/runit-dark-store-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("[data-os]")).toHaveCSS("background-color", "rgb(237, 228, 211)");
});
