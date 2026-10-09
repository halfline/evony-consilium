import { number } from "./constraints.js";

import { TROOP_TYPES } from "./troops.js";
export function marchType(march) {
  return (
    march.troopType ||
    (/archer/i.test(march.name)
      ? "ranged"
      : /mounted/i.test(march.name)
        ? "mounted"
        : /siege/i.test(march.name)
          ? "siege"
          : "ground")
  );
}
export function marchCapacity(march, sizes = {}) {
  return march.capacityOverride ?? sizes[marchType(march)] ?? null;
}
