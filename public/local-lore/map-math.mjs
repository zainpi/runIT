export function project(point, center, zoom) {
  const size = 256 * 2 ** zoom;
  const world = (p) => ({
    x: ((p.longitude + 180) / 360) * size,
    y:
      ((1 - Math.asinh(Math.tan((p.latitude * Math.PI) / 180)) / Math.PI) / 2) *
      size,
  });
  const p = world(point),
    c = world(center);
  return {
    x: 50 + ((p.x - c.x) / 640) * 100,
    y: 50 + ((p.y - c.y) / 480) * 100,
  };
}
export function unproject(x, y, center, zoom) {
  const size = 256 * 2 ** zoom;
  const cx = ((center.longitude + 180) / 360) * size,
    cy =
      ((1 - Math.asinh(Math.tan((center.latitude * Math.PI) / 180)) / Math.PI) /
        2) *
      size;
  return {
    longitude: ((cx + ((x - 50) / 100) * 640) / size) * 360 - 180,
    latitude:
      (Math.atan(
        Math.sinh(Math.PI * (1 - (2 * (cy + ((y - 50) / 100) * 480)) / size)),
      ) *
        180) /
      Math.PI,
  };
}
