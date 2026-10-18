import { number, string } from "./constraints.js";
import {
  TROOP_TYPES,
  BUFF_CONTEXTS,
  BUFF_TYPES,
  validateTroops,
} from "./troops.js";
import {
  validateMarches,
  validateReinforcementMarches,
} from "./attack-marches.js";

const optionalNumber = (value, max, label, integer = true) => {
  if (value != null) number(value, 0, max, label, integer);
};
function validateBuffs(buffs) {
  if (!buffs || typeof buffs !== "object" || Array.isArray(buffs))
    throw new Error("Invalid buffs.");
  for (const context of BUFF_CONTEXTS) {
    const group = buffs[context];
    if (group === undefined) continue;
    if (!group || typeof group !== "object" || Array.isArray(group))
      throw new Error("Invalid buff context.");
    for (const type of TROOP_TYPES) {
      const stats = group[type];
      if (stats === undefined) continue;
      if (!stats || typeof stats !== "object" || Array.isArray(stats))
        throw new Error("Invalid troop buffs.");
      for (const stat of BUFF_TYPES)
        optionalNumber(
          stats[stat],
          1000000,
          `${context} ${type} ${stat} buff`,
          false,
        );
    }
  }
}
function validateDebuffs(debuffs) {
  if (!debuffs || typeof debuffs !== "object" || Array.isArray(debuffs))
    throw new Error("Invalid debuffs.");
  for (const type of TROOP_TYPES) {
    const stats = debuffs[type];
    if (stats === undefined) continue;
    if (!stats || typeof stats !== "object" || Array.isArray(stats))
      throw new Error("Invalid troop debuffs.");
    for (const stat of BUFF_TYPES)
      if (stats[stat] != null)
        number(stats[stat], -1000000, 0, `${type} ${stat} debuff`, false);
  }
}
function validateMarchSizes(sizes) {
  if (!sizes || typeof sizes !== "object" || Array.isArray(sizes))
    throw new Error("Invalid march sizes.");
  for (const type of TROOP_TYPES)
    optionalNumber(sizes[type], Number.MAX_SAFE_INTEGER, "march size");
}
function validateSubcities(cities) {
  if (!Array.isArray(cities) || cities.length > 50)
    throw new Error("Maximum 50 subcities per player.");
  const ids = new Set();
  for (const city of cities) {
    if (!city || typeof city !== "object") throw new Error("Invalid subcity.");
    string(city.id, 120, "subcity ID");
    if (!city.id || ids.has(city.id))
      throw new Error("Invalid or duplicate subcity ID.");
    ids.add(city.id);
    for (const key of ["name", "culture", "quality", "mayor"])
      if (city[key] !== undefined) string(city[key], 100, `subcity ${key}`);
    for (const key of ["level", "server", "x", "y"])
      optionalNumber(city[key], 1000000, `subcity ${key}`);
    if ((city.x == null) !== (city.y == null))
      throw new Error("Enter both subcity coordinates, or leave both blank.");
  }
}
export function validatePlayerDetails(details) {
  if (!details || typeof details !== "object" || Array.isArray(details))
    throw new Error("Invalid player details.");
  for (const key of ["marchSize", "rallyCapacity"])
    optionalNumber(details[key], Number.MAX_SAFE_INTEGER, key);
  optionalNumber(details.marchBoost, 1000000, "march-size boost", false);
  if (details.buffs !== undefined) validateBuffs(details.buffs);
  if (details.debuffs !== undefined) validateDebuffs(details.debuffs);
  if (details.marchSizes !== undefined) validateMarchSizes(details.marchSizes);
  if (details.marches !== undefined) validateMarches(details.marches);
  if (details.reinforcementMarches !== undefined)
    validateReinforcementMarches(details.reinforcementMarches);
  if (details.troops !== undefined) validateTroops(details.troops);
  if (details.subcities !== undefined) validateSubcities(details.subcities);
  return details;
}
