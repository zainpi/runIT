import { expect, test } from "@playwright/test";
import { templateCatalog } from "../../src/lib/templates/catalog";

test.use({ javaScriptEnabled: false });

for (const template of templateCatalog) {
  test(`${template.title} is useful and indexable without JavaScript`, async ({ page }) => {
    const path = `/templates/${template.id}/`;
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText(`${template.title} AI template`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://runsit.ca${path}`);
    await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("link", { name: "Choose this template" })).toHaveAttribute("href", `/templates/#${template.id}`);

    const blocks = (await page.locator('script[type="application/ld+json"]').allTextContents()).map((text) => JSON.parse(text));
    const nodes = blocks.flatMap((block) => block["@graph"] ?? [block]);
    const product = nodes.find((node) => node["@type"] === "Product");
    expect(product.offers.price).toBe("9.99");
    expect(product.offers.priceCurrency).toBe("CAD");
    await expect(page.getByText("$9.99 CAD", { exact: true })).toBeVisible();
    await expect(page.getByText(product.description, { exact: true })).toBeVisible();
    const faq = nodes.find((node) => node["@type"] === "FAQPage");
    expect(faq.mainEntity.length).toBeGreaterThanOrEqual(4);
    for (const question of faq.mainEntity) {
      await expect(page.getByRole("heading", { name: question.name, exact: true })).toBeVisible();
      await expect(page.getByText(question.acceptedAnswer.text, { exact: true })).toBeVisible();
    }
    const breadcrumb = nodes.find((node) => node["@type"] === "BreadcrumbList");
    expect(breadcrumb.itemListElement.at(-1).item).toBe(product.url);
  });
}

test("the homepage and store link to every public template page", async ({ page }) => {
  for (const path of ["/", "/templates/"]) {
    await page.goto(path);
    for (const { id } of templateCatalog) {
      await expect(page.locator(`a[href="/templates/${id}/"]`).first()).toBeVisible();
    }
  }
});

test("the sitemap discovers templates and robots excludes private areas", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  const xml = await sitemap.text();
  for (const { id } of templateCatalog) expect(xml).toContain(`<loc>https://runsit.ca/templates/${id}/</loc>`);
  for (const path of ["/templates/library", "/templates/trial", "/neutronium", "/the-last-echo/admin"]) expect(xml).not.toContain(path);
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  const policy = await robots.text();
  expect(policy).toMatch(/User-Agent: \*\s+Allow: \//i);
  for (const path of ["/api/", "/templates/library", "/templates/trial", "/neutronium", "/the-last-echo/admin"]) expect(policy).toContain(`Disallow: ${path}`);
});

test("USD content and structured prices agree on the US hostname", async ({ request }) => {
  const response = await request.get("/templates/mobile-app/", { headers: { Host: "runs-it.com" } });
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain("$9.99 USD");
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((match) => JSON.parse(match[1]));
  const product = blocks.flatMap((block) => block["@graph"] ?? [block]).find((node) => node["@type"] === "Product");
  expect(product.offers.priceCurrency).toBe("USD");
  expect(product.offers.price).toBe("9.99");
  expect(product.offers.url).toBe("https://runs-it.com/templates/#mobile-app");
});

test("unknown template slugs return a real 404", async ({ request }) => {
  const response = await request.get("/templates/not-a-template/");
  expect(response.status()).toBe(404);
});

test("the guide remains readable on mobile without JavaScript", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/templates/mobile-app/");
  await expect(page.getByRole("heading", { name: "Mobile app AI template", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Choose this template" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.screenshot({ path: "/tmp/runit-template-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload();
  await page.screenshot({ path: "/tmp/runit-template-desktop.png", fullPage: true });
});

test.describe("store navigation", () => {
  test.use({ javaScriptEnabled: true });
  test("visiting a guide preserves the buyer’s saved selection", async ({ page }) => {
    await page.route("**/api/templates/config/**", (route) => route.fulfill({
      json: { available: true, testMode: true, currency: "cad", appIconAvailable: false },
    }));
    await page.goto("/templates/mobile-app/");
    await page.getByRole("link", { name: "Choose this template" }).click();
    await page.getByRole("button", { name: "Add Mobile app", exact: true }).click();
    await expect(page.getByRole("button", { name: "Remove Mobile app", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Explore the mobile app template" }).click();
    await expect(page.locator("h1")).toHaveText("Mobile app AI template");
    await page.getByRole("link", { name: "Choose this template" }).click();
    await expect(page.getByRole("button", { name: "Remove Mobile app", exact: true })).toBeVisible();
  });
});
