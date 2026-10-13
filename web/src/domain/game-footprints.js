import { footprint } from "./entities.js";
import { overlap } from "./geometry.js";

// Dimensions come from the appearance, including in inactive saved maps.
// Only a resized object may lose its old position; other placements stay put.
export function normalizeGameFootprints(plan, assets) {
  const players = new Map(plan.keeps.map((player) => [player.id, player]));
  const repairs = [];
  function normalize(keeps, structures, obstacles, extent, mapId) {
    const resized = [];
    const unchanged = [];
    for (const [records, player] of [
      [keeps, true],
      [structures, false],
    ]) {
      for (const entity of records) {
        if (!entity) continue;
        const source = player ? players.get(entity.id) : entity;
        const asset = assets.get(entity.castleOverride ?? source?.skin);
        if (!asset) continue;
        const size = footprint(asset);
        if (entity.w === size && entity.h === size) unchanged.push(entity);
        else {
          entity.w = entity.h = size;
          resized.push({ entity, name: source.name });
        }
      }
    }
    const occupied = [...unchanged, ...obstacles].filter(
      (entity) => entity && entity.x !== null,
    );
    for (const { entity, name } of resized) {
      if (entity.x === null) continue;
      if (
        entity.x + entity.w > extent ||
        entity.y + entity.h > extent ||
        occupied.some((other) => overlap(entity, other))
      ) {
        entity.x = entity.y = null;
        entity.locked = false;
        repairs.push({ id: entity.id, name, mapId });
      } else occupied.push(entity);
    }
  }
  normalize(
    plan.keeps,
    plan.structures,
    plan.obstacles,
    plan.extent,
    plan.activeMapId ?? null,
  );
  for (const map of plan.maps || []) {
    const layout = map?.layout;
    if (
      !Array.isArray(layout?.positions) ||
      !Array.isArray(layout.structures) ||
      !Array.isArray(layout.obstacles)
    )
      continue; // Schema validation reports malformed layouts separately.
    normalize(
      layout.positions,
      layout.structures,
      layout.obstacles,
      layout.extent,
      map.id,
    );
  }
  return repairs;
}
