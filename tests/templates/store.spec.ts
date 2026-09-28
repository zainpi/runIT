import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const token = "ab".repeat(32);
const sessionId = "cs_test_1234567890abcdef";
const productNames = ["Discord bot", "Roblox game", "Mobile game", "Mobile app", "Online store", "Browser game"];
const productIds = ["discord-bot", "roblox-game", "mobile-game", "mobile-app", "storefront", "browser-game"];

async function mockConfiguration(page: Page, currency: "cad" | "usd" = "cad", appIconAvailable = true) {
  await page.route("**/api/templates/config/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ available: true, appIconAvailable, testMode: true, currency }),
  }));
}

async function waitForStore(page: Page) {
  await page.goto("/templates/");
  await expect(page.getByRole("button", { name: "Try test checkout" })).toBeVisible();
}

test("cart prices every bundle exactly and reprices after add/remove", async ({ page }) => {
  await mockConfiguration(page);
  await waitForStore(page);

  const totals = ["$9.99", "$14.99", "$19.99", "$24.99", "$29.99", "$34.99"];
  for (let index = 0; index < productNames.length; index += 1) {
    await page.getByRole("button", { name: `Add ${productNames[index]}`, exact: true }).click();
    if (index === 0) {
      // The first template pre-checks its recommended extra; clearing it stops later pre-selection.
      await expect(page.getByLabel("Add skills & tools setup", { exact: true })).toBeChecked();
      await expect(page.getByText("$19.99", { exact: true }).last()).toBeVisible();
      await page.getByLabel("Add skills & tools setup", { exact: true }).uncheck();
    }
    await expect(page.getByText(totals[index], { exact: true }).last()).toBeVisible();
    await expect(page.locator("#bundle").getByText(`${index + 1} selected`, { exact: true })).toBeVisible();
  }

  await page.getByLabel("Add AI teamwork", { exact: true }).check();
  await expect(page.getByText("$39.99", { exact: true }).last()).toBeVisible();
  await page.getByLabel("Add skills & tools setup", { exact: true }).check();
  await expect(page.getByText("$49.99", { exact: true }).last()).toBeVisible();
  await page.getByLabel("Create app icon", { exact: true }).check();
  await expect(page.getByText("$54.99", { exact: true }).last()).toBeVisible();
  await page.getByLabel("Create app icon", { exact: true }).uncheck();
  await page.getByLabel("Add AI teamwork", { exact: true }).uncheck();
  await expect(page.getByText("$44.99", { exact: true }).last()).toBeVisible();
  await page.getByLabel("Add AI teamwork", { exact: true }).check();
  await expect(page.getByText("$49.99", { exact: true }).last()).toBeVisible();
  await page.getByLabel("Add skills & tools setup", { exact: true }).uncheck();
  await expect(page.getByText("$39.99", { exact: true }).last()).toBeVisible();
  await page.getByLabel("Add AI teamwork", { exact: true }).uncheck();
  await expect(page.getByText("$34.99", { exact: true }).last()).toBeVisible();

  await expect(page.getByLabel("Remove Discord bot from bundle", { exact: true })).toBeVisible();
  await page.getByLabel("Remove Discord bot from bundle", { exact: true }).click();
  await expect(page.getByText("$29.99", { exact: true }).last()).toBeVisible();
  await expect(page.getByLabel("Add Discord bot", { exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.getByLabel("Remove Browser game from bundle", { exact: true }).click();
  await expect(page.getByText("$24.99", { exact: true }).last()).toBeVisible();

  for (const name of productNames.slice(1, 4)) await page.getByLabel(`Remove ${name} from bundle`, { exact: true }).click();
  await expect(page.getByText("$9.99", { exact: true }).last()).toBeVisible();
  await page.getByLabel("Add AI teamwork", { exact: true }).check();
  await expect(page.getByText("$14.99", { exact: true }).last()).toBeVisible();
  await page.getByLabel("Add skills & tools setup", { exact: true }).check();
  await expect(page.getByText("$24.99", { exact: true }).last()).toBeVisible();
  await page.getByLabel("Add AI teamwork", { exact: true }).uncheck();
  await expect(page.getByText("$19.99", { exact: true }).last()).toBeVisible();
});

test("extras stay visible and a template pre-checks its recommended extra", async ({ page }) => {
  await mockConfiguration(page);
  await waitForStore(page);
  const icon = page.getByLabel("Create app icon", { exact: true });
  const teamwork = page.getByLabel("Add AI teamwork", { exact: true });
  const skills = page.getByLabel("Add skills & tools setup", { exact: true });
  await expect(page.locator("#bundle summary", { hasText: "Optional extras" })).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Optional extras" })).toBeVisible();
  for (const option of [icon, teamwork, skills]) await expect(option).toBeVisible();

  await page.getByLabel("Add Mobile app", { exact: true }).click();
  await expect(icon).toBeChecked();
  await expect(teamwork).not.toBeChecked();
  await expect(skills).not.toBeChecked();
  await page.getByLabel("Add Browser game", { exact: true }).click();
  await expect(skills).toBeChecked();
  await expect(page.locator("#bundle").getByText("$29.99", { exact: true })).toBeVisible();

  // Once the buyer changes an extra, adding templates leaves the extras alone.
  await skills.uncheck();
  await page.getByLabel("Remove Browser game from bundle", { exact: true }).click();
  await page.getByLabel("Add Discord bot", { exact: true }).click();
  await expect(skills).not.toBeChecked();
  await expect(page.locator("#bundle").getByText("$19.99", { exact: true })).toBeVisible();
});

test("an unavailable app icon is never pre-checked", async ({ page }) => {
  await mockConfiguration(page, "cad", false);
  await waitForStore(page);
  await page.getByLabel("Add Mobile game", { exact: true }).click();
  await expect(page.getByLabel("Create app icon", { exact: true })).not.toBeChecked();
  await expect(page.getByRole("button", { name: "Try test checkout" })).toBeEnabled();
});

for (const currency of ["cad", "usd"] as const) {
  test(`${currency.toUpperCase()} pricing stays clear in the compact checkout and mobile order bar`, async ({ page }) => {
    await mockConfiguration(page, currency);
    await waitForStore(page);
    const label = currency.toUpperCase();
    await expect(page.getByText(`$9.99 ${label}`, { exact: true })).toBeVisible();
    await expect(page.getByText("first template · $5.00 each extra", { exact: true })).toBeVisible();
    await page.getByLabel("Add Online store", { exact: true }).click();
        await page.getByLabel("Add AI teamwork", { exact: true }).check();
      await page.getByLabel("Add skills & tools setup", { exact: true }).check();
      await page.getByLabel("Create app icon", { exact: true }).check();
    const bundle = page.locator("#bundle");
    await expect(bundle.getByText(`One-time payment · ${label}`, { exact: true })).toBeVisible();
    await expect(bundle.getByText("$29.99", { exact: true })).toBeVisible();
    await expect(bundle.getByText("1 icon + 3 updates. Download every version.", { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByText(`$29.99 ${label}`, { exact: true })).toBeVisible();
    await expect(page.getByText("1 template + 3 extras", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Review order" }).click();
    await expect(page.getByRole("button", { name: "Try test checkout" })).toBeInViewport();
    await expect(page.getByRole("link", { name: "Review order" })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}

test("checkout only asks for a template and preserves existing personalization for after purchase", async ({ page }) => {
  await mockConfiguration(page);
  await page.addInitScript(() => {
    if (!localStorage.getItem("runit-template-brief-v1")) localStorage.setItem("runit-template-brief-v1", JSON.stringify({ details: { name: "Moon Cart", idea: "A neighborhood marketplace.", features: "Saved shops", style: "Quiet", budget: "$25" }, mode: "computer", selected: [] }));
  });
  await waitForStore(page);
  await expect(page.getByLabel("App name")).toHaveCount(0);
  await expect(page.getByLabel("What do you want to make?")).toHaveCount(0);
  await expect(page.getByLabel("Make AI control my computer")).toHaveCount(0);
  await expect(page.getByLabel("Create app icon", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Discount code", { exact: true })).toBeHidden();
  await page.getByLabel("Add Online store", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Try test checkout" })).toBeEnabled();
  await expect(page.getByLabel("Add skills & tools setup", { exact: true })).toBeChecked();
  await page.getByLabel("Create app icon", { exact: true }).check();
  await page.reload();
  await expect(page.getByLabel("Remove Online store", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Create app icon", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Add skills & tools setup", { exact: true })).toBeChecked();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("runit-template-brief-v1")!))).toMatchObject({ details: { name: "Moon Cart", idea: "A neighborhood marketplace.", features: "Saved shops", style: "Quiet", budget: "$25" }, mode: "computer", selected: ["storefront"], appIcon: true, skillTree: true });
  await page.getByRole("button", { name: "Have a free-trial code?" }).click();
  await expect(page.getByLabel("What do you want to make?")).toHaveValue("A neighborhood marketplace.");
  await expect(page.getByRole("button", { name: "Try test checkout" })).toHaveCount(0);
  await page.getByRole("button", { name: "Back to checkout" }).click();
  await expect(page.locator("#bundle").getByText("$24.99", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Create app icon", { exact: true })).toBeChecked();
  await page.goto("/templates/#free-trial");
  await expect(page.getByLabel("What do you want to make?")).toHaveValue("A neighborhood marketplace.");
  await page.getByRole("button", { name: "Back to checkout" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Try test checkout" })).toBeEnabled();
  await expect(page.getByRole("form", { name: "Free trial checkout" })).toHaveCount(0);
});

test("checkout sends canonical IDs, access token, and add-on flag, then saves its receipt", async ({ page }) => {
  await mockConfiguration(page);
  let posted: Record<string, unknown> | undefined;
  await page.route("**/api/templates/checkout/**", async (route) => {
    posted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ url: "https://checkout.stripe.com/c/pay/mock", sessionId }),
    });
  });
  await page.route("https://checkout.stripe.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>Mock Stripe Checkout</title><h1>Mock checkout</h1>" }));
  await waitForStore(page);
  await page.getByLabel("Add Browser game", { exact: true }).click();
  await page.getByLabel("Add Discord bot", { exact: true }).click();
  await page.getByLabel("Add AI teamwork", { exact: true }).check();
  await page.getByLabel("Add skills & tools setup", { exact: true }).check();
  await page.getByLabel("Create app icon", { exact: true }).check();
  await page.getByRole("button", { name: "Try test checkout" }).click();
  await page.waitForURL("https://checkout.stripe.com/**");

  expect(posted).toBeDefined();
  expect(Object.keys(posted!).sort()).toEqual(["accessToken", "appIcon", "skillTree", "subagents", "templates"]);
  expect(posted!.templates).toEqual(["discord-bot", "browser-game"]);
  expect(posted!.subagents).toBe(true);
  expect(posted!.skillTree).toBe(true);
  expect(posted!.appIcon).toBe(true);
  expect(posted).not.toHaveProperty("amount");
  expect(posted).not.toHaveProperty("currency");
  expect(posted).not.toHaveProperty("unitAmount");
  expect(posted).not.toHaveProperty("price");
  expect(posted).not.toHaveProperty("details");
  expect(posted).not.toHaveProperty("brief");
  expect(posted!.accessToken).toMatch(/^[a-f0-9]{64}$/);

  await page.goto("http://127.0.0.1:3102/templates/");
  const receipt = await page.evaluate(() => JSON.parse(localStorage.getItem("runit-template-orders-v1") || "[]"));
  const pending = await page.evaluate(() => JSON.parse(sessionStorage.getItem("runit-template-checkout") || "null"));
  expect(receipt[0]).toMatchObject({ sessionId, templates: ["discord-bot", "browser-game"], subagents: true, skillTree: true, appIcon: true });
  expect(receipt[0].accessToken).toBe(posted!.accessToken);
  expect(pending.cart).toContain(":currency=cad:");
  expect(pending.cart).toContain(":appIcon=true:");
  expect(pending.token).toBe(posted!.accessToken);
});

test("browser Back from Stripe lets the customer retry checkout", async ({ page }) => {
  await mockConfiguration(page);
  let attempts = 0;
  await page.route("**/api/templates/checkout/**", async (route) => {
    attempts++;
    await route.fulfill({ json: { url: "https://checkout.stripe.com/c/pay/back-test", sessionId } });
  });
  await page.route("https://checkout.stripe.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>Mock Stripe Checkout</title>" }));
  await waitForStore(page);
  await page.getByLabel("Add Mobile app", { exact: true }).click();
  const checkout = page.getByRole("button", { name: /checkout/ });
  await checkout.click();
  await page.waitForURL("https://checkout.stripe.com/**");
  await page.goBack();
  await expect(page.getByLabel("Remove Mobile app", { exact: true })).toBeVisible();
  await expect(checkout).toBeEnabled();
  await checkout.click();
  await page.waitForURL("https://checkout.stripe.com/**");
  expect(attempts).toBe(2);
});

test("a cached return from Stripe clears the checkout loading state", async ({ page }) => {
  await mockConfiguration(page);
  let releaseCheckout!: () => void;
  const heldResponse = new Promise<void>((resolve) => { releaseCheckout = resolve; });
  await page.route("**/api/templates/checkout/**", async (route) => {
    await heldResponse;
    await route.fulfill({ json: { url: "https://checkout.stripe.com/c/pay/cache-test", sessionId } });
  });
  await page.route("https://checkout.stripe.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>Mock Stripe Checkout</title>" }));
  await waitForStore(page);
  await page.getByLabel("Add Mobile app", { exact: true }).click();
  await page.getByRole("button", { name: "Try test checkout" }).click();
  await expect(page.getByRole("button", { name: "Opening checkout…" })).toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect(page.getByRole("button", { name: "Try test checkout" })).toBeEnabled();
  releaseCheckout();
  await page.waitForURL("https://checkout.stripe.com/**");
});

test("founder referral code previews ten percent off and is sent to checkout", async ({ page }) => {
  await mockConfiguration(page);
  let posted: Record<string, unknown> | undefined;
  await page.route("**/api/templates/referral/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ founder: "Zain Piyarali", discountPercent: 10 }),
  }));
  await page.route("**/api/templates/checkout/**", async (route) => {
    posted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: "https://checkout.stripe.com/c/pay/referral", sessionId }) });
  });
  await page.route("https://checkout.stripe.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>Mock Stripe Checkout</title>" }));
  await waitForStore(page);
  await page.getByLabel("Add Mobile app", { exact: true }).click();
  await page.getByText("Add a discount code", { exact: true }).click();
  await page.getByLabel("Discount code", { exact: true }).fill("zain-runit-10");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.getByText("10% off applied to this order", { exact: false })).toBeVisible();
  await expect(page.locator("#bundle").getByText("$13.49", { exact: true })).toBeVisible();
  await page.getByLabel("Create app icon", { exact: true }).uncheck();
  await expect(page.locator("#bundle").getByText("$8.99", { exact: true }).last()).toBeVisible();
  await page.getByLabel("Create app icon", { exact: true }).check();
  await expect(page.locator("#bundle").getByText("$13.49", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Try test checkout" }).click();
  await page.waitForURL("https://checkout.stripe.com/**");
  expect(posted).toMatchObject({ templates: ["mobile-app"], referralCode: "ZAIN-RUNIT-10", appIcon: true });
});

test("private gift code makes the selected bundle free before checkout", async ({ page }) => {
  await mockConfiguration(page);
  let posted: Record<string, unknown> | undefined;
  await page.route("**/api/templates/referral/**", (route) => route.fulfill({ json: { founder: "runsIT gift", discountPercent: 100 } }));
  await page.route("**/api/templates/checkout/**", async (route) => {
    posted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ json: { url: "https://checkout.stripe.com/c/pay/gift", sessionId } });
  });
  await page.route("https://checkout.stripe.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>Mock Stripe Checkout</title>" }));
  await waitForStore(page);
  await page.getByLabel("Add Mobile app", { exact: true }).click();
  await page.getByText("Add a discount code", { exact: true }).click();
  await page.getByLabel("Discount code", { exact: true }).fill("mock-gift-code");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page.locator("#bundle")).toContainText("100% off applied to this order");
  await expect(page.locator("#bundle")).toContainText("$0.00");
  await expect(page.locator("#bundle")).toContainText("No card needed");
  await page.getByRole("button", { name: "Complete free checkout" }).click();
  await page.waitForURL("https://checkout.stripe.com/**");
  expect(posted).toMatchObject({ templates: ["mobile-app"], referralCode: "MOCK-GIFT-CODE" });
});

test("canceled checkout returns to the saved selection", async ({ page }) => {
  await mockConfiguration(page);
  await page.addInitScript(() => localStorage.setItem("runit-template-brief-v1", JSON.stringify({
    details: { name: "Saved idea", idea: "", features: "", style: "", budget: "" },
    mode: "manual",
    selected: ["mobile-app"],
    subagents: true,
    skillTree: true,
    appIcon: true,
  })));
  await page.goto("/templates/?canceled=1");
  await expect(page.getByRole("status")).toContainText("Checkout canceled");
  await expect(page.getByLabel("Remove Mobile app", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("runit-template-brief-v1")!).details.name)).toBe("Saved idea");
  await expect(page.getByLabel("Create app icon", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Add AI teamwork", { exact: true })).toBeChecked();
  await expect(page.getByLabel("Add skills & tools setup", { exact: true })).toBeChecked();
});

test("keyboard controls have usable labels", async ({ page }) => {
  await mockConfiguration(page);
  await waitForStore(page);
  const add = page.getByLabel("Add Discord bot", { exact: true });
  await add.focus();
  await expect(add).toBeFocused();
  await page.keyboard.press("Space");
  await expect(page.getByLabel("Remove Discord bot", { exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Create app icon", { exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(page.getByLabel("Create app icon", { exact: true })).toBeChecked();
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
});

test("desktop and mobile layouts have no horizontal overflow", async ({ page }) => {
  await mockConfiguration(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await waitForStore(page);
  await page.getByLabel("Add Online store", { exact: true }).click();
  await page.getByLabel("Add AI teamwork", { exact: true }).check();
  await page.getByLabel("Add skills & tools setup", { exact: true }).check();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/runit-templates-desktop.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "/tmp/runit-templates-mobile.png", fullPage: true });
});

test("paid library composes personalized prompt and supports copy and download", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:3102" });
  let libraryRequest: Record<string, unknown> | undefined;
  await page.route("**/api/templates/library/**", async (route) => {
    libraryRequest = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ templates: [
      { id: "storefront", foundation: "FOUNDATION_MARKER: Build the secure catalog and fulfillment system." },
      { id: "browser-game", foundation: "GAME_FOUNDATION_MARKER: Build server-authoritative rounds." },
    ] }) });
  });
  await page.addInitScript(() => localStorage.setItem("runit-template-brief-v1", JSON.stringify({
    details: { name: "Library Idea", idea: "A private test idea", features: "One feature", style: "Clean", budget: "Low" },
    mode: "manual",
    selected: ["storefront", "browser-game"],
  })));
  await page.goto(`/templates/library/#session_id=${sessionId}&access=${token}`);
  const prompt = page.getByLabel(/Your app details .* complete foundation/);
  await expect(prompt).toContainText("Library Idea");
  await expect(prompt).toContainText("FOUNDATION_MARKER");
  expect(libraryRequest).toEqual({ sessionId, accessToken: token });

  await page.getByRole("button", { name: "Browser game" }).click();
  await expect(prompt).toContainText("GAME_FOUNDATION_MARKER");
  await page.getByRole("tab", { name: "Build files", exact: true }).click();
  await page.getByRole("button", { name: "Copy full prompt" }).click();
  await expect(page.getByRole("status", { name: "Template library status" })).toContainText("Browser game prompt copied");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("GAME_FOUNDATION_MARKER");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download .txt" }).click();
  expect((await download).suggestedFilename()).toBe("browser-game-prompt.txt");
});

test("private purchase URL is prominent, bookmarkable, and matches copy and access download", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:3102" });
  await page.route("**/api/templates/library/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ templates: [{ id: "storefront", foundation: "PURCHASE_URL_FOUNDATION" }] }),
  }));

  const purchaseUrl = `http://127.0.0.1:3102/templates/library/#session_id=${sessionId}&access=${token}`;
  await page.goto(purchaseUrl);
  await page.getByText("Save private link", { exact: false }).click();
  await expect(page.getByRole("heading", { name: "Save your purchase link", exact: true })).toBeVisible();
  const privateUrl = page.getByLabel("Your private purchase URL", { exact: true });
  await expect(privateUrl).toHaveValue(purchaseUrl);
  await expect(page.getByText(/saved AI conversation in this order on any device/i)).toBeVisible();
  await expect(page).toHaveURL(purchaseUrl);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "/tmp/runit-templates-library-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/runit-templates-library-mobile.png", fullPage: true });

  await page.getByRole("button", { name: "Copy purchase link", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(purchaseUrl);
  await expect(page.getByRole("status", { name: "Template library status" })).toContainText("Purchase link copied. Save it somewhere safe");

  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download access file", exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("template-order-access.txt");
  const path = await download.path();
  expect(path).toBeTruthy();
  const accessFile = await readFile(path!, "utf8");
  expect(accessFile).toContain(purchaseUrl);
  expect(accessFile.match(/http:\/\/127\.0\.0\.1:3102\/templates\/library\/#session_id=/g)).toHaveLength(1);

  await page.reload();
  await expect(page).toHaveURL(purchaseUrl);
  await expect(privateUrl).toHaveValue(purchaseUrl);
  await expect(page.getByLabel(/Your app details .* complete foundation/)).toContainText("PURCHASE_URL_FOUNDATION");
});

test("copied purchase URL restores the paid order in a clean browser with no receipt storage", async ({ browser }) => {
  const cleanContext = await browser.newContext({ baseURL: "http://127.0.0.1:3102" });
  const cleanPage = await cleanContext.newPage();
  await cleanPage.route("**/api/templates/library/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ templates: [{ id: "browser-game", foundation: "CROSS_DEVICE_FOUNDATION" }] }),
  }));
  const purchaseUrl = `http://127.0.0.1:3102/templates/library/#session_id=${sessionId}&access=${token}`;

  await cleanPage.goto(purchaseUrl);
  await expect(cleanPage.getByText("Browser game · Your workspace", { exact: true })).toBeVisible();
  await expect(cleanPage.getByLabel(/Your app details .* complete foundation/)).toContainText("CROSS_DEVICE_FOUNDATION");
  await expect(cleanPage.getByLabel("Your private purchase URL", { exact: true })).toHaveValue(purchaseUrl);
  await expect(cleanPage).toHaveURL(purchaseUrl);
  await cleanContext.close();
});

test("incoming purchase URL remains usable when browser storage is blocked", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException("Storage blocked", "SecurityError"); };
    Storage.prototype.setItem = () => { throw new DOMException("Storage blocked", "SecurityError"); };
    Storage.prototype.removeItem = () => { throw new DOMException("Storage blocked", "SecurityError"); };
  });
  await page.route("**/api/templates/library/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ templates: [{ id: "mobile-app", foundation: "NO_STORAGE_FOUNDATION" }] }),
  }));
  const purchaseUrl = `http://127.0.0.1:3102/templates/library/#session_id=${sessionId}&access=${token}`;

  await page.goto(purchaseUrl);
  await expect(page.getByLabel(/Your app details .* complete foundation/)).toContainText("NO_STORAGE_FOUNDATION");
  await expect(page.getByLabel("Your private purchase URL", { exact: true })).toHaveValue(purchaseUrl);
  await expect(page).toHaveURL(purchaseUrl);
  await expect(page.getByRole("status", { name: "Template library status" })).toContainText("Browser storage is unavailable");
});

test("same-tab private-link navigation loads the new order and ignores a late prior response", async ({ page }) => {
  const newerSession = "cs_test_hashchange987654";
  const newerToken = "ef".repeat(32);
  await page.route("**/api/templates/library/**", async (route) => {
    const body = route.request().postDataJSON() as { sessionId: string };
    if (body.sessionId === sessionId) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ templates: [{ id: "storefront", foundation: "STALE_FIRST_ORDER" }], skillTree: true, skillTreeInstructions: "STALE_ADDON" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ templates: [{ id: "browser-game", foundation: "CURRENT_SECOND_ORDER" }], skillTree: false }),
    });
  });
  const firstUrl = `http://127.0.0.1:3102/templates/library/#session_id=${sessionId}&access=${token}`;
  const secondUrl = `http://127.0.0.1:3102/templates/library/#session_id=${newerSession}&access=${newerToken}`;

  await page.goto(firstUrl);
  await page.evaluate(({ newerSession, newerToken }) => {
    location.hash = `session_id=${newerSession}&access=${newerToken}`;
  }, { newerSession, newerToken });
  await expect(page.getByLabel(/Your app details .* complete foundation/)).toContainText("CURRENT_SECOND_ORDER");
  await expect(page.getByText("Browser game · Your workspace", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Your private purchase URL", { exact: true })).toHaveValue(secondUrl);
  await expect(page).toHaveURL(secondUrl);

  await page.waitForTimeout(600);
  await expect(page.getByLabel(/Your app details .* complete foundation/)).toContainText("CURRENT_SECOND_ORDER");
  await expect(page.getByLabel(/Your app details .* complete foundation/)).not.toContainText("STALE_FIRST_ORDER");
  await page.getByRole("tab", { name: "Add-ons", exact: true }).click();
  await expect(page.getByRole("article", { name: "Skill tree setup" })).toHaveCount(0);
  await expect(page).toHaveURL(secondUrl);
});

test("paid subagent workflow is ready to use, survives mode changes, and is included in downloads", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:3102" });
  await page.route("**/api/templates/library/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      templates: [{ id: "storefront", foundation: "BASE_FOUNDATION_MARKER" }],
      subagents: true,
      subagentInstructions: "SUBAGENT_ADDON_MARKER: delegate bounded independent tasks and verify their results.",
    }),
  }));
  await page.goto(`/templates/library/#session_id=${sessionId}&access=${token}`);
  const prompt = page.getByLabel(/Your app details .* complete foundation/);
  const addon = page.getByRole("article", { name: "Subagent workflow" });
  await expect(prompt).toContainText("SUBAGENT_ADDON_MARKER");

  await page.getByRole("tab", { name: "Plan", exact: true }).click();
  await page.getByLabel("Make AI control my computer").check();
  await expect(prompt).toContainText("SUBAGENT_ADDON_MARKER");
  await page.getByRole("tab", { name: "Add-ons", exact: true }).click();
  await expect(addon).toBeVisible();
  await expect(addon.getByRole("checkbox")).toHaveCount(0);
  await addon.getByText("Preview workflow instructions").click();
  await expect(addon).toContainText("SUBAGENT_ADDON_MARKER");
  await addon.getByRole("button", { name: "Copy build prompt" }).click();
  await expect(page.getByRole("status", { name: "Template library status" })).toContainText("subagent workflow");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("SUBAGENT_ADDON_MARKER");

  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("tab", { name: "Build files", exact: true }).click();
  await page.getByRole("button", { name: "Download .txt" }).click();
  const download = await downloadEvent;
  const path = await download.path();
  expect(path).toBeTruthy();
  expect(await readFile(path!, "utf8")).toContain("SUBAGENT_ADDON_MARKER");
});

test("paid skill-tree add-on exposes a separate manual setup artifact with copy and download", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: "http://127.0.0.1:3102" });
  await page.route("**/api/templates/library/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      templates: [{ id: "roblox-game", foundation: "ROBLOX_FOUNDATION_MARKER" }],
      subagents: true,
      subagentInstructions: "TEAMWORK_MARKER: delegate independent tasks and review the results.",
      skillTree: true,
      skillTreeInstructions: "SKILL_TREE_MARKER: classify Roblox Studio, Rokit, Rojo, Lune, StyLua and Blender accurately; verify sources before installation.",
    }),
  }));
  await page.goto(`/templates/library/#session_id=${sessionId}&access=${token}`);
  const addon = page.getByRole("article", { name: "Skill tree setup" });
  await page.getByRole("tab", { name: "Plan", exact: true }).click();
  await page.getByLabel("Do it myself").check();
  await page.getByRole("tab", { name: "Add-ons", exact: true }).click();
  await expect(addon).toBeVisible();
  await expect(page.getByRole("article", { name: "Subagent workflow" })).toBeVisible();
  await page.screenshot({ path: "/tmp/runit-paid-addons-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/runit-paid-addons-mobile.png", fullPage: true });

  await addon.getByRole("button", { name: "Copy setup prompt", exact: true }).click();
  await expect(page.getByRole("status", { name: "Template library status" })).toContainText(/skill setup.*copied/i);
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("SKILL_TREE_MARKER");
  expect(copied).toContain("WORKING MODE: I DO IT MYSELF");
  expect(copied).toContain("Roblox Studio");

  const downloadEvent = page.waitForEvent("download");
  await addon.getByRole("button", { name: "Download setup .txt", exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toMatch(/skill.*setup.*\.txt/i);
  const path = await download.path();
  expect(path).toBeTruthy();
  const downloaded = await readFile(path!, "utf8");
  expect(downloaded).toContain("SKILL_TREE_MARKER");
  expect(downloaded).toContain("WORKING MODE: I DO IT MYSELF");
});

test("forged skill-tree flags cannot expose instructions and switching orders clears entitlement", async ({ page }) => {
  const secondSession = "cs_test_fedcba0987654321";
  const secondToken = "cd".repeat(32);
  await page.route("**/api/templates/library/**", async (route) => {
    const body = route.request().postDataJSON() as { sessionId: string };
    const purchased = body.sessionId === sessionId;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        templates: [{ id: "storefront", foundation: purchased ? "PAID_SKILL_ORDER" : "BASE_ORDER" }],
        skillTree: purchased,
        skillTreeInstructions: purchased ? "ORDER_SPECIFIC_SKILL_MARKER" : null,
      }),
    });
  });
  await page.addInitScript(({ sessionId, token, secondSession, secondToken }) => {
    localStorage.setItem("runit-template-orders-v1", JSON.stringify([
      { sessionId, accessToken: token, templates: ["storefront"], skillTree: true, createdAt: "2026-09-16T12:00:00.000Z" },
      { sessionId: secondSession, accessToken: secondToken, templates: ["storefront"], skillTree: true, createdAt: "2026-09-15T12:00:00.000Z" },
    ]));
    localStorage.setItem("runit-template-brief-v1", JSON.stringify({
      details: { name: "Forged skill flag", idea: "", features: "", style: "", budget: "" },
      mode: "manual",
      selected: ["storefront"],
      skillTree: true,
    }));
  }, { sessionId, token, secondSession, secondToken });

  await page.goto("/templates/library/");
  const firstUrl = `http://127.0.0.1:3102/templates/library/#session_id=${sessionId}&access=${token}`;
  await expect(page).toHaveURL(firstUrl);
  await expect(page.getByLabel("Your private purchase URL", { exact: true })).toHaveValue(firstUrl);
  await page.getByRole("tab", { name: "Add-ons", exact: true }).click();
  await expect(page.getByRole("article", { name: "Skill tree setup" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy setup prompt", exact: true })).toBeVisible();

  await page.getByLabel("Saved orders on this browser").selectOption(secondSession);
  const secondUrl = `http://127.0.0.1:3102/templates/library/#session_id=${secondSession}&access=${secondToken}`;
  await expect(page).toHaveURL(secondUrl);
  await expect(page.getByLabel("Your private purchase URL", { exact: true })).toHaveValue(secondUrl);
  await expect(page.getByLabel(/Your app details .* complete foundation/)).toContainText("BASE_ORDER");
  await page.getByRole("tab", { name: "Add-ons", exact: true }).click();
  await expect(page.getByRole("article", { name: "Skill tree setup" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copy setup prompt", exact: true })).toHaveCount(0);
  await expect(page.getByText("ORDER_SPECIFIC_SKILL_MARKER", { exact: false })).toHaveCount(0);
});

test("local forged add-on flags cannot reveal an unpurchased subagent workflow", async ({ page }) => {
  await page.route("**/api/templates/library/**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      templates: [{ id: "storefront", foundation: "BASE_ONLY_MARKER" }],
      subagents: false,
      subagentInstructions: null,
      skillTree: false,
      skillTreeInstructions: null,
    }),
  }));
  await page.addInitScript(({ sessionId, token }) => {
    localStorage.setItem("runit-template-orders-v1", JSON.stringify([{
      sessionId,
      accessToken: token,
      templates: ["storefront"],
      subagents: true,
      skillTree: true,
      createdAt: new Date().toISOString(),
    }]));
    localStorage.setItem("runit-template-brief-v1", JSON.stringify({
      details: { name: "Forged", idea: "", features: "", style: "", budget: "" },
      mode: "manual",
      selected: ["storefront"],
      subagents: true,
      skillTree: true,
    }));
  }, { sessionId, token });
  await page.goto("/templates/library/");
  const prompt = page.getByLabel(/Your app details .* complete foundation/);
  await expect(prompt).toContainText("BASE_ONLY_MARKER");
  await page.getByRole("tab", { name: "Add-ons", exact: true }).click();
  await expect(page.getByRole("article", { name: "Subagent workflow" })).toHaveCount(0);
  await expect(page.getByRole("article", { name: "Skill tree setup" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copy setup prompt", exact: true })).toHaveCount(0);
  await expect(prompt).not.toContainText("SUBAGENT");
});

test("pending library order shows a retryable payment error without a prompt", async ({ page }) => {
  await page.route("**/api/templates/library/**", (route) => route.fulfill({
    status: 409,
    contentType: "application/json",
    body: JSON.stringify({ error: "Your payment is not complete yet. If you have paid, wait a moment and check again." }),
  }));
  await page.goto(`/templates/library/#session_id=${sessionId}&access=${token}`);
  await expect(page.getByRole("alert").filter({ hasText: "payment is not complete yet" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Check payment again" })).toBeVisible();
  await expect(page.getByLabel(/Your app details .* complete foundation/)).toHaveCount(0);
});

test("saved orders show their app names, restore older names and keep renames tied to the right order", async ({ page }) => {
  const second = "cs_test_pulse1234567890", unnamed = "cs_test_unnamed12345678";
  const requests: { action: string; sessionId: string }[] = [];
  await page.addInitScript(({ sessionId, token, second, unnamed }) => {
    if (localStorage.getItem("runit-template-orders-v1")) return;
    localStorage.setItem("runit-template-orders-v1", JSON.stringify([sessionId, second, unnamed].map((id) => ({
      sessionId: id, accessToken: token, templates: id === second ? ["mobile-app", "storefront"] : ["mobile-app"], createdAt: "2026-09-24T12:00:00.000Z",
    }))));
  }, { sessionId, token, second, unnamed });
  await page.route("**/api/templates/library/**", (route) => route.fulfill({ json: { templates: [{ id: "mobile-app", foundation: "APP_FOUNDATION" }] } }));
  await page.route("**/api/templates/ai/**", (route) => {
    const data = route.request().postDataJSON();
    requests.push(data);
    if (data.sessionId === unnamed) return route.fulfill({ status: 503, json: { error: "Temporarily unavailable" } });
    const name = data.sessionId === second ? "Pulse Deals" : "BoulderMe";
    const project = { brief: { name, idea: "A useful app", features: "", style: "", budget: "" }, revision: 1, appliedRevision: null, appliedPlan: null, appliedBrief: null, plan: { overview: "App overview", features: [{ part: "Core feature", description: "The primary app workflow." }], assumptions: [], questions: [] }, history: [] };
    return route.fulfill({ json: { available: true, state: { used: 0, remaining: 20, limit: 20, pending: false, projects: { "mobile-app": project, ...(data.sessionId === second ? { storefront: project } : {}) }, overviewUsed: ["mobile-app"] } } });
  });
  await page.goto("/templates/library/");
  const picker = page.getByLabel("Saved orders on this browser");
  await expect(picker.locator(`option[value="${sessionId}"]`)).toHaveText("BoulderMe");
  await expect(picker.locator(`option[value="${second}"]`)).toHaveText("Pulse Deals");
  await expect(picker.locator(`option[value="${unnamed}"]`)).toHaveText("Mobile app");
  await expect(picker).not.toContainText("2026-09-24");
  await expect(picker).not.toContainText("templates");
  expect(await picker.locator("option:not([disabled])").evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value))).toEqual([sessionId, second, unnamed]);
  await page.getByRole("tab", { name: "Plan", exact: true }).click();
  await page.getByText("App details & build mode", { exact: false }).click();
  await page.getByLabel("App name").fill("Boulder Club");
  await expect(picker.locator(`option[value="${sessionId}"]`)).toHaveText("Boulder Club");
  await expect(picker.locator(`option[value="${second}"]`)).toHaveText("Pulse Deals");
  await picker.selectOption(second);
  await expect(page.getByRole("heading", { level: 1, name: "Pulse Deals", exact: true })).toBeVisible();
  await expect(picker.locator(`option[value="${sessionId}"]`)).toHaveText("Boulder Club");
  await page.reload();
  await expect(picker.locator(`option[value="${sessionId}"]`)).toHaveText("Boulder Club");
  await expect(picker.locator(`option[value="${second}"]`)).toHaveText("Pulse Deals");
  expect(requests.every((request) => request.action === "load")).toBe(true);
});
