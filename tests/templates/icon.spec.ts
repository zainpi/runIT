import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const sessionId = "cs_test_1234567890abcdef", token = "ab".repeat(32);
const brief = { name: "Climb", idea: "Find climbing partners.", style: "" };

test("icon supports three updates, browsing earlier versions, return visits and downloading the selected PNG", async ({ page }) => {
  const png = await readFile("tests/templates/fixtures/icon.png");
  const images: { id: string; number: number; base64: string; fileName: string; createdAt: string; templateId: string; brief: typeof brief; baseVersion?: string }[] = [];
  let status = "ready", generations = 0, available = true;
  await page.route("**/api/templates/library/**", (route) => route.fulfill({ json: { templates: [{ id: "mobile-app", foundation: "FOUNDATION" }], appIcon: true } }));
  await page.route("**/api/templates/ai/**", (route) => route.fulfill({ json: { available: false, state: null } }));
  const snapshot = (versionId?: string) => ({ status, updatesRemaining: Math.max(0, 4 - Math.max(1, images.length)), canGenerate: status !== "deleted" && images.length < 4, versions: images.map(({ base64: _base64, ...version }) => version), image: versionId ? images.find((image) => image.id === versionId) : images.at(-1) });
  await page.route("**/api/templates/icon/**", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.sessionId).toBe(sessionId);
    expect(body.accessToken).toBe(token);
    if (body.action === "download") {
      const image = images.find((image) => image.id === body.versionId)!;
      return route.fulfill({ contentType: "image/png", headers: { "Content-Disposition": `attachment; filename="${image.fileName}"` }, body: png });
    }
    if (body.action === "generate") {
      generations++;
      expect(body.brief.name).toBe("Climb");
      expect(body.consent).toBe(true);
      expect(body).not.toHaveProperty("model");
      if (generations === 1) {
        expect(body.direction).toBe("A mountain silhouette in green");
        expect(body.baseVersion).toBeUndefined();
      } else {
        expect(body.direction).toBe(`Change ${generations}`);
        expect(body.baseVersion, "updates can use an earlier version").toBe(images[0].id);
      }
      images.push({ id: body.requestId, number: generations, base64: png.toString("base64"), fileName: `climb-icon-v${generations}.png`, createdAt: new Date().toISOString(), templateId: "mobile-app", brief, baseVersion: body.baseVersion });
      status = "complete";
      if (generations === 2) return route.abort("failed"); // The update saves, but its HTTP response is lost.
      return route.fulfill({ status: 202, json: { available, state: { ...snapshot(), status: "pending", canGenerate: false } } });
    }
    if (body.action === "delete") { status = "deleted"; images.length = 0; }
    return route.fulfill({ json: { available, state: snapshot(body.versionId) } });
  });
  await page.goto(`/templates/library/#session_id=${sessionId}&access=${token}`);
  const section = page.getByRole("region", { name: "Create app icon", exact: true });
  const generate = section.getByRole("button", { name: "Generate app icon", exact: true });
  await expect(generate).toBeDisabled();
  await page.getByLabel("App name").fill("Climb");
  await page.getByLabel("What do you want to make?").fill(brief.idea);
  await section.getByLabel("Icon direction").fill("A mountain silhouette in green");
  await section.getByLabel("Use OpenAI to create or update my icon").check();
  await generate.click();
  await expect(section.getByRole("status")).toContainText("Creating your icon");
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await expect(section.getByRole("img", { name: "Your app icon, version 1", exact: true })).toBeVisible();
  await expect(section).toContainText("3 updates remaining");
  expect(generations).toBe(1);
  await section.getByLabel("Use OpenAI to create or update my icon").check();
  for (const number of [2, 3, 4]) {
    await section.getByRole("button", { name: "Version 1 · Original", exact: true }).click();
    await expect(section.getByRole("img", { name: "Your app icon, version 1", exact: true })).toBeVisible();
    const update = section.getByRole("button", { name: "Update selected icon" });
    await expect(update).toBeDisabled();
    await section.getByLabel("What should change?").fill(`Change ${number}`);
    await update.click();
    if (number === 2) {
      await expect(section.getByRole("alert")).toBeVisible();
      await expect(update).toBeDisabled();
      await section.getByRole("button", { name: "Refresh icon status" }).click();
      expect(generations).toBe(2);
    } else {
      await expect(section.getByRole("status")).toContainText("Creating your icon");
      await expect(section.getByRole("status")).toHaveCount(0, { timeout: 10000 });
    }
    await expect(section.getByRole("img", { name: `Your app icon, version ${number}`, exact: true })).toBeVisible();
  }
  await expect(section).toContainText("All 3 updates used");
  await expect(section.getByRole("button", { name: "Update selected icon" })).toHaveCount(0);
  expect(generations).toBe(4);
  available = false;
  await page.reload();
  await expect(section.getByRole("group", { name: "Icon versions" }).getByRole("button")).toHaveCount(4);
  await section.getByRole("button", { name: "Version 1 · Original", exact: true }).click();
  await expect(section.getByRole("img", { name: "Your app icon, version 1", exact: true })).toBeVisible();
  await section.screenshot({ path: "/tmp/runit-app-icon-desktop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await section.screenshot({ path: "/tmp/runit-app-icon-mobile.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const downloadPromise = page.waitForEvent("download");
  await section.getByRole("button", { name: "Download version 1" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("climb-icon-v1.png");
  expect(await readFile((await download.path())!)).toEqual(png);
  await section.getByRole("button", { name: "Delete saved icons" }).click();
  await section.getByRole("button", { name: "Confirm delete icons" }).click();
  await expect(section).toContainText("Your saved icons were deleted");
  await expect(section.getByRole("img")).toHaveCount(0);
});

test("forged local icon purchase is ignored and changing orders clears the saved preview", async ({ page }) => {
  const png = await readFile("tests/templates/fixtures/icon.png");
  const secondId = "cs_test_fedcba0987654321";
  await page.addInitScript(({ sessionId, secondId, token }) => {
    localStorage.setItem("runit-template-orders-v1", JSON.stringify([
      { sessionId, accessToken: token, templates: ["mobile-app"], appIcon: true, createdAt: "2026-09-23" },
      { sessionId: secondId, accessToken: token, templates: ["mobile-app"], appIcon: true, createdAt: "2026-09-22" },
    ]));
  }, { sessionId, secondId, token });
  await page.route("**/api/templates/library/**", (route) => route.fulfill({ json: { templates: [{ id: "mobile-app", foundation: "FOUNDATION" }], appIcon: route.request().postDataJSON().sessionId === sessionId } }));
  await page.route("**/api/templates/ai/**", (route) => route.fulfill({ json: { available: false, state: null } }));
  const version = { id: "00000000-0000-4000-8000-000000000001", number: 1, fileName: "icon.png", createdAt: "2026-09-23", templateId: "mobile-app", brief };
  await page.route("**/api/templates/icon/**", (route) => route.fulfill({ json: { available: false, state: { status: "complete", canGenerate: true, updatesRemaining: 3, versions: [version], image: { ...version, base64: png.toString("base64") } } } }));
  await page.goto(`/templates/library/#session_id=${sessionId}&access=${token}`);
  await expect(page.getByRole("img", { name: "Your app icon, version 1" })).toBeVisible();
  await page.getByLabel("Saved orders on this browser").selectOption(secondId);
  await expect(page.getByRole("region", { name: "Create app icon", exact: true })).toHaveCount(0);
  await expect(page.getByRole("img", { name: "Your app icon, version 1" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Download version 1" })).toHaveCount(0);
});

test("a saved icon add-on can be removed when image generation is unavailable", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("runit-template-brief-v1", JSON.stringify({ selected: ["mobile-app"], appIcon: true })));
  await page.route("**/api/templates/config/**", (route) => route.fulfill({ json: { available: true, testMode: true, currency: "cad", appIconAvailable: false } }));
  await page.goto("/templates/");
  await expect(page.getByRole("button", { name: "App icon unavailable" })).toBeDisabled();
  await page.getByLabel("Create app icon", { exact: true }).uncheck();
  await expect(page.getByRole("button", { name: "Try test checkout" })).toBeEnabled();
  await expect(page.getByLabel("Create app icon", { exact: true })).toBeDisabled();
});
