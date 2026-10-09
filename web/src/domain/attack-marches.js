import { TROOP_TYPES, troopTotals } from "./troops.js";

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
