// Coordinate projection and rectangle geometry, independent of plan state.
export function project(x, y, grid) {
  return { x: x * grid.ax + y * grid.bx, y: x * grid.ay + y * grid.by };
}
export function unproject(x, y, grid) {
  const det = grid.ax * grid.by - grid.ay * grid.bx;
  if (Math.abs(det) < 1) throw new Error("Grid axes must not be parallel.");
  return {
    x: (x * grid.by - y * grid.bx) / det,
    y: (y * grid.ax - x * grid.ay) / det,
  };
}
export function overlap(a, b) {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}
