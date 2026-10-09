import { ensureMapRallySetters } from "./rally.js";
import { createLayout, captureLayout, applyLayout, LAYOUT_FIELDS } from "./layout.js";
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
export function removeMapPlan(plan, id) {
  const next = syncMapLayouts(copy(plan));
  next.maps = next.maps.filter((map) => map.id !== id);
  if (next.activeMapId === id) {
    next.activeMapId = null;
    next.keeps.forEach((player) => {
      player.x = player.y = null;
      player.locked = false;
    });
    next.structures = [];
    next.obstacles = [];
    next.rallyId = null;
    next.backgrounds = {};
    if (next.maps.length) return selectMapPlan(next, next.maps[0].id);
  }
  return next;
}
// Ignore navigation state when deciding whether there are unsaved project changes.
export function projectFingerprint(plan) {
  const next = syncMapLayouts(copy(plan));
  ensureMapRallySetters(next);
  next.subcities ??= [];
  for (const city of next.subcities) city.ownerId ??= null;
  const projectLogo = next.projectLogo ?? "",
    discordUrl = next.discordUrl ?? "";
  delete next.projectLogo;
  delete next.discordUrl;
  next.projectLogo = projectLogo;
  next.discordUrl = discordUrl;
  if (next.maps?.length) {
    for (const key of [...LAYOUT_FIELDS, "activeMapId"]) delete next[key];
    next.keeps = next.keeps.map((player) => {
      const result = { ...player };
      for (const key of ["x", "y", "w", "h", "locked"]) delete result[key];
      return result;
    });
    // Unplaced, unlocked positions are equivalent to missing positions.
    for (const map of next.maps)
      map.layout.positions = map.layout.positions.filter(
        (position) => position.x !== null || position.locked,
      );
  }
  // JSON property order is not a content change (for example, a teammate’s formatter).
  return JSON.stringify(next, (_key, value) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return value;
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, value[key]]),
    );
  });
}
