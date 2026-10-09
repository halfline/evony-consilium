import { number } from "./constraints.js";
import {
  TROOP_TYPES,
  BUFF_CONTEXTS,
  BUFF_TYPES,
  validateTroops,
} from "./troops.js";
import { validateMarches } from "./attack-marches.js";

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
function validateMarchSizes(sizes) {
  if (!sizes || typeof sizes !== "object" || Array.isArray(sizes))
    throw new Error("Invalid march sizes.");
  for (const type of TROOP_TYPES)
    optionalNumber(sizes[type], Number.MAX_SAFE_INTEGER, "march size");
}
export function validatePlayerDetails(details) {
  if (!details || typeof details !== "object" || Array.isArray(details))
    throw new Error("Invalid player details.");
  for (const key of ["marchSize", "rallyCapacity"])
    optionalNumber(details[key], Number.MAX_SAFE_INTEGER, key);
  optionalNumber(details.marchBoost, 1000000, "march-size boost", false);
  if (details.buffs !== undefined) validateBuffs(details.buffs);
  if (details.marchSizes !== undefined) validateMarchSizes(details.marchSizes);
  if (details.marches !== undefined) validateMarches(details.marches);
  if (details.troops !== undefined) validateTroops(details.troops);
  return details;
}
