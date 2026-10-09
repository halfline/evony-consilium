import { canPlace } from "./placement.js";

import { ENTITY_COLLECTIONS } from "./entities.js";
const objects = (plan) => ENTITY_COLLECTIONS.flatMap((name) => plan[name]);

// Check the complete proposed layout, so moving objects do not block each other's old positions.
export function previewPlacementMove(plan, members, dx, dy, terrain = null) {
  const positions = members.map((entity) => ({
    ...entity,
    x: entity.x + dx,
    y: entity.y + dy,
  }));
  const byId = new Map(positions.map((entity) => [entity.id, entity]));
  const candidate = { ...plan };
  for (const name of ENTITY_COLLECTIONS)
    candidate[name] = plan[name].map((entity) => byId.get(entity.id) || entity);
  const valid = positions.every((entity) =>
    canPlace(entity, entity.x, entity.y, candidate, [], terrain),
  );
  return { positions, valid };
}

export function movePlacements(plan, positions, terrain = null) {
  const next = structuredClone(plan);
  const byId = new Map(objects(next).map((entity) => [entity.id, entity]));
  for (const position of positions) {
    const entity = byId.get(position.id);
    if (!entity || entity.locked || entity.x === null)
      throw new Error("This position cannot be moved.");
    entity.x = position.x;
    entity.y = position.y;
  }
  if (
    positions.some((position) => {
      const entity = byId.get(position.id);
      return !canPlace(entity, entity.x, entity.y, next, [], terrain);
    })
  )
    throw new Error(
      "That location overlaps another tile or is outside the map.",
    );
  return next;
}
