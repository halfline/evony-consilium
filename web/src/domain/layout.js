const copy = (value) => structuredClone(value);

export const LAYOUT_FIELDS = [
  "map",
  "extent",
  "center",
  "spacing",
  "formation",
  "grid",
  "structures",
  "obstacles",
  "rallyId",
  "rallyManual",
  "backgrounds",
  "labels",
  "showGrid",
];
export function createLayout(type = "server", terrain = null) {
  const extent = terrain?.extent || 1200;
  return {
    map: type,
    extent,
    center: { x: Math.floor(extent / 2), y: Math.floor(extent / 2) },
    spacing: 0,
    formation: "rings",
    grid: { ax: 48, ay: 24, bx: -48, by: 24 },
    structures: [],
    obstacles: [],
    rallyId: null,
    rallyManual: false,
    backgrounds: {},
    labels: true,
    showGrid: true,
    positions: [],
  };
}

export function captureLayout(plan) {
  return {
    ...Object.fromEntries(LAYOUT_FIELDS.map((key) => [key, copy(plan[key])])),
    positions: plan.keeps.map(({ id, x, y, w, h, locked }) => ({
      id,
      x,
      y,
      w,
      h,
      locked,
    })),
  };
}
export function applyLayout(plan, layout) {
  for (const key of LAYOUT_FIELDS) plan[key] = copy(layout[key]);
  const positions = new Map(
    layout.positions.map((position) => [position.id, position]),
  );
  plan.keeps = plan.keeps.map((player) => {
    const position = positions.get(player.id);
    return {
      ...player,
      ...(position
        ? {
            x: position.x,
            y: position.y,
            w: position.w,
            h: position.h,
            locked: position.locked,
          }
        : { x: null, y: null, locked: false }),
    };
  });
}
