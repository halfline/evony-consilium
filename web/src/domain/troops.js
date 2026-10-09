import { number } from "./constraints.js";
export const MARCH_SIZE_BOOST = 200;
export const TROOP_TYPES = Object.freeze([
  "ground",
  "ranged",
  "mounted",
  "siege",
]);
export const BUFF_CONTEXTS = Object.freeze(["city", "rally", "solo"]);
export const BUFF_TYPES = Object.freeze(["attack", "defense", "hp"]);

export const TROOP_NAMES = Object.freeze({
  ground: "Ground",
  ranged: "Archers",
  mounted: "Mounted",
  siege: "Siege",
});
export const MARCH_PRESETS = Object.freeze(
  ["siege", "ranged", "mounted", "ground"].map((troopType) =>
    Object.freeze({
      name: TROOP_NAMES[troopType],
      troopType,
    }),
  ),
);

export function troopTotals(troops = []) {
  const totals = Object.fromEntries(TROOP_TYPES.map((type) => [type, null]));
  let total = null;
  for (const row of troops)
    for (const type of TROOP_TYPES) {
      if (row[type] == null) continue;
      totals[type] = (totals[type] ?? 0) + row[type];
      total = (total ?? 0) + row[type];
      if (!Number.isSafeInteger(total))
        throw new Error("Troop total exceeds the supported range.");
    }
  return { ...totals, total };
}

export function validateTroops(troops) {
  if (!Array.isArray(troops) || troops.length > 100)
    throw new Error("Invalid troop composition.");
  const tiers = new Set();
  for (const row of troops) {
    if (!row || typeof row !== "object" || Array.isArray(row))
      throw new Error("Invalid troop tier.");
    number(row.tier, 1, 100, "troop tier");
    if (tiers.has(row.tier)) throw new Error("Duplicate troop tier.");
    tiers.add(row.tier);
    for (const type of TROOP_TYPES)
      if (row[type] != null)
        number(row[type], 0, Number.MAX_SAFE_INTEGER, "troop count");
  }
  troopTotals(troops);
  return troops;
}
