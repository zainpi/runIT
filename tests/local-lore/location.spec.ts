import { test, expect, type Page } from "@playwright/test";
const toronto = {
  id: "toronto",
  name: "Toronto",
  country: "Canada",
  center: { latitude: 43.655, longitude: -79.397 },
};
// Synthetic second-city metadata exercises selection without claiming live coverage.
const montreal = {
  id: "test-montreal",
  name: "Montreal",
  country: "Canada",
  center: { latitude: 45.5019, longitude: -73.5674 },
};
async function setup(page: Page, cities = [toronto]) {
  const posted: any[] = [];
  await page.route("**/local-lore/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "POST")
      posted.push(route.request().postDataJSON());
    const data = path.endsWith("/config")
      ? {
          ready: true,
          cities,
          recommendation: {
            city_id: "toronto",
            distance_km: 3400,
            source: "approximate",
          },
          coverage: ["daily", "around", "landmark"].flatMap((mode) =>
            [1, 3, 5, 10].map((radius) => ({ mode, radius, count: 5 })),
          ),
        }
      : path.endsWith("/history")
        ? { games: [], notes: [] }
        : { error: "Test stopped before creating a real game." };
    await route.fulfill({
      status: path.endsWith("/games") ? 503 : 200,
      contentType: "application/json",
      body: JSON.stringify(data),
    });
  });
  return posted;
}
test("approximate city is ready without requesting browser permission", async ({
  page,
}) => {
  await setup(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator.geolocation, "getCurrentPosition", {
      value: () => {
        throw Error("Unexpected permission request");
      },
    });
  });
  await page.goto("/local-lore/");
  await expect(page.locator("#city")).toHaveValue("toronto");
  await expect(page.locator("#city-status")).toContainText(
    "approximate network location",
  );
  await expect(page.locator("#city-status")).toContainText(
    "only available city",
  );
  await expect(page.locator("#start")).toBeEnabled();
  await expect(page.locator("#locate")).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/tmp/local-lore-location-phone.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
test("already allowed browser location chooses only supported cities and posts only the city", async ({
  page,
  context,
}) => {
  const posted = await setup(page);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 49.2827, longitude: -123.1207 });
  await page.goto("/local-lore/");
  await expect(page.locator("#city-status")).toContainText(
    "Selected using your browser location",
  );
  await expect(page.locator("#city")).toHaveValue("toronto");
  await expect(page.locator("#city option")).toHaveCount(1);
  await page.locator("#start").click();
  await expect(page.locator("#notice")).toContainText("Test stopped");
  expect(posted[0]).toEqual({
    city_id: "toronto",
    mode: "daily",
    radius: 3,
    request_id: expect.any(String),
  });
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual({});
});
test("browser location selects the nearest city from the available list", async ({
  page,
  context,
}) => {
  await setup(page, [toronto, montreal]);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 45.4215, longitude: -75.6972 });
  await page.goto("/local-lore/");
  await expect(page.locator("#city")).toHaveValue("test-montreal");
  await expect(page.locator("#city-status")).toContainText(
    "Montreal is your nearest available city",
  );
  await page.locator("#city").selectOption("toronto");
  await page.reload();
  await expect(page.locator("#city-status")).toHaveText(
    "Toronto · your selected city.",
  );
  await expect(page.locator("#city")).toHaveValue("toronto");
  await page.locator("#locate").click();
  await expect(page.locator("#city")).toHaveValue("test-montreal");
  expect(
    await page.evaluate(() => localStorage.getItem("local-lore-city")),
  ).toBeNull();
});
test("denied location and blocked storage still allow a game", async ({
  page,
}) => {
  await setup(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator.geolocation, "getCurrentPosition", {
      value: (_ok: unknown, fail: (e: unknown) => void) => fail({ code: 1 }),
    });
    Object.defineProperty(window, "localStorage", {
      get() {
        throw Error("Storage blocked");
      },
    });
  });
  await page.goto("/local-lore/");
  await page.locator("#locate").click();
  await expect(page.locator("#city-status")).toContainText(
    "Location access is off",
  );
  await expect(page.locator("#start")).toBeEnabled();
  await expect(page.locator("#locate")).toBeEnabled();
});
test("a stalled location request times out without blocking play", async ({
  page,
}) => {
  await setup(page);
  await page.clock.install();
  await page.addInitScript(() => {
    Object.defineProperty(navigator.geolocation, "getCurrentPosition", {
      value: () => {},
    });
  });
  await page.goto("/local-lore/");
  await page.locator("#locate").click();
  await expect(page.locator("#start")).toBeEnabled();
  await page.clock.fastForward(12001);
  await expect(page.locator("#city-status")).toContainText(
    "We couldn’t get your location",
  );
  await expect(page.locator("#locate")).toBeEnabled();
});
test("a late location result cannot replace a manual city choice", async ({
  page,
}) => {
  await setup(page, [toronto, montreal]);
  await page.addInitScript(() => {
    Object.defineProperty(navigator.geolocation, "getCurrentPosition", {
      value: (ok: (p: unknown) => void) => {
        (window as any).finishLocation = ok;
      },
    });
  });
  await page.goto("/local-lore/");
  await page.locator("#locate").click();
  await page.locator("#city").selectOption("test-montreal");
  await page.evaluate(() =>
    (window as any).finishLocation({
      coords: { latitude: 43.655, longitude: -79.397 },
    }),
  );
  await expect(page.locator("#city")).toHaveValue("test-montreal");
  await expect(page.locator("#city-status")).toHaveText(
    "Montreal · your selected city.",
  );
});
