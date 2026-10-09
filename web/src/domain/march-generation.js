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
export function strategyWeights(type, strategy, highest) {
  let entries;
  if (strategy === "small-siege") entries = [[11, 100]];
  else if (type === "siege")
    entries = [
      [15, 5],
      [14, 10],
      [13, 60],
      [12, 25],
    ];
  else if (type === "ranged" && highest >= 12)
    entries = [
      [15, 10],
      [14, 20],
      [13, 30],
      [12, 40],
    ];
  else
    entries = [
      [highest, 30],
      [highest - 1, 50],
      [highest - 2, 20],
    ];
  entries = entries.filter(([tier]) => tier <= highest && tier >= 10);
  if (!entries.length) entries = [[highest, 100]];
  const sum = entries.reduce((total, [, weight]) => total + weight, 0);
  const weights = Object.fromEntries(
    entries.map(([tier, weight]) => [
      tier,
      Math.round((weight / sum) * 10000) / 100,
    ]),
  );
  weights[entries[0][0]] +=
    100 - Object.values(weights).reduce((a, b) => a + b, 0);
  return weights;
}
export function initialGeneration(march, highestTier) {
  const type = marchType(march);
  const strategy =
    type === "siege"
      ? /small/i.test(march.name)
        ? "small-siege"
        : "big-siege"
      : "balanced";
  return {
    strategy,
    highestTier,
    layerSize: 5000,
    weights: strategyWeights(type, strategy, highestTier),
    manual: false,
  };
}
