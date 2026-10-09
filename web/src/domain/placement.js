import { overlap } from "./geometry.js";
import { terrainAllowsPlacement } from "./terrain.js";

export function canPlace(entity, x, y, plan, ignore = [], terrain = null) {
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    y < 0 ||
    x + entity.w > plan.extent ||
    y + entity.h > plan.extent
  )
    return false;
  const candidate = { ...entity, x, y };
  if (!terrainAllowsPlacement(terrain, candidate)) return false;
  return ![...plan.keeps, ...plan.structures, ...plan.obstacles].some(
    (e) =>
      e.id !== entity.id &&
      !ignore.includes(e.id) &&
      e.x !== null &&
      overlap(candidate, e),
  );
}
