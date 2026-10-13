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
  if (!player || entity.castleOverride === undefined)
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

// A tactical castle choice belongs to the active layout, never the profile file.
function mapCastle(plan, id, asset, terrain, override) {
  if (!plan.maps?.some((map) => map.id === plan.activeMapId))
    throw new Error("Open a map before choosing its castle.");
  if (asset?.kind !== "keep") throw new Error("Choose a valid castle.");
  const next = structuredClone(plan);
  const player = next.keeps.find((player) => player.id === id);
  if (!player) throw new Error("Player not found.");
  if (override) player.castleOverride = asset.id;
  else delete player.castleOverride;
  player.w = player.h = footprint(asset);
  if (
    player.x !== null &&
    !canPlace(player, player.x, player.y, next, [], terrain)
  )
    throw new Error(
      "This castle overlaps another tile or the map edge. Move the player before changing the map castle.",
    );
  return next;
}
export const changeMapCastle = (plan, id, asset, terrain = null) =>
  mapCastle(plan, id, asset, terrain, true);
export const useProfileCastle = (plan, id, asset, terrain = null) =>
  mapCastle(plan, id, asset, terrain, false);
