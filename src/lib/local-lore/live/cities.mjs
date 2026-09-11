// Only list cities with a playable, verified catalogue and server support.
export const SUPPORTED_CITIES = [
  {
    id: "toronto",
    name: "Toronto",
    country: "Canada",
    center: { latitude: 43.655, longitude: -79.397 },
  },
];

export function validLocation(point) {
  return Boolean(
    point &&
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude) &&
      Math.abs(point.latitude) <= 90 &&
      Math.abs(point.longitude) <= 180,
  );
}

export function nearestCity(point, cities = SUPPORTED_CITIES) {
  if (!validLocation(point)) return null;
  const rad = Math.PI / 180;
  let nearest = null;
  for (const city of cities) {
    if (!validLocation(city.center)) continue;
    const a =
      Math.sin(((city.center.latitude - point.latitude) * rad) / 2) ** 2 +
      Math.cos(point.latitude * rad) *
        Math.cos(city.center.latitude * rad) *
        Math.sin(((city.center.longitude - point.longitude) * rad) / 2) ** 2;
    const km =
      6371.0088 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
    if (!nearest || km < nearest.distance_km)
      nearest = { city_id: city.id, distance_km: km };
  }
  return nearest;
}

export function approximateCity(cf, cities = SUPPORTED_CITIES) {
  const parse = (value) =>
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : NaN;
  const match = nearestCity(
    { latitude: parse(cf?.latitude), longitude: parse(cf?.longitude) },
    cities,
  );
  return match
    ? {
        city_id: match.city_id,
        distance_km: Math.round(match.distance_km),
        source: "approximate",
      }
    : { city_id: cities[0]?.id ?? null, distance_km: null, source: "default" };
}
