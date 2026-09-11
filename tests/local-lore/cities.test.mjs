import test from "node:test";
import assert from "node:assert/strict";
import {
  SUPPORTED_CITIES,
  nearestCity,
  approximateCity,
} from "../../src/lib/local-lore/live/cities.mjs";

const cities = [
  ...SUPPORTED_CITIES,
  { id: "test-montreal", center: { latitude: 45.5019, longitude: -73.5674 } },
  { id: "test-vancouver", center: { latitude: 49.2827, longitude: -123.1207 } },
];
test("nearest city is chosen from supported centres, including far-away players", () => {
  assert.equal(
    nearestCity({ latitude: 45.4, longitude: -75.7 }, cities).city_id,
    "test-montreal",
  );
  assert.equal(
    nearestCity({ latitude: 49.2, longitude: -123 }, cities).city_id,
    "test-vancouver",
  );
  const current = nearestCity({ latitude: 49.2, longitude: -123 });
  assert.equal(current.city_id, "toronto");
  assert.ok(current.distance_km > 3300 && current.distance_km < 3400);
  assert.equal(nearestCity(SUPPORTED_CITIES[0].center).distance_km, 0);
  assert.equal(nearestCity({ latitude: 0, longitude: 0 }, []), null);
});
test("missing or invalid network coordinates fall back without inventing a location", () => {
  for (const cf of [
    undefined,
    {},
    { latitude: "", longitude: "" },
    { latitude: null, longitude: null },
    { latitude: "unknown", longitude: "-79" },
    { latitude: "91", longitude: "-79" },
  ]) {
    assert.deepEqual(approximateCity(cf), {
      city_id: "toronto",
      distance_km: null,
      source: "default",
    });
  }
  assert.equal(nearestCity({ latitude: Infinity, longitude: 0 }), null);
  assert.equal(nearestCity({ latitude: 10, longitude: 181 }), null);
  const match = approximateCity({ latitude: "43.655", longitude: "-79.397" });
  assert.deepEqual(match, {
    city_id: "toronto",
    distance_km: 0,
    source: "approximate",
  });
  assert.equal(
    approximateCity({ latitude: "0", longitude: "0" }).source,
    "approximate",
  );
});
