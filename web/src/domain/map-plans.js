import { createLayout, captureLayout, applyLayout } from "./layout.js";
const copy = (value) => structuredClone(value);
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
export function createMapPlan(plan, type, name, terrain = null) {
  if (!plan.mapPresets.some((preset) => preset.id === type))
    throw new Error("Choose a map type.");
  if (!name.trim() || name.length > 100)
    throw new Error("Enter a formation name (up to 100 characters).");
  const next = syncMapLayouts(copy(plan));
  const layout = createLayout(type, terrain);
  const map = { id: crypto.randomUUID(), name: name.trim(), type, layout };
  next.maps ||= [];
  next.maps.push(map);
  next.activeMapId = map.id;
  applyLayout(next, layout);
  return syncMapLayouts(next);
}
export function selectMapPlan(plan, id) {
  const next = syncMapLayouts(copy(plan));
  const map = next.maps.find((item) => item.id === id);
  if (!map) throw new Error("Map not found.");
  next.activeMapId = id;
  applyLayout(next, map.layout);
  return next;
}
