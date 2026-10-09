import { editPlayerProfile } from "./players.js";
import { canPlace } from "./placement.js";

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
  if (asset.footprint) entity.w = entity.h = asset.footprint;
  if (
    entity.x !== null &&
    !canPlace(entity, entity.x, entity.y, next, [], terrain)
  )
    throw new Error(
      "The game footprint overlaps another tile or the map edge. Move this building before applying its game size.",
    );
  return next;
}
