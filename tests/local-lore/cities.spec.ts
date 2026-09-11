import { test, expect } from "@playwright/test";
import { SUPPORTED_CITIES } from "../../public/local-lore/cities.mjs";
import { CATALOG } from "../../src/lib/local-lore/live/catalog.mjs";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#d7e1dc"/><path d="M0 240H640M320 0V480" stroke="white" stroke-width="25"/></svg>`;
for (const city of SUPPORTED_CITIES.filter((c) => c.id !== "toronto")) {
  test(`${city.name} starts, pans, scores and resumes in the selected city`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const errors: string[] = [],
      maps: URL[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const target = CATALOG.filter(
      (c) => c.city_id === city.id && c.type === "landmark",
    ).sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0))[0];
    const id = "00000000-0000-4000-8000-000000000001";
    const rid = "00000000-0000-4000-8000-000000000002";
    let started = false,
      answered = false,
      guess: any;
    const result = () => ({
      score: 638,
      maximum: 1000,
      correct: false,
      method: "pin",
      distance_m: 500,
      assisted: false,
      label: target.label,
      name: target.name,
      note: target.note,
      point: { latitude: target.latitude, longitude: target.longitude },
    });
    const game = () => ({
      id,
      city_id: city.id,
      city: city.name,
      center: city.center,
      bounds: city.bounds,
      map_zoom: 13,
      mode: "landmark",
      radius: 3,
      day: "2026-09-11",
      total_rounds: 3,
      complete: false,
      rounds: [
        { id: rid, ordinal: 1, result: answered ? result() : null },
        { id: rid.replace(/2$/, "3"), ordinal: 2, result: null },
        { id: rid.replace(/2$/, "4"), ordinal: 3, result: null },
      ],
      current: {
        id: answered ? rid.replace(/2$/, "3") : rid,
        ordinal: answered ? 2 : 1,
        prompt: `Find ${target.name} on the map.`,
        clue_used: false,
        scene_url: `/local-lore/api/games/${id}/rounds/${rid}/scene`,
      },
    });
    await page.route("**/local-lore/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      const json = (data: unknown) =>
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(data),
        });
      if (path.endsWith("/config"))
        return json({
          ready: true,
          cities: SUPPORTED_CITIES.map((c) => ({
            ...c,
            coverage: ["daily", "around", "landmark"].flatMap((mode) =>
              [1, 3, 5, 10].map((radius) => ({
                mode,
                radius,
                count: CATALOG.filter(
                  (t) =>
                    t.city_id === c.id &&
                    t.type ===
                      (mode === "landmark" ? "landmark" : "intersection"),
                ).length,
              })),
            ),
          })),
          recommendation: { city_id: "toronto", source: "default" },
        });
      if (path.endsWith("/history"))
        return json({
          games: started
            ? [
                {
                  id,
                  city: city.name,
                  city_id: city.id,
                  mode: "landmark",
                  day: "2026-09-11",
                  completed: answered ? 1 : 0,
                  score: answered ? 638 : 0,
                },
              ]
            : [],
          notes: [],
        });
      if (path.endsWith("/games")) {
        expect(route.request().postDataJSON().city_id).toBe(city.id);
        started = true;
        return json(game());
      }
      if (path.endsWith("/map")) {
        maps.push(new URL(route.request().url()));
        return route.fulfill({ contentType: "image/svg+xml", body: svg });
      }
      if (path.endsWith("/scene"))
        return route.fulfill({ contentType: "image/svg+xml", body: svg });
      if (path.endsWith("/guess")) {
        guess = route.request().postDataJSON();
        answered = true;
        return json({ game: game(), result: result() });
      }
      return json(game());
    });
    await page.goto("/local-lore/");
    await page.locator("#city").selectOption(city.id);
    await expect(page.locator("#city-eyebrow")).toContainText(
      city.name.toUpperCase(),
    );
    await expect(page.locator("#area-note")).toContainText(city.area);
    await page.locator('input[value="landmark"]').check();
    await page.locator("#start").click();
    await expect(page.locator("#scene")).toBeVisible();
    await expect(page.locator("#round-meta")).toContainText(city.name);
    await page.locator("#view-map").click();
    await expect(page.locator("#map-image")).toBeVisible();
    expect(Number(maps[0].searchParams.get("lat"))).toBe(city.center.latitude);
    expect(Number(maps[0].searchParams.get("lng"))).toBe(city.center.longitude);
    await page.getByRole("button", { name: "Pan north", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Pan north", exact: true }),
    ).toBeEnabled();
    const moved = Number(maps.at(-1)!.searchParams.get("lat"));
    expect(moved).toBeGreaterThan(city.center.latitude);
    expect(moved).toBeLessThan(city.bounds.north);
    const box = (await page.locator("#map").boundingBox())!;
    await page
      .locator("#map")
      .click({ position: { x: box.width / 2, y: box.height / 2 } });
    await page.locator("#submit").click();
    await expect(page.locator("#reveal")).toBeVisible();
    expect(guess.pin.latitude).toBeGreaterThan(city.bounds.south);
    expect(guess.pin.latitude).toBeLessThan(city.bounds.north);
    expect(guess.pin.longitude).toBeGreaterThan(city.bounds.west);
    expect(guess.pin.longitude).toBeLessThan(city.bounds.east);
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBeLessThanOrEqual(845);
    await page.screenshot({ path: `/tmp/local-lore-${city.id}-result.png` });
    await page.locator("#leave").click();
    await expect(page.locator("#resume-list")).toContainText(city.name);
    await page.locator("#city").selectOption("toronto");
    await page
      .locator("#resume-list")
      .getByRole("button", { name: "Resume", exact: true })
      .click();
    await expect(page.locator("#round-meta")).toContainText(city.name);
    await expect(page.locator("#round-meta")).toContainText("ROUND 2");
    expect(errors).toEqual([]);
  });
}

test("a delayed map cannot overwrite a newly selected city's map", async ({
  page,
}) => {
  const firstId = "00000000-0000-4000-8000-000000000011";
  const secondId = "00000000-0000-4000-8000-000000000012";
  let starts = 0,
    releaseFirst: () => void = () => {};
  const waiting = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const coverage = ["daily", "around", "landmark"].flatMap((mode) =>
    [1, 3, 5, 10].map((radius) => ({ mode, radius, count: 5 })),
  );
  await page.route("**/local-lore/api/**", async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname;
    const json = (data: unknown) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (path.endsWith("/config"))
      return json({
        ready: true,
        cities: SUPPORTED_CITIES.map((c) => ({ ...c, coverage })),
        recommendation: { city_id: "toronto", source: "default" },
      });
    if (path.endsWith("/history")) return json({ games: [], notes: [] });
    if (path.endsWith("/games")) {
      const city = SUPPORTED_CITIES.find(
        (c) => c.id === route.request().postDataJSON().city_id,
      )!;
      const id = ++starts === 1 ? firstId : secondId;
      return json({
        id,
        city_id: city.id,
        city: city.name,
        center: city.center,
        bounds: city.bounds,
        map_zoom: 13,
        mode: "daily",
        radius: 3,
        day: "2026-09-11",
        total_rounds: 3,
        rounds: [],
        complete: false,
        current: {
          id,
          ordinal: 1,
          prompt: "Pin the intersection shown.",
          clue_used: false,
          scene_url: `/local-lore/api/games/${id}/rounds/${id}/scene`,
        },
      });
    }
    if (path.endsWith("/map") && path.includes(firstId)) await waiting;
    await route.fulfill({ contentType: "image/svg+xml", body: svg });
  });
  try {
    await page.goto("/local-lore/");
    await page.locator("#start").click();
    await expect(page.locator("#scene")).toBeVisible();
    await page.locator("#leave").click();
    await page.locator("#city").selectOption("vancouver");
    await page.locator("#start").click();
    await expect(page.locator("#round-meta")).toContainText("Vancouver");
    await expect(page.locator("#map-image")).toBeVisible();
    const current = await page.locator("#map-image").getAttribute("src");
    const response = page.waitForResponse(
      (r) => r.url().includes(firstId) && r.url().includes("/map?"),
    );
    releaseFirst();
    await (await response).finished();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expect(page.locator("#map-image")).toHaveAttribute("src", current!);
  } finally {
    releaseFirst();
  }
});
