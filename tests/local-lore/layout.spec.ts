import { test, expect } from "@playwright/test";
import { project } from "../../public/local-lore/map-math.mjs";
const center = { latitude: 43.655, longitude: -79.397 };
const gameId = "00000000-0000-4000-8000-000000000001";
const svg = (width: number, height: number, label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#d7e1dc"/><path d="M0 110H640M0 260H640M120 0V480M400 0V480" stroke="#fff" stroke-width="25"/><text x="20" y="50" font-size="24" fill="#173229">${label} · layout test</text><text x="20" y="${height - 15}" font-size="12" fill="#173229">Attribution area</text></svg>`;
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1280, height: 600 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
]) {
  test(`pin-only game fits ${viewport.width} × ${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let mapLoads = 0,
      ordinal = 1,
      clueUsed = false,
      lastGuess: any;
    const rounds = [1, 2, 3].map((n) => ({
      id: `00000000-0000-4000-8000-00000000000${n + 1}`,
      ordinal: n,
      result: null as any,
    }));
    const game = () => ({
      id: gameId,
      mode: "landmark",
      radius: 3,
      day: "2026-09-11",
      total_rounds: 3,
      center,
      map_zoom: 13,
      rounds,
      complete: ordinal > 3,
      current:
        ordinal > 3
          ? null
          : {
              id: rounds[ordinal - 1].id,
              ordinal,
              type: "landmark",
              prompt: "Find Art Gallery of Ontario on the map.",
              clue_used: false,
              scene_url: `/local-lore/api/games/${gameId}/rounds/${rounds[ordinal - 1].id}/scene`,
            },
    });
    await page.route("**/local-lore/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      const json = (value: unknown) =>
        route.fulfill({
          contentType: "application/json",
          body: JSON.stringify(value),
        });
      if (path.endsWith("/config"))
        return json({
          ready: true,
          coverage: ["daily", "around", "landmark"].flatMap((mode) =>
            [1, 3, 5, 10].map((radius) => ({ mode, radius, count: 5 })),
          ),
        });
      if (path.endsWith("/history")) return json({ games: [], notes: [] });
      if (path.endsWith("/scene"))
        return route.fulfill({
          contentType: "image/svg+xml",
          body: svg(640, 400, "Street photo"),
        });
      if (path.endsWith("/map")) {
        mapLoads++;
        return route.fulfill({
          contentType: "image/svg+xml",
          body: svg(640, 480, "Toronto map"),
        });
      }
      if (path.endsWith("/clue")) {
        clueUsed = true;
        return json({ clue: "Look near Dundas Street West." });
      }
      if (path.endsWith("/guess")) {
        lastGuess = route.request().postDataJSON();
        const result = {
          score: clueUsed ? 800 : 1000,
          maximum: 1000,
          correct: true,
          method: lastGuess.method,
          distance_m: 0,
          assisted: clueUsed,
          label: "Dundas Street West",
          name: "Art Gallery of Ontario",
          note: "A saved place.",
          point: center,
        };
        rounds[ordinal - 1].result = result;
        ordinal++;
        clueUsed = false;
        return json({ result, game: game() });
      }
      return json(game());
    });
    await page.goto("/local-lore/");
    await page.locator('input[value="landmark"]').check();
    await page.locator("#start").click();
    await expect(page.locator("#scene")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Name it", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator("input#answer")).toHaveCount(0);
    if (viewport.width <= 760) await page.locator("#view-map").click();
    await expect(page.locator("#map-image")).toBeVisible();
    const frame = await page.locator("#map").boundingBox();
    expect(frame).not.toBeNull();
    expect(frame!.height).toBeGreaterThan(120);
    expect(Math.abs(frame!.width / frame!.height - 4 / 3)).toBeLessThan(0.01);
    await page.locator("#map").evaluate((el) =>
      el.addEventListener(
        "click",
        (event) => {
          const click = event as MouseEvent;
          const box = el.getBoundingClientRect();
          el.setAttribute(
            "data-test-click-x",
            String(((click.clientX - box.left) / box.width) * 100),
          );
          el.setAttribute(
            "data-test-click-y",
            String(((click.clientY - box.top) / box.height) * 100),
          );
        },
        { once: true },
      ),
    );
    await page
      .locator("#map")
      .click({ position: { x: frame!.width / 2, y: frame!.height / 2 } });
    const clickPoint = await page
      .locator("#map")
      .evaluate((el) => ({
        x: Number(el.getAttribute("data-test-click-x")),
        y: Number(el.getAttribute("data-test-click-y")),
      }));
    await expect(page.locator("#submit")).toBeEnabled();
    const assertFits = async (selector: string) => {
      const box = await page.locator(selector).boundingBox();
      expect(box, selector).not.toBeNull();
      expect(box!.y + box!.height, selector + " bottom").toBeLessThanOrEqual(
        viewport.height + 1,
      );
      expect(box!.x + box!.width, selector + " right").toBeLessThanOrEqual(
        viewport.width + 1,
      );
    };
    await assertFits("#submit");
    await assertFits("#map");
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBeLessThanOrEqual(viewport.height + 1);
    await page.screenshot({
      path: `/tmp/local-lore-${viewport.width}-play.png`,
    });
    await page.locator("#map-help summary").click();
    await expect(page.locator(".help-content")).toBeVisible();
    await assertFits(".help-content");
    await page.locator("#map-help summary").click();
    await page.locator("#clue").click();
    await expect(page.locator("#clue-box")).toBeVisible();
    await assertFits("#submit");
    await page.locator("#submit").click();
    await expect(page.locator("#reveal")).toBeVisible();
    expect(lastGuess.method).toBe("pin");
    expect(lastGuess.text).toBeUndefined();
    const submittedPoint = project(lastGuess.pin, center, 13);
    expect(submittedPoint.x).toBeCloseTo(clickPoint.x, 7);
    expect(submittedPoint.y).toBeCloseTo(clickPoint.y, 7);
    await assertFits("#next");
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBeLessThanOrEqual(viewport.height + 1);
    expect((await page.locator("#map").boundingBox())!.height).toBeGreaterThan(
      120,
    );
    await page.screenshot({
      path: `/tmp/local-lore-${viewport.width}-reveal.png`,
    });
    await page.locator("#next").click();
    await expect(page.locator("#round-meta")).toContainText("ROUND 2");
    if (viewport.width <= 760) await page.locator("#view-map").click();
    await expect(page.locator("#map-image")).toBeVisible();
    expect(mapLoads).toBe(1);
    await expect(page.locator("#submit")).toBeDisabled();
    expect(errors).toEqual([]);
  });
}
