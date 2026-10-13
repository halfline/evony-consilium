import { editPlayerProfile } from "./players.js";
import { canPlace } from "./placement.js";
import { footprint } from "./entities.js";

export function changeAppearance(plan, id, asset, terrain = null) {
  if (!asset) throw new Error("That appearance is unavailable.");
  const player = plan.keeps.some((player) => player.id === id);
  const next = player
    ? editPlayerProfile(plan, id, { skin: asset.id })
    : structuredClone(plan);
  const entity = [...next.keeps, ...next.structures].find(
    (entity) => entity.id === id,
  );
  if (!entity) return plan;
  entity.skin = asset.id;
  entity.w = entity.h = footprint(asset);
  if (
    entity.x !== null &&
    !canPlace(entity, entity.x, entity.y, next, [], terrain)
  )
    throw new Error(
      "This appearance overlaps another tile or the map edge. Move the building before changing its appearance.",
    );
  return next;
}
