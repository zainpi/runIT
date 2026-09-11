import { scoreNamed, scorePin, SCORING_PROFILES } from "../core/scoring.mjs";
export const CENTER = { latitude: 43.655, longitude: -79.397 };
export const RADII = [1, 3, 5, 10];
export const MODES = ["daily", "around", "landmark"];
export const RULES_VERSION = "local_lore_live_v2";
const PIN_PROFILE = SCORING_PROFILES.neighborhood_pin_v2;
export function distance(a, b) {
  const rad = Math.PI / 180;
  const dlat = (b.latitude - a.latitude) * rad,
    dlng = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(dlng / 2) ** 2;
  return (
    6371008.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)))
  );
}
export function bearing(a, b) {
  const r = Math.PI / 180,
    d = (b.longitude - a.longitude) * r;
  return (
    (Math.atan2(
      Math.sin(d) * Math.cos(b.latitude * r),
      Math.cos(a.latitude * r) * Math.sin(b.latitude * r) -
        Math.sin(a.latitude * r) * Math.cos(b.latitude * r) * Math.cos(d),
    ) /
      r +
      360) %
    360
  );
}
export function normalize(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(and|at|x)\b|[×&/]/g, "|")
    .replace(/[^a-z0-9|\s]/g, "")
    .replace(/\bstreet\b/g, "st")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\broad\b/g, "rd")
    .replace(/\bwest\b/g, "w")
    .replace(/\beast\b/g, "e")
    .replace(/\bnorth\b/g, "n")
    .replace(/\bsouth\b/g, "s")
    .split("|")
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .sort()
    .join("|");
}
export function eligible(catalog, mode, radius) {
  return catalog.filter(
    (c) =>
      (mode === "landmark"
        ? c.type === "landmark"
        : c.type === "intersection") && distance(CENTER, c) <= radius * 1000,
  );
}
export function torontoDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function mapZoom(radius) {
  return { 1: 14, 3: 13, 5: 12, 10: 11 }[radius];
}
export function acceptedName(target, text) {
  const parts = normalize(text).split("|");
  if (parts.length !== target.streets.length) return false;
  const remaining = [...parts];
  for (const street of target.streets) {
    const full = normalize(street);
    const variants = [
      full,
      full.replace(/ (st|ave|rd)( [wens])?$/, "$2").trim(),
      full.replace(/ [wens]$/, ""),
      full.replace(/ (st|ave|rd)( [wens])?$/, "").trim(),
    ];
    const index = remaining.findIndex((p) => variants.includes(p));
    if (index === -1) return false;
    remaining.splice(index, 1);
  }
  return true;
}
export function score(target, input, assisted) {
  const meters = input.method === "pin" ? distance(input.pin, target) : null;
  const correct =
    input.method === "named"
      ? acceptedName(target, input.text)
      : meters <= PIN_PROFILE.toleranceMeters;
  const scored =
    input.method === "named"
      ? scoreNamed({ accepted: correct, assistanceLevel: assisted ? 1 : 0 })
      : scorePin({
          distanceMeters: meters,
          profileId: PIN_PROFILE.id,
          assistanceLevel: assisted ? 1 : 0,
        });
  return {
    score: scored.score,
    maximum: 1000,
    correct,
    method: input.method,
    distance_m: meters === null ? null : Math.round(meters),
    assisted: Boolean(assisted),
  };
}
