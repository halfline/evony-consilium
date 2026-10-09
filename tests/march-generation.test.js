import test from "node:test";
import assert from "node:assert/strict";
import { marchType, marchCapacity, strategyWeights, initialGeneration, validateGeneration } from "../web/src/domain/march-generation.js";

test("march type and capacity use explicit settings before inferred defaults", () => {
  assert.equal(marchType({ name: "Archers" }), "ranged");
  assert.equal(marchType({ name: "Archers", troopType: "siege" }), "siege");
  assert.equal(marchCapacity({ name: "Archers" }, { ranged: 500 }), 500);
  assert.equal(marchCapacity({ name: "Archers", capacityOverride: 700 }, { ranged: 500 }), 700);
  assert.equal(marchCapacity({ name: "Unknown" }), null);
});

test("march generation rejects invalid capacity and tier shares", () => {
  const march = { name: "Archers", generation: initialGeneration({ name: "Archers" }, 15) };
  assert.doesNotThrow(() => validateGeneration(march));
  assert.throws(() => validateGeneration({ ...march, capacityOverride: -1 }), /march capacity/);
  assert.throws(
    () => validateGeneration({ ...march, generation: { ...march.generation, weights: { 15: 80 } } }),
    /total 100%/,
  );
});

test("default march generation assigns normalized tier weights", () => {
  const settings = initialGeneration({ name: "Archers" }, 15);
  assert.equal(settings.strategy, "balanced");
  assert.equal(settings.highestTier, 15);
  assert.equal(Object.values(settings.weights).reduce((sum, weight) => sum + weight, 0), 100);
  assert.equal(strategyWeights("siege", "small-siege", 15)[11], 100);
});
