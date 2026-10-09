import { captureLayout } from "./layout.js";
export const defaultFormationName = (type) =>
  type === "server" ? "Hive" : type === "blank" ? "Formation" : "Rally";
export function syncMapLayouts(plan) {
  if (!Array.isArray(plan.maps)) return plan;
  const active = plan.maps.find((map) => map.id === plan.activeMapId);
  if (active) {
    active.layout = captureLayout(plan);
    active.type = plan.map;
  }
  const players = new Map(plan.keeps.map((player) => [player.id, player]));
  for (const map of plan.maps) {
    map.layout.positions = map.layout.positions.filter((position) =>
      players.has(position.id),
    );
    if (map.layout.rallyId && !players.has(map.layout.rallyId))
      map.layout.rallyId = null;
  }
  return plan;
}
