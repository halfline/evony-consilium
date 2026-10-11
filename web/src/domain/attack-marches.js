import { number, string } from "./constraints.js";
import { TROOP_TYPES, troopTotals, validateTroops } from "./troops.js";
import { initialGeneration, validateGeneration } from "./march-generation.js";

export function validateMarches(marches, kind = "attack") {
  if (!Array.isArray(marches) || marches.length > 50)
    throw new Error(`Maximum 50 ${kind} marches.`);
  const ids = new Set();
  for (const march of marches) {
    if (!march || typeof march !== "object" || Array.isArray(march))
      throw new Error(`Invalid ${kind} march.`);
    string(march.id, 120, "march ID");
    if (!march.id || ids.has(march.id))
      throw new Error("Invalid or duplicate march ID.");
    ids.add(march.id);
    string(march.name, 100, "march name");
    if (march.troopType !== undefined && !TROOP_TYPES.includes(march.troopType))
      throw new Error("Choose a march troop type.");
    if (!march.name.trim()) throw new Error("Enter a march name.");
    if (march.capacityOverride != null)
      number(
        march.capacityOverride,
        0,
        Number.MAX_SAFE_INTEGER,
        "march capacity",
      );
    validateGeneration(march);
    if (march.layers !== undefined) validateTroops(march.layers);
    if (march.baseThrough != null)
      number(march.baseThrough, 0, 100, "base layer tier");
    if (march.bases !== undefined) {
      if (
        !march.bases ||
        typeof march.bases !== "object" ||
        Array.isArray(march.bases)
      )
        throw new Error("Invalid base layers.");
      for (const type of TROOP_TYPES)
        if (march.bases[type] != null)
          number(
            march.bases[type],
            0,
            Number.MAX_SAFE_INTEGER,
            "base layer count",
          );
      if (
        Object.values(march.bases).some((value) => value != null) &&
        march.layers?.some((row) => row.tier <= (march.baseThrough ?? 9))
      )
        throw new Error("Base layers overlap an explicit troop tier.");
    }
    marchTotals(march);
  }
  return marches;
}

export function validateReinforcementMarches(marches) {
  if (
    Array.isArray(marches) &&
    marches.some((march) => march?.generation !== undefined)
  )
    throw new Error("Reinforcement marches must be entered manually.");
  validateMarches(marches, "reinforcement");
  return marches;
}

export function marchTotals(march) {
  const totals = troopTotals(march.layers || []);
  for (const type of TROOP_TYPES) {
    if (march.bases?.[type] == null) continue;
    const count = march.bases[type] * (march.baseThrough ?? 9);
    totals[type] = (totals[type] ?? 0) + count;
    totals.total = (totals.total ?? 0) + count;
    if (!Number.isSafeInteger(totals.total))
      throw new Error("March total exceeds the supported range.");
  }
  return totals;
}

export function newMarch(name, troopType, highestTier) {
  const march = { id: crypto.randomUUID(), name, troopType, layers: [] };
  march.generation = initialGeneration(march, highestTier);
  return march;
}
