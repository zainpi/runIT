import test from "node:test";
import assert from "node:assert/strict";
import { createDatabase } from "./sqlite.mjs";
import { handleLocalLore, cleanupLocalLore } from "../../src/lib/local-lore/live/api.mjs";
import { CATALOG } from "../../src/lib/local-lore/live/catalog.mjs";
import {
  score,
  acceptedName,
  distance,
  torontoDay,
  eligible,
} from "../../src/lib/local-lore/live/rules.mjs";
import { project, unproject } from "../../public/local-lore/map-math.mjs";
const origin = "https://runsit.ca";
function harness(limit = 250) {
  const db = createDatabase(),
    calls = [];
  const env = {
    LOCAL_LORE_DB: db,
    LOCAL_LORE_GOOGLE_MAPS_API_KEY: "test-secret-never-public",
    LOCAL_LORE_IMAGE_DAILY_LIMIT: String(limit),
  };
  let cookie = "";
  const fakeFetch = async (url) => {
    calls.push(String(url));
    const u = new URL(url);
    if (u.pathname.endsWith("metadata")) {
      let point = u.searchParams.get("location")?.split(",").map(Number);
      if (!point) {
        const c = CATALOG.find(
          (c) => c.id === u.searchParams.get("pano")?.replace(/^pano-/, ""),
        );
        point = [c.latitude, c.longitude];
      }
      const closest = CATALOG.reduce((a, c) =>
        distance({ latitude: point[0], longitude: point[1] }, c) <
        distance({ latitude: point[0], longitude: point[1] }, a)
          ? c
          : a,
      );
      return Response.json({
        status: "OK",
        pano_id: "pano-" + closest.id,
        location: { lat: point[0], lng: point[1] },
      });
    }
    return new Response(new Uint8Array([1, 2, 3]), {
      headers: { "Content-Type": "image/jpeg" },
    });
  };
  return {
    db,
    env,
    calls,
    async request(path, body, headers = {}) {
      const response = await handleLocalLore(
        new Request(origin + "/local-lore/api" + path, {
          method: body ? "POST" : "GET",
          headers: {
            cookie,
            origin,
            "Content-Type": "application/json",
            ...headers,
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        }),
        env,
        { fetch: fakeFetch },
      );
      if (response.headers.has("set-cookie"))
        cookie = response.headers.get("set-cookie").split(";")[0];
      const data = response.headers.get("content-type").includes("json")
        ? await response.json()
        : null;
      return { response, data };
    },
    async start(mode = "around", radius = 3, request_id = crypto.randomUUID()) {
      return this.request("/games", { mode, radius, request_id });
    },
    async target(round) {
      const r = await db
        .prepare("SELECT target_id FROM ll_rounds WHERE id=?")
        .bind(round.id)
        .first();
      return CATALOG.find((c) => c.id === r.target_id);
    },
  };
}
test("map projection is reversible at all supported zooms and Toronto date respects midnight", () => {
  for (let zoom = 11; zoom <= 17; zoom++) {
    const center = { latitude: 43.655, longitude: -79.397 },
      point = { latitude: 43.65, longitude: -79.39 },
      pixel = project(point, center, zoom);
    assert.ok(
      distance(point, unproject(pixel.x, pixel.y, center, zoom)) < 0.001,
    );
  }
  assert.equal(torontoDay(new Date("2026-09-10T03:59:00Z")), "2026-09-09");
  assert.equal(torontoDay(new Date("2026-09-10T04:00:00Z")), "2026-09-10");
});
test("named aliases, explicit direction errors, pin distances and clue penalty", () => {
  const t = CATALOG[0];
  assert.ok(acceptedName(t, "Spadina & Queen"));
  assert.ok(acceptedName(t, "Spadina Ave x Queen St W"));
  assert.ok(!acceptedName(t, "Queen East & Spadina"));
  assert.ok(!acceptedName(t, "Queen"));
  assert.equal(score(t, { method: "named", text: t.label }, false).score, 1000);
  assert.equal(score(t, { method: "named", text: t.label }, true).score, 800);
  assert.equal(score(t, { method: "pin", pin: t }, true).score, 800);
  assert.equal(
    score(
      t,
      {
        method: "pin",
        pin: { latitude: t.latitude + 0.02, longitude: t.longitude },
      },
      false,
    ).score,
    0,
  );
  assert.ok(eligible(CATALOG, "landmark", 3).length >= 3);
});
test("three rounds save authoritatively, hide future answers and survive reload", async (t) => {
  const h = harness();
  t.after(() => h.db.close());
  let { data: g } = await h.start();
  const startId = g.id;
  assert.equal(g.rounds.length, 3);
  assert.equal(g.current.point, undefined);
  assert.equal(g.current.target_id, undefined);
  assert.equal(g.rounds[1].result, null);
  assert.equal(JSON.stringify(g).includes("test-secret"), false);
  const future = await h.request(
    `/games/${g.id}/rounds/${g.rounds[1].id}/guess`,
    { method: "skip" },
  );
  assert.equal(future.response.status, 409);
  for (let i = 0; i < 3; i++) {
    const target = await h.target(g.current);
    const path = `/games/${g.id}/rounds/${g.current.id}/guess`;
    const answer = await h.request(path, {
      method: "named",
      text: target.label,
      score: 999999,
      assisted: false,
    });
    assert.equal(answer.data.result.score, 1000);
    const duplicate = await h.request(path, { method: "skip" });
    assert.deepEqual(duplicate.data.result, answer.data.result);
    g = answer.data.game;
  }
  assert.equal(g.complete, true);
  assert.equal((await h.request("/games/" + startId)).data.complete, true);
  const hist = (await h.request("/history")).data;
  assert.equal(hist.games[0].score, 3000);
  assert.equal(hist.notes.length, 3);
  const foreign = await h.request("/games/" + g.id, undefined, {
    cookie: "ll_player=" + crypto.randomUUID(),
  });
  assert.equal(foreign.response.status, 404);
});
test("daily has one attempt per player/day and clues cannot be forged", async (t) => {
  const h = harness();
  t.after(() => h.db.close());
  const { data: g } = await h.start("daily");
  const replay = await h.start("daily");
  assert.equal(replay.data.id, g.id);
  const clue = await h.request(
    `/games/${g.id}/rounds/${g.current.id}/clue`,
    {},
  );
  assert.equal(clue.response.status, 403);
  const { data: p } = await h.start();
  const path = `/games/${p.id}/rounds/${p.current.id}`;
  await h.request(path + "/clue", {});
  const target = await h.target(p.current);
  const answer = await h.request(path + "/guess", {
    method: "pin",
    pin: target,
    assisted: false,
    score: 1000,
  });
  assert.equal(answer.data.result.score, 800);
  assert.equal(answer.data.result.assisted, true);
});
test("idempotent starts and concurrent guesses never create duplicate credit", async (t) => {
  const h = harness();
  t.after(() => h.db.close());
  const key = crypto.randomUUID();
  const first = await h.start("around", 3, key);
  const again = await h.start("around", 3, key);
  assert.equal(first.data.id, again.data.id);
  const g = first.data,
    path = `/games/${g.id}/rounds/${g.current.id}/guess`,
    target = await h.target(g.current);
  const answers = await Promise.all([
    h.request(path, { method: "named", text: target.label }),
    h.request(path, { method: "skip" }),
  ]);
  assert.deepEqual(answers[0].data.result, answers[1].data.result);
});
test("Google images stream without cache; only pano identifiers persist and global budget blocks repeat cost", async (t) => {
  const h = harness(2);
  t.after(() => h.db.close());
  const { data: g } = await h.start();
  const path = `/games/${g.id}/rounds/${g.current.id}/scene`;
  for (let i = 0; i < 2; i++) {
    const r = await h.request(path);
    assert.equal(r.response.status, 200);
    assert.match(r.response.headers.get("Cache-Control"), /no-store/);
    assert.match(r.response.headers.get("CDN-Cache-Control"), /no-store/);
  }
  const blocked = await h.request(path);
  assert.equal(blocked.response.status, 429);
  assert.equal(h.calls.filter((u) => !u.includes("metadata")).length, 2);
  assert.ok(h.calls.some((u) => u.includes("metadata?pano=")));
  const pano = await h.db.prepare("SELECT * FROM ll_panoramas").first();
  assert.deepEqual(Object.keys(pano).sort(), [
    "checked_at",
    "pano_id",
    "target_id",
  ]);
});
test("CSRF, invalid map coordinates, future photos, invalid pins and unconfigured key fail safely", async (t) => {
  const h = harness();
  t.after(() => h.db.close());
  const csrf = await h.request(
    "/games",
    { mode: "around", radius: 3, request_id: crypto.randomUUID() },
    { origin: "https://evil.example" },
  );
  assert.equal(csrf.response.status, 403);
  const { data: g } = await h.start();
  assert.equal(
    (await h.request(`/games/${g.id}/map?lat=0&lng=0`)).response.status,
    400,
  );
  assert.equal(
    (await h.request(`/games/${g.id}/rounds/${g.rounds[1].id}/scene`)).response
      .status,
    409,
  );
  assert.equal(
    (
      await h.request(`/games/${g.id}/rounds/${g.current.id}/guess`, {
        method: "pin",
        pin: { latitude: 0, longitude: 0 },
      })
    ).response.status,
    400,
  );
  assert.equal(h.calls.length, 0);
  h.env.LOCAL_LORE_GOOGLE_MAPS_API_KEY = "";
  assert.equal((await h.start()).response.status, 503);
});
test("expiry removes old games and their rounds", async (t) => {
  const h = harness();
  t.after(() => h.db.close());
  const { data: g } = await h.start();
  await h.db
    .prepare("UPDATE ll_games SET created_at=0 WHERE id=?")
    .bind(g.id)
    .run();
  await cleanupLocalLore(h.env);
  assert.equal(
    (await h.db.prepare("SELECT COUNT(*) AS n FROM ll_rounds").first()).n,
    0,
  );
});

test('default provider fetch keeps the native global receiver', async (t) => {
  const h = harness();
  const nativeFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = nativeFetch; h.db.close(); });
  const started = await h.start();
  globalThis.fetch = async function () {
    assert.equal(this, undefined, 'Native Workers fetch cannot be called as a context method');
    return new Response(new Uint8Array([1,2,3]), {headers:{'Content-Type':'image/png'}});
  };
  const cookie = started.response.headers.get('set-cookie').split(';')[0];
  const response = await handleLocalLore(new Request(`${origin}/local-lore/api/games/${started.data.id}/map`, {headers:{cookie}}), h.env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/png');
});
