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
export function validateGeneration(march) {
  if (march.capacityOverride != null)
    number(
      march.capacityOverride,
      0,
      Number.MAX_SAFE_INTEGER,
      "march capacity",
    );
  const g = march.generation;
  if (!g) return;
  if (!TROOP_TYPES.includes(marchType(march)))
    throw new Error("Choose a march troop type.");
  if (!["balanced", "big-siege", "small-siege"].includes(g.strategy))
    throw new Error("Choose a march strategy.");
  number(g.highestTier, 10, 17, "highest troop tier");
  number(g.layerSize, 0, Number.MAX_SAFE_INTEGER, "layer size");
  if (typeof g.manual !== "boolean")
    throw new Error("Invalid march editing state.");
  if (!g.weights || typeof g.weights !== "object" || Array.isArray(g.weights))
    throw new Error("Invalid march percentages.");
  for (const [tier, weight] of Object.entries(g.weights)) {
    number(Number(tier), 10, g.highestTier, "allocation tier");
    number(weight, 0, 100, "tier share", false);
  }
  const sum = Object.values(g.weights).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 100) > 0.00001)
    throw new Error("Tier shares must total 100%.");
  if (g.strategy === "small-siege" && g.highestTier < 11)
    throw new Error("Small siege requires T11.");
}
export function regenerateMarch(march, sizes) {
  validateGeneration(march);
  if (!march.generation || march.generation.manual)
    return structuredClone(march);
  const capacity = marchCapacity(march, sizes);
  const next = structuredClone(march);
  const g = next.generation,
    type = marchType(next);
  const bulk = Object.entries(g.weights)
    .filter(([, weight]) => weight > 0)
    .map(([tier, weight]) => ({ tier: Number(tier), weight }));
  if (capacity == null) {
    next.layers = [];
    next.bases = {};
    next.baseThrough = 9;
    return next;
  }
  number(capacity, 0, Number.MAX_SAFE_INTEGER, "march capacity");
  const reserve = (4 * g.highestTier - bulk.length) * g.layerSize;
  if (!Number.isSafeInteger(reserve) || reserve > capacity)
    throw new Error("March capacity is smaller than its support layers.");
  const remaining = capacity - reserve;
  // Integer arithmetic avoids losing troops even at large capacities.
  const weighted = bulk.map((row) => ({
    ...row,
    units: BigInt(Math.round(row.weight * 1000000)),
  }));
  const units = weighted.reduce((sum, row) => sum + row.units, 0n);
  const allocation = weighted.map(({ tier, units: weight }) => {
    const product = BigInt(remaining) * weight;
    return { tier, count: Number(product / units), fraction: product % units };
  });
  let leftover =
    remaining - allocation.reduce((sum, row) => sum + row.count, 0);
  for (const row of [...allocation].sort((a, b) =>
    a.fraction === b.fraction
      ? b.tier - a.tier
      : a.fraction > b.fraction
        ? -1
        : 1,
  )) {
    if (leftover-- > 0) row.count++;
  }
  next.bases = Object.fromEntries(TROOP_TYPES.map((t) => [t, g.layerSize]));
  next.baseThrough = 9;
  next.layers = Array.from({ length: g.highestTier - 9 }, (_, i) => {
    const tier = i + 10;
    const row = {
      tier,
      ...Object.fromEntries(TROOP_TYPES.map((t) => [t, g.layerSize])),
    };
    const main = allocation.find((a) => a.tier === tier);
    if (main) row[type] = main.count;
    return row;
  });
  return next;
}
