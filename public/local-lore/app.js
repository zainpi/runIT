import { project, unproject } from "./map-math.mjs";
const $ = (id) => document.getElementById(id),
  API = "/local-lore/api";
const names = {
  daily: "The daily three",
  around: "Around the corner",
  landmark: "Landmark links",
};
let config,
  game,
  round,
  result,
  answerMethod = "named",
  pin = null,
  busy = false,
  sceneReady = false,
  mapReady = false,
  mapBusy = false,
  mapCenter,
  mapZoom,
  mapKey = "",
  startKey = null,
  currentView = "setup",
  sceneGeneration = 0,
  mapGeneration = 0;
let sceneObject, mapObject;
function message(text = "") {
  $("notice").textContent = text;
  $("notice").hidden = !text;
}
function go(view) {
  currentView = view;
  for (const e of document.querySelectorAll("main>section"))
    e.hidden = e.id !== view;
  for (const e of document.querySelectorAll("[data-view]"))
    e.classList.toggle("is-active", e.dataset.view === view);
  message();
  window.scrollTo({ top: 0, behavior: "instant" });
}
async function api(path, body) {
  const res = await fetch(API + path, {
    credentials: "same-origin",
    cache: "no-store",
    ...(body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = await res
    .json()
    .catch(() => ({ error: "The game could not connect. Please retry." }));
  if (!res.ok) throw Error(data.error);
  return data;
}
function selectedMode() {
  return new FormData($("setup-form")).get("mode");
}
function coverage() {
  const mode = selectedMode();
  $("radius").disabled = mode === "daily";
  if (mode === "daily") $("radius").value = "3";
  const radius = Number($("radius").value),
    count =
      config?.coverage.find((c) => c.mode === mode && c.radius === radius)
        ?.count || 0;
  $("coverage").textContent = config
    ? `${count} verified ${mode === "landmark" ? "landmarks" : "intersections"} in this area${count < 3 ? " · choose a wider area to play" : mode === "daily" ? " · resets at midnight Toronto time" : ""}.`
    : "Connecting to the game…";
  $("start").disabled = !config?.ready || count < 3 || busy;
  $("start").textContent =
    mode === "daily" ? "Play today’s three ↗" : "Start exploring ↗";
  if (config && !config.ready)
    message(
      "Live maps are temporarily unavailable. Please check back shortly.",
    );
}
function setBusy(value) {
  busy = value;
  updateSubmit();
  $("skip").disabled = value;
  $("clue").disabled = value || Boolean(round?.clue_used);
  $("next").disabled = value;
  coverage();
}
function updateSubmit() {
  $("submit").disabled =
    busy ||
    !sceneReady ||
    Boolean(result) ||
    (answerMethod === "named"
      ? !$("answer").value.trim()
      : !pin || !mapReady || mapBusy);
}
async function loadImage(url, img, kind) {
  const generation = kind === "scene" ? ++sceneGeneration : ++mapGeneration;
  const check = () =>
    generation === (kind === "scene" ? sceneGeneration : mapGeneration);
  const loading = $(kind === "scene" ? "scene-loading" : "map-loading"),
    retry = $(kind === "scene" ? "retry-scene" : "retry-map");
  loading.hidden = false;
  loading.textContent =
    kind === "scene" ? "Loading the street…" : "Loading map…";
  retry.hidden = true;
  if (kind === "scene") {
    sceneReady = false;
    img.hidden = true;
  } else {
    mapReady = false;
    mapBusy = true;
    mapButtons();
    paintPins();
  }
  updateSubmit();
  try {
    const res = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw Error(data.error || "The image could not load. Please retry.");
    }
    const object = URL.createObjectURL(await res.blob());
    if (!check()) {
      URL.revokeObjectURL(object);
      return false;
    }
    img.src = object;
    try {
      await img.decode();
    } catch {
      URL.revokeObjectURL(object);
      throw Error("The image could not display. Please retry.");
    }
    if (!check()) {
      URL.revokeObjectURL(object);
      return false;
    }
    if (kind === "scene") {
      if (sceneObject) URL.revokeObjectURL(sceneObject);
      sceneObject = object;
      sceneReady = true;
    } else {
      if (mapObject) URL.revokeObjectURL(mapObject);
      mapObject = object;
      mapReady = true;
    }
    img.hidden = false;
    loading.hidden = true;
    return true;
  } catch (e) {
    if (check()) {
      loading.textContent =
        e.name === "TimeoutError"
          ? "Loading took too long. Please retry."
          : e.message;
      retry.hidden = false;
    }
    return false;
  } finally {
    if (check()) {
      if (kind === "map") {
        mapBusy = false;
        mapButtons();
        paintPins();
      }
      updateSubmit();
    }
  }
}
function mapButtons() {
  for (const b of document.querySelectorAll("[data-map]"))
    b.disabled =
      mapBusy ||
      (b.dataset.map === "in" && mapZoom >= 17) ||
      (b.dataset.map === "out" && mapZoom <= 11);
  $("show-answer").disabled = mapBusy;
}
async function loadMap(force = false) {
  $("map-section").hidden = false;
  if (mapBusy) return;
  const key = [game.id, mapCenter.latitude, mapCenter.longitude, mapZoom].join(
    ":",
  );
  if (!force && key === mapKey && mapReady) {
    paintPins();
    return;
  }
  mapKey = key;
  const q = new URLSearchParams({
    lat: mapCenter.latitude,
    lng: mapCenter.longitude,
    zoom: mapZoom,
  });
  await loadImage(`${API}/games/${game.id}/map?${q}`, $("map-image"), "map");
}
function paintPins() {
  for (const [el, point] of [
    [$("guess-pin"), pin],
    [$("answer-pin"), result?.point],
  ]) {
    if (!point || !mapReady) {
      el.hidden = true;
      continue;
    }
    const pos = project(point, mapCenter, mapZoom);
    el.hidden = pos.x < 3 || pos.x > 97 || pos.y < 3 || pos.y > 91;
    el.style.left = pos.x + "%";
    el.style.top = pos.y + "%";
  }
  if (pin && !result)
    $("pin-status").textContent =
      `Pin at ${pin.latitude.toFixed(5)}, ${pin.longitude.toFixed(5)}. Move it until you’re sure.`;
  else
    $("pin-status").textContent = result
      ? "G = your guess · A = answer. If a pin is outside this view, centre on the answer."
      : "Tap the map to place a pin. The bottom attribution area is reserved.";
}
function chooseMethod(method) {
  answerMethod = method;
  const named = method === "named";
  $("name-answer").hidden = !named;
  $("pin-instructions").hidden = named;
  $("choose-name").classList.toggle("selected", named);
  $("choose-pin").classList.toggle("selected", !named);
  $("choose-name").setAttribute("aria-pressed", String(named));
  $("choose-pin").setAttribute("aria-pressed", String(!named));
  $("map-section").hidden = named;
  if (!named) void loadMap();
  updateSubmit();
}
async function playRound() {
  round = game.current;
  result = null;
  pin = null;
  go("play");
  $("round-meta").textContent =
    `${names[game.mode]} · ${game.day} · ROUND ${round.ordinal} / ${game.total_rounds}`;
  $("prompt").textContent = round.prompt;
  $("prompt").focus();
  $("answer-controls").hidden = false;
  $("reveal").hidden = true;
  $("reveal-map").hidden = true;
  $("show-answer").hidden = true;
  $("answer").value = "";
  $("answer-options").replaceChildren(
    ...game.answer_options.map((text) => {
      const e = document.createElement("option");
      e.value = text;
      return e;
    }),
  );
  $("clue").hidden = game.mode === "daily";
  $("clue-box").hidden = !round.clue_used;
  $("clue-box").textContent = round.clue || "";
  setBusy(false);
  chooseMethod(answerMethod);
  paintPins();
  await loadImage(round.scene_url, $("scene"), "scene");
}
function showSummary() {
  go("summary");
  $("total").textContent =
    `${game.rounds.reduce((sum, r) => sum + (r.result?.score || 0), 0).toLocaleString()} / 3,000`;
  $("summary-rounds").replaceChildren(
    ...game.rounds.map((r) =>
      record(r.result.label, r.result.note, `${r.result.score} pts`),
    ),
  );
}
async function enterGame(nextGame) {
  const different = game?.id !== nextGame.id;
  game = nextGame;
  location.hash = "game=" + game.id;
  if (different) {
    mapCenter = { ...game.center };
    mapZoom = game.map_zoom;
    mapKey = "";
    mapReady = false;
    $("map-image").hidden = true;
  }
  if (game.complete) showSummary();
  else await playRound();
}
async function submit(method) {
  if (busy || result) return;
  setBusy(true);
  try {
    const data = await api(`/games/${game.id}/rounds/${round.id}/guess`, {
      method,
      ...(method === "named"
        ? { text: $("answer").value }
        : method === "pin"
          ? { pin }
          : {}),
    });
    game = data.game;
    result = data.result;
    $("answer-controls").hidden = true;
    $("clue-box").hidden = true;
    $("reveal").hidden = false;
    $("result-score").textContent =
      `${result.score.toLocaleString()} / 1,000 POINTS${result.assisted ? " · CLUE USED" : ""}`;
    $("result-label").textContent = result.name
      ? `${result.name} · ${result.label}`
      : result.label;
    $("result-detail").textContent =
      method === "skip"
        ? "Skipped — take a moment to remember this place."
        : result.method === "pin"
          ? `${result.distance_m.toLocaleString()} m from the answer${result.correct ? " · Right on target!" : ""}`
          : result.correct
            ? "That’s the connection."
            : "A new connection for next time.";
    $("result-note").textContent = result.note;
    $("next").textContent = game.complete ? "See my set →" : "Next place →";
    $("reveal-map").hidden = mapReady && !$("map-section").hidden;
    $("show-answer").hidden = false;
    paintPins();
    message();
  } catch (e) {
    message(e.message);
  } finally {
    setBusy(false);
  }
}
function record(title, detail, value, action) {
  const e = document.createElement("article");
  e.className = "record";
  const left = document.createElement("div"),
    h = document.createElement("h2"),
    p = document.createElement("p");
  h.textContent = title;
  p.textContent = detail;
  left.append(h, p);
  e.append(left);
  if (action) {
    const b = document.createElement("button");
    b.className = "secondary-button";
    b.textContent = value;
    b.onclick = action;
    e.append(b);
  } else {
    const strong = document.createElement("strong");
    strong.textContent = value;
    e.append(strong);
  }
  return e;
}
async function resume(id) {
  if (busy) return;
  setBusy(true);
  try {
    await enterGame(await api("/games/" + id));
  } catch (e) {
    message(e.message);
  } finally {
    setBusy(false);
  }
}
async function refreshHistory() {
  const data = await api("/history");
  $("scores-list").replaceChildren(
    ...data.games.map((g) =>
      record(
        names[g.mode],
        `${g.day} · ${g.completed}/3 rounds · ${g.score.toLocaleString()} points`,
        g.completed === 3 ? "View set" : "Resume",
        () => resume(g.id),
      ),
    ),
  );
  if (!data.games.length)
    $("scores-list").textContent =
      "Your first set is waiting. Play three places to start your record.";
  $("resume-list").replaceChildren(
    ...data.games
      .filter((g) => g.completed < 3)
      .slice(0, 3)
      .map((g) =>
        record(
          "Pick up " + names[g.mode].toLowerCase(),
          `${g.completed}/3 rounds complete · ${g.day}`,
          "Resume",
          () => resume(g.id),
        ),
      ),
  );
  $("notes-list").replaceChildren(
    ...data.notes.map((n) => {
      const e = document.createElement("article");
      e.className = "note";
      const h = document.createElement("h2"),
        p = document.createElement("p");
      h.textContent = n.label;
      p.textContent = n.note;
      e.append(h, p);
      return e;
    }),
  );
  if (!data.notes.length)
    $("notes-list").textContent =
      "Answer a round to save your first place here.";
}
for (const button of document.querySelectorAll("[data-view]"))
  button.onclick = async () => {
    go(button.dataset.view);
    history.replaceState(null, "", location.pathname);
    try {
      await refreshHistory();
    } catch (e) {
      message(e.message);
    }
  };
$("setup-form").onchange = () => {
  startKey = null;
  coverage();
};
$("setup-form").onsubmit = async (e) => {
  e.preventDefault();
  if (busy) return;
  setBusy(true);
  startKey ||= crypto.randomUUID();
  try {
    const nextGame = await api("/games", {
      mode: selectedMode(),
      radius: Number($("radius").value),
      request_id: startKey,
    });
    startKey = null;
    await enterGame(nextGame);
  } catch (error) {
    message(error.message);
  } finally {
    setBusy(false);
  }
};
$("choose-name").onclick = () => chooseMethod("named");
$("choose-pin").onclick = () => chooseMethod("pin");
$("answer").oninput = updateSubmit;
$("answer-form").onsubmit = (e) => {
  e.preventDefault();
  if (!$("submit").disabled) void submit(answerMethod);
};
$("skip").onclick = () => submit("skip");
$("next").onclick = () => (game.complete ? showSummary() : playRound());
$("leave").onclick = async () => {
  go("setup");
  history.replaceState(null, "", location.pathname);
  try {
    await refreshHistory();
  } catch (e) {
    message(e.message);
  }
};
$("clue").onclick = async () => {
  if (busy) return;
  setBusy(true);
  try {
    const data = await api(`/games/${game.id}/rounds/${round.id}/clue`, {});
    round.clue_used = true;
    round.clue = data.clue;
    $("clue-box").textContent = data.clue;
    $("clue-box").hidden = false;
  } catch (e) {
    message(e.message);
  } finally {
    setBusy(false);
  }
};
$("retry-scene").onclick = () =>
  loadImage(round.scene_url, $("scene"), "scene");
$("retry-map").onclick = () => loadMap(true);
$("reveal-map").onclick = async () => {
  $("reveal-map").hidden = true;
  await loadMap();
};
$("show-answer").onclick = async () => {
  if (!result || mapBusy) return;
  mapCenter = { ...result.point };
  mapZoom = 16;
  await loadMap();
};
for (const b of document.querySelectorAll("[data-map]"))
  b.onclick = async () => {
    if (mapBusy) return;
    const action = b.dataset.map;
    if (action === "in") mapZoom = Math.min(17, mapZoom + 1);
    else if (action === "out") mapZoom = Math.max(11, mapZoom - 1);
    else if (action === "home") {
      mapCenter = { ...game.center };
      mapZoom = game.map_zoom;
    } else {
      const offsets = {
        north: [50, 25],
        south: [50, 75],
        west: [25, 50],
        east: [75, 50],
      };
      mapCenter = unproject(...offsets[action], mapCenter, mapZoom);
    }
    mapCenter.latitude = Math.max(43.4, Math.min(43.9, mapCenter.latitude));
    mapCenter.longitude = Math.max(-79.8, Math.min(-79.1, mapCenter.longitude));
    await loadMap();
  };
$("map").onclick = (e) => {
  if (result || busy || !mapReady || mapBusy || answerMethod !== "pin") return;
  const box = $("map").getBoundingClientRect(),
    x = ((e.clientX - box.left) / box.width) * 100,
    y = ((e.clientY - box.top) / box.height) * 100;
  if (x < 3 || x > 97 || y < 3 || y > 91) return;
  pin = unproject(x, y, mapCenter, mapZoom);
  paintPins();
  updateSubmit();
};
$("map").onkeydown = (e) => {
  if (
    result ||
    busy ||
    !mapReady ||
    mapBusy ||
    answerMethod !== "pin" ||
    !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
  )
    return;
  e.preventDefault();
  const pos = pin ? project(pin, mapCenter, mapZoom) : { x: 50, y: 50 },
    step = e.shiftKey ? 5 : 1;
  if (e.key === "ArrowUp") pos.y -= step;
  if (e.key === "ArrowDown") pos.y += step;
  if (e.key === "ArrowLeft") pos.x -= step;
  if (e.key === "ArrowRight") pos.x += step;
  pin = unproject(
    Math.max(3, Math.min(97, pos.x)),
    Math.max(3, Math.min(91, pos.y)),
    mapCenter,
    mapZoom,
  );
  paintPins();
  updateSubmit();
};
async function init() {
  try {
    config = await api("/config");
    coverage();
    await refreshHistory();
    const id = location.hash.match(/^#game=([\da-f-]{36})$/)?.[1];
    if (id) await resume(id);
  } catch (e) {
    message(e.message + " Reload this page to reconnect.");
  }
}
void init();
