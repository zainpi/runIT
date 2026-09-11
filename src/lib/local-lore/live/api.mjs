import { CATALOG } from "./catalog.mjs";
import { SUPPORTED_CITIES, approximateCity, cityById } from "./cities.mjs";
import {
  CENTER,
  RADII,
  MODES,
  RULES_VERSION,
  eligible,
  torontoDay,
  cityDay,
  mapZoom,
  score,
  distance,
  bearing,
} from "./rules.mjs";
const PREFIX = "/local-lore/api";
const COOKIE = "ll_player";
const DAY = 86400000;
const targets = new Map(CATALOG.map((c) => [c.id, c]));
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
class GameError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const fail = (message, status = 400) => {
  throw new GameError(message, status);
};
const id = () => crypto.randomUUID();
const digest = async (text) =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
const rows = async (stmt) => (await stmt.all()).results;
const now = () => Date.now();
function inputPoint(p, city) {
  if (
    !p ||
    typeof p.latitude !== "number" ||
    typeof p.longitude !== "number" ||
    !Number.isFinite(p.latitude) ||
    !Number.isFinite(p.longitude) ||
    p.latitude < city.bounds.south ||
    p.latitude > city.bounds.north ||
    p.longitude < city.bounds.west ||
    p.longitude > city.bounds.east
  )
    fail(`Choose a point on the ${city.name} map.`);
  return { latitude: p.latitude, longitude: p.longitude };
}
async function bodyOf(request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    fail("Send JSON.", 415);
  if (Number(request.headers.get("content-length") || 0) > 4096)
    fail("Request too large.", 413);
  const reader = request.body?.getReader();
  let text = "";
  const decoder = new TextDecoder();
  let bytes = 0;
  if (reader)
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > 4096) {
          await reader.cancel();
          fail("Request too large.", 413);
        }
        text += decoder.decode(value, { stream: true });
      }
    } finally {
      reader.releaseLock();
    }
  try {
    const value = JSON.parse(text);
    if (!value || Array.isArray(value) || typeof value !== "object")
      throw Error();
    return value;
  } catch {
    fail("Invalid request.");
  }
}
async function useLimit(db, bucket, limit, expires) {
  const result = await db
    .prepare(
      "INSERT INTO ll_usage(bucket,count,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 WHERE count < ? RETURNING count",
    )
    .bind(bucket, expires, limit)
    .first();
  if (!result)
    fail("The play limit has been reached. Please try again later.", 429);
}
function limits(env) {
  return {
    dailyImages: Math.min(
      10000,
      Math.max(1, Number(env.LOCAL_LORE_IMAGE_DAILY_LIMIT) || 250),
    ),
    playerImages: 48,
    playerGames: 12,
  };
}
async function imageAllowance(ctx) {
  const day = new Date().toISOString().slice(0, 10),
    expiration = now() + 2 * DAY;
  await useLimit(
    ctx.db,
    `image:player:${ctx.guest}:${day}`,
    limits(ctx.env).playerImages,
    expiration,
  );
  await useLimit(ctx.db, `image:ip:${ctx.ip}:${day}`, 96, expiration);
  await useLimit(
    ctx.db,
    `image:global:${day}`,
    limits(ctx.env).dailyImages,
    expiration,
  );
}
async function ownedGame(ctx, gameId) {
  const game = await ctx.db
    .prepare(
      "SELECT * FROM ll_games WHERE id=? AND guest_id=? AND created_at>?",
    )
    .bind(gameId, ctx.guest, now() - 90 * DAY)
    .first();
  if (!game) fail("This game is no longer available. Start a new set.", 404);
  const rounds = await rows(
    ctx.db
      .prepare("SELECT * FROM ll_rounds WHERE game_id=? ORDER BY ordinal")
      .bind(gameId),
  );
  return { game, rounds };
}
async function viewGame(ctx, gameId) {
  const { game, rounds } = await ownedGame(ctx, gameId),
    city = cityById(game.city_id),
    current = rounds.find((r) => !r.result_json);
  return {
    id: game.id,
    city_id: city.id,
    city: city.name,
    mode: game.mode,
    radius: game.radius,
    day: game.day_key,
    created_at: game.created_at,
    total_rounds: rounds.length,
    complete: !current,
    center: city.center,
    bounds: city.bounds,
    time_zone: city.time_zone,
    map_zoom: mapZoom(game.radius),
    rules_version: RULES_VERSION,
    rounds: rounds.map((r) => ({
      id: r.id,
      ordinal: r.ordinal,
      result: r.result_json ? JSON.parse(r.result_json) : null,
    })),
    current: current
      ? {
          id: current.id,
          ordinal: current.ordinal,
          type: targets.get(current.target_id).type,
          prompt:
            game.mode === "landmark"
              ? `Find ${targets.get(current.target_id).name} on the map.`
              : "Pin the intersection shown.",
          clue_used: Boolean(current.clue_used),
          clue: current.clue_used ? targets.get(current.target_id).clue : null,
          scene_url: `${PREFIX}/games/${game.id}/rounds/${current.id}/scene`,
        }
      : null,
    answer_options: [
      ...new Set(
        eligible(CATALOG, game.mode, game.radius, city.id).map((c) => c.label),
      ),
    ].sort(),
  };
}
async function createGame(ctx, input) {
  const city = cityById(input.city_id ?? "toronto");
  if (!city)
    fail("That city is not available. Choose a supported city to play.", 422);
  if (!ctx.env.LOCAL_LORE_GOOGLE_MAPS_API_KEY)
    fail("Live maps are not configured yet.", 503);
  if (
    !MODES.includes(input.mode) ||
    !RADII.includes(input.radius) ||
    typeof input.request_id !== "string" ||
    !/^[a-zA-Z0-9_-]{12,80}$/.test(input.request_id)
  )
    fail("Choose a valid mode and radius.");
  const mode = input.mode,
    radius = mode === "daily" ? 3 : input.radius,
    day = cityDay(city.id),
    limitDay = torontoDay();
  const previous = await ctx.db
    .prepare(
      "SELECT id,city_id FROM ll_games WHERE guest_id=? AND (start_key=? OR (city_id=? AND mode='daily' AND ?='daily' AND day_key=?)) ORDER BY created_at DESC LIMIT 1",
    )
    .bind(ctx.guest, input.request_id, city.id, mode, day)
    .first();
  if (previous) {
    if (previous.city_id !== city.id)
      fail("This request belongs to another city. Start a new set.", 409);
    return viewGame(ctx, previous.id);
  }
  await useLimit(
    ctx.db,
    `games:player:${ctx.guest}:${limitDay}`,
    limits(ctx.env).playerGames,
    now() + 2 * DAY,
  );
  await useLimit(ctx.db, `games:ip:${ctx.ip}:${limitDay}`, 30, now() + 2 * DAY);
  const available = eligible(CATALOG, mode, radius, city.id);
  if (available.length < 3)
    fail("Not enough places in this radius. Choose a wider area.", 422);
  // Preserve Toronto's existing daily set while isolating new cities.
  const seed =
    mode === "daily"
      ? city.id === "toronto"
        ? day
        : `${city.id}:${day}`
      : crypto.randomUUID();
  const shuffled = await Promise.all(
    available.map(async (c) => ({ c, order: await digest(seed + c.id) })),
  );
  const selected = shuffled
    .sort((a, b) => a.order.localeCompare(b.order))
    .slice(0, 3)
    .map((v) => v.c);
  const gameId = id();
  try {
    await ctx.db.batch([
      ctx.db
        .prepare(
          "INSERT INTO ll_games(id,guest_id,start_key,mode,radius,day_key,created_at,city_id) VALUES(?,?,?,?,?,?,?,?)",
        )
        .bind(
          gameId,
          ctx.guest,
          input.request_id,
          mode,
          radius,
          day,
          now(),
          city.id,
        ),
      ...selected.map((c, i) =>
        ctx.db
          .prepare(
            "INSERT INTO ll_rounds(id,game_id,ordinal,target_id) VALUES(?,?,?,?)",
          )
          .bind(id(), gameId, i + 1, c.id),
      ),
    ]);
  } catch (error) {
    const retry = await ctx.db
      .prepare(
        "SELECT id,city_id FROM ll_games WHERE guest_id=? AND (start_key=? OR (city_id=? AND mode='daily' AND ?='daily' AND day_key=?)) LIMIT 1",
      )
      .bind(ctx.guest, input.request_id, city.id, mode, day)
      .first();
    if (retry) {
      if (retry.city_id !== city.id)
        fail("This request belongs to another city. Start a new set.", 409);
      return viewGame(ctx, retry.id);
    }
    throw error;
  }
  return viewGame(ctx, gameId);
}
async function currentRound(ctx, gameId, roundId, allowFinished = false) {
  const { game, rounds } = await ownedGame(ctx, gameId),
    round = rounds.find((r) => r.id === roundId);
  if (!round) fail("Round not found.", 404);
  if (!allowFinished && rounds.find((r) => !r.result_json)?.id !== roundId)
    fail("This round is already complete or has not started.", 409);
  return { game, round };
}
async function guess(ctx, gameId, roundId, input) {
  const { game, round } = await currentRound(ctx, gameId, roundId, true);
  if (round.result_json)
    return {
      result: JSON.parse(round.result_json),
      game: await viewGame(ctx, gameId),
    };
  await currentRound(ctx, gameId, roundId);
  if (!["named", "pin", "skip"].includes(input.method))
    fail("Choose a named answer or a map pin.");
  if (
    input.method === "named" &&
    (typeof input.text !== "string" ||
      !input.text.trim() ||
      input.text.length > 200)
  )
    fail("Enter a street or intersection name.");
  const point =
    input.method === "pin"
      ? inputPoint(input.pin, cityById(game.city_id))
      : null;
  const target = targets.get(round.target_id);
  for (let attempt = 0; attempt < 3; attempt++) {
    const latest = await ctx.db
      .prepare("SELECT clue_used,result_json FROM ll_rounds WHERE id=?")
      .bind(roundId)
      .first();
    if (latest.result_json)
      return {
        result: JSON.parse(latest.result_json),
        game: await viewGame(ctx, gameId),
      };
    const result = {
      ...(input.method === "skip"
        ? {
            score: 0,
            maximum: 1000,
            correct: false,
            method: "skip",
            distance_m: null,
            assisted: Boolean(latest.clue_used),
          }
        : score(target, { ...input, pin: point }, latest.clue_used)),
      rules_version: RULES_VERSION,
      label: target.label,
      note: target.note,
      point: { latitude: target.latitude, longitude: target.longitude },
      name: target.name || null,
      answer: input.method === "named" ? input.text.trim() : point,
      completed_at: now(),
    };
    const saved = await ctx.db
      .prepare(
        "UPDATE ll_rounds SET result_json=? WHERE id=? AND result_json IS NULL AND clue_used=? RETURNING id",
      )
      .bind(JSON.stringify(result), roundId, latest.clue_used)
      .first();
    if (saved) return { result, game: await viewGame(ctx, gameId) };
  }
  fail("Your round changed. Please try again.", 409);
}
async function metadata(ctx, target) {
  const cached = await ctx.db
    .prepare("SELECT pano_id FROM ll_panoramas WHERE target_id=?")
    .bind(target.id)
    .first();
  const fetchMeta = async (params) => {
    const url = googleURL(ctx.env, "streetview/metadata", params);
    const res = await ctx.fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok)
      fail("Street View is temporarily unavailable. Please retry.", 503);
    return res.json();
  };
  let data = cached ? await fetchMeta({ pano: cached.pano_id }) : null;
  if (!data || data.status !== "OK") {
    data = await fetchMeta({
      location: `${target.latitude},${target.longitude}`,
      radius: target.type === "landmark" ? "150" : "50",
      source: "outdoor",
    });
    if (data.status !== "OK")
      fail(
        "No Street View photo is available here right now. Skip this place or retry.",
        503,
      );
    await ctx.db
      .prepare(
        "INSERT INTO ll_panoramas(target_id,pano_id,checked_at) VALUES(?,?,?) ON CONFLICT(target_id) DO UPDATE SET pano_id=excluded.pano_id,checked_at=excluded.checked_at",
      )
      .bind(target.id, data.pano_id, now())
      .run();
  }
  const camera = { latitude: data.location.lat, longitude: data.location.lng };
  // Large landmark footprints can put a street camera beyond 100 m from the OSM centre.
  if (distance(camera, target) > (target.type === "landmark" ? 150 : 100))
    fail("The photo has moved too far from this place. Skip this round.", 503);
  return {
    pano: data.pano_id,
    heading:
      distance(camera, target) > 8 ? Math.round(bearing(camera, target)) : 90,
  };
}
function googleURL(env, path, params) {
  const key = env.LOCAL_LORE_GOOGLE_MAPS_API_KEY;
  if (!key) fail("Live maps are not configured yet.", 503);
  const u = new URL("https://maps.googleapis.com/maps/api/" + path);
  u.search = new URLSearchParams({ ...params, key });
  return u;
}
async function signURL(url, secret) {
  if (!secret) return url;
  const raw = Uint8Array.from(
    atob(secret.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(url.pathname + url.search),
    ),
  );
  url.searchParams.set(
    "signature",
    btoa(String.fromCharCode(...sig))
      .replace(/\+/g, "-")
      .replace(/\//g, "_"),
  );
  return url;
}
async function googleImage(ctx, path, params) {
  await imageAllowance(ctx);
  const url = await signURL(
    googleURL(ctx.env, path, params),
    ctx.env.LOCAL_LORE_GOOGLE_MAPS_URL_SIGNING_SECRET,
  );
  const response = await ctx.fetch(url, { signal: AbortSignal.timeout(15000) });
  if (
    !response.ok ||
    !response.headers.get("content-type")?.startsWith("image/")
  )
    fail(
      "Google could not load this image. Please retry or skip this place.",
      503,
    );
  // Stream only. No image bytes are written to D1, disk, R2, a service worker,
  // or Cloudflare Cache. Google attribution remains in the complete image.
  return new Response(response.body, {
    headers: {
      "Content-Type": response.headers.get("content-type"),
      "Cache-Control": "private, no-store",
      "CDN-Cache-Control": "no-store",
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
async function history(ctx) {
  const records = await rows(
    ctx.db
      .prepare(
        "SELECT g.id,g.city_id,g.mode,g.radius,g.day_key,g.created_at,r.ordinal,r.target_id,r.result_json FROM ll_games g JOIN ll_rounds r ON r.game_id=g.id WHERE g.guest_id=? AND g.created_at>? ORDER BY g.created_at DESC,r.ordinal LIMIT 300",
      )
      .bind(ctx.guest, now() - 90 * DAY),
  );
  const games = new Map();
  const notes = new Map();
  for (const r of records) {
    const g = games.get(r.id) || {
      id: r.id,
      city_id: r.city_id,
      city: cityById(r.city_id).name,
      mode: r.mode,
      radius: r.radius,
      day: r.day_key,
      created_at: r.created_at,
      score: 0,
      completed: 0,
      total: 3,
    };
    if (r.result_json) {
      const result = JSON.parse(r.result_json);
      g.score += result.score;
      g.completed++;
      const noteKey = r.city_id + ":" + r.target_id;
      if (result.method !== "skip" && !notes.has(noteKey))
        notes.set(noteKey, {
          city_id: r.city_id,
          city: cityById(r.city_id).name,
          name: result.name || null,
          label: result.label,
          note: result.note,
          correct: result.correct,
          completed_at: result.completed_at,
        });
    }
    games.set(g.id, g);
  }
  return { games: [...games.values()], notes: [...notes.values()] };
}
export async function handleLocalLore(request, env, options = {}) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(PREFIX + "/")) return null;
  let cookie = null;
  try {
    if (!env.LOCAL_LORE_DB)
      fail(
        "Saved games are temporarily unavailable. Please try again shortly.",
        503,
      );
    if (!["GET", "POST"].includes(request.method))
      fail("Method not allowed.", 405);
    if (
      request.method === "POST" &&
      ((request.headers.get("origin") &&
        request.headers.get("origin") !== url.origin) ||
        request.headers.get("sec-fetch-site") === "cross-site")
    )
      fail("Please play from the Local Lore website.", 403);
    let token = request.headers
      .get("cookie")
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith(COOKIE + "="))
      ?.slice(COOKIE.length + 1);
    if (!token || !/^[0-9a-f-]{36}$/.test(token)) {
      token = id();
      cookie = `${COOKIE}=${token}; Path=/local-lore/; Max-Age=7776000; HttpOnly; SameSite=Lax${url.protocol === "https:" ? "; Secure" : ""}`;
    }
    const guest = await digest(token);
    const ip = await digest(
      torontoDay() + ":" + (request.headers.get("cf-connecting-ip") || "local"),
    );
    const ctx = {
      db: env.LOCAL_LORE_DB,
      env,
      guest,
      ip,
      fetch: options.fetch || ((...args) => fetch(...args)),
    };
    await useLimit(
      ctx.db,
      `api:${ip}:${Math.floor(now() / 60000)}`,
      120,
      now() + 2 * DAY,
    );
    let response;
    const path = url.pathname.slice(PREFIX.length).replace(/\/$/, "");
    if (request.method === "GET" && path === "/config")
      response = json({
        ready: Boolean(env.LOCAL_LORE_GOOGLE_MAPS_API_KEY),
        city: "Toronto",
        cities: SUPPORTED_CITIES.map((city) => ({
          ...city,
          day: cityDay(city.id),
          coverage: MODES.flatMap((mode) =>
            RADII.map((radius) => ({
              mode,
              radius,
              count: eligible(CATALOG, mode, radius, city.id).length,
            })),
          ),
        })),
        recommendation: approximateCity(request.cf),
        center: CENTER,
        day: torontoDay(),
        coverage: MODES.flatMap((mode) =>
          RADII.map((radius) => ({
            mode,
            radius,
            count: eligible(CATALOG, mode, radius).length,
          })),
        ),
        limits: limits(env),
      });
    else if (request.method === "GET" && path === "/history")
      response = json(await history(ctx));
    else if (request.method === "POST" && path === "/games")
      response = json(await createGame(ctx, await bodyOf(request)), 201);
    else {
      const gameMatch = path.match(/^\/games\/([\da-f-]{36})$/),
        mapMatch = path.match(/^\/games\/([\da-f-]{36})\/map$/),
        roundMatch = path.match(
          /^\/games\/([\da-f-]{36})\/rounds\/([\da-f-]{36})\/(guess|clue|scene)$/,
        );
      if (gameMatch && request.method === "GET")
        response = json(await viewGame(ctx, gameMatch[1]));
      else if (mapMatch && request.method === "GET") {
        const { game } = await ownedGame(ctx, mapMatch[1]);
        const city = cityById(game.city_id);
        const hasCenter =
          url.searchParams.has("lat") || url.searchParams.has("lng");
        if (
          hasCenter &&
          (!url.searchParams.get("lat") || !url.searchParams.get("lng"))
        )
          fail("Choose a complete map position.");
        const center = hasCenter
          ? inputPoint(
              {
                latitude: Number(url.searchParams.get("lat")),
                longitude: Number(url.searchParams.get("lng")),
              },
              city,
            )
          : city.center;
        const zoom = Number(
          url.searchParams.get("zoom") || mapZoom(game.radius),
        );
        if (!Number.isInteger(zoom) || zoom < 11 || zoom > 17)
          fail("Invalid map zoom.");
        response = await googleImage(ctx, "staticmap", {
          center: `${center.latitude},${center.longitude}`,
          zoom: String(zoom),
          size: "640x480",
          scale: "2",
          maptype: "roadmap",
        });
      } else if (roundMatch) {
        const [, gameId, roundId, action] = roundMatch;
        if (action === "guess" && request.method === "POST")
          response = json(
            await guess(ctx, gameId, roundId, await bodyOf(request)),
          );
        else if (action === "clue" && request.method === "POST") {
          await bodyOf(request);
          const { game, round } = await currentRound(ctx, gameId, roundId);
          if (game.mode === "daily")
            fail("Clues are available in practice modes only.", 403);
          const changed = await ctx.db
            .prepare(
              "UPDATE ll_rounds SET clue_used=1 WHERE id=? AND result_json IS NULL RETURNING id",
            )
            .bind(roundId)
            .first();
          if (!changed) fail("This round is already complete.", 409);
          response = json({
            clue: targets.get(round.target_id).clue,
            penalty_percent: 20,
          });
        } else if (action === "scene" && request.method === "GET") {
          const { round } = await currentRound(ctx, gameId, roundId);
          const meta = await metadata(ctx, targets.get(round.target_id));
          response = await googleImage(ctx, "streetview", {
            pano: meta.pano,
            heading: String(meta.heading),
            pitch: "0",
            fov: "100",
            size: "640x400",
            scale: "2",
            return_error_code: "true",
          });
        } else fail("Route not found.", 404);
      } else fail("Route not found.", 404);
    }
    if (cookie) response.headers.append("Set-Cookie", cookie);
    return response;
  } catch (error) {
    const response = json(
      {
        error:
          error instanceof GameError
            ? error.message
            : "Something went wrong. Your saved game is safe; please retry.",
      },
      error instanceof GameError ? error.status : 500,
    );
    if (cookie) response.headers.append("Set-Cookie", cookie);
    return response;
  }
}
export async function cleanupLocalLore(env) {
  if (!env.LOCAL_LORE_DB) return;
  await env.LOCAL_LORE_DB.batch([
    env.LOCAL_LORE_DB.prepare("DELETE FROM ll_usage WHERE expires_at<?").bind(
      now(),
    ),
    env.LOCAL_LORE_DB.prepare("DELETE FROM ll_games WHERE created_at<?").bind(
      now() - 90 * DAY,
    ),
  ]);
}
