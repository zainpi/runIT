// Only list cities with a playable, verified catalogue and server support.
export const SUPPORTED_CITIES = [
  {
    id: "toronto",
    name: "Toronto",
    country: "Canada",
    center: { latitude: 43.655, longitude: -79.397 },
    time_zone: "America/Toronto",
    area: "Downtown Toronto, centred near Spadina & Dundas",
    bounds: { south: 43.4, north: 43.9, west: -79.8, east: -79.1 },
  },
  {
    id: "nyc",
    name: "New York City",
    country: "United States",
    center: { latitude: 40.754, longitude: -73.984 },
    time_zone: "America/New_York",
    area: "Midtown Manhattan, centred near Bryant Park",
    bounds: { south: 40.5, north: 40.95, west: -74.3, east: -73.65 },
  },
  {
    id: "vancouver",
    name: "Vancouver",
    country: "Canada",
    center: { latitude: 49.2827, longitude: -123.1207 },
    time_zone: "America/Vancouver",
    area: "Downtown Vancouver, centred near the Vancouver Art Gallery",
    bounds: { south: 49.15, north: 49.4, west: -123.3, east: -122.95 },
  },
  {
    id: "london",
    name: "London",
    country: "United Kingdom",
    center: { latitude: 51.511, longitude: -0.128 },
    time_zone: "Europe/London",
    area: "Central London, centred near Leicester Square",
    bounds: { south: 51.35, north: 51.7, west: -0.4, east: 0.15 },
  },
];

export function cityById(id = "toronto") {
  return SUPPORTED_CITIES.find((city) => city.id === id);
}

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
