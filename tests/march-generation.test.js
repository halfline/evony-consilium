import { marchTotals } from "../web/src/domain/attack-marches.js";
import test from "node:test";
import assert from "node:assert/strict";
import {
  initialGeneration,
  regenerateMarch,
  marchCapacity,
} from "../web/src/domain/march-generation.js";
import { editPlayerDetails } from "../web/src/domain/player-details.js";
function preset(name, highest = 15) {
  const march = { id: name, name, layers: [] };
  march.generation = initialGeneration(march, highest);
  return march;
}
test("workbook allocations reserve every supporting type and tier", () => {
  const cases = [
    ["Ground", "ground", 7936450, { 15: 2295435, 14: 3825725, 13: 1530290 }],
    ["Mounted", "mounted", 7911750, { 15: 2288025, 14: 3813375, 13: 1525350 }],
    [
      "Archers",
      "ranged",
      8022350,
      { 15: 774235, 14: 1548470, 13: 2322705, 12: 3096940 },
    ],
    ["Small Siege", "siege", 7761650, { 11: 7466650 }],
  ];
  for (const [name, type, capacity, counts] of cases) {
    const generated = regenerateMarch(preset(name), { [type]: capacity });
    assert.equal(marchTotals(generated).total, capacity);
    for (const [tier, count] of Object.entries(counts))
      assert.equal(
        generated.layers.find((row) => row.tier === +tier)[type],
        count,
      );
    assert.equal(generated.layers.find((row) => row.tier === 10).ground, 5000);
  }
});
test("integer rounding fills capacity at every supported maximum tier", () => {
  for (const highest of [10, 11, 12, 14, 15, 16, 17])
    for (const name of ["Ground", "Archers", "Mounted", "Siege"]) {
      const generated = regenerateMarch(preset(name, highest), {
        ground: 8000001,
        ranged: 8000001,
        mounted: 8000001,
        siege: 8000001,
      });
      assert.equal(marchTotals(generated).total, 8000001);
      assert.ok(generated.layers.every((row) => row.tier <= highest));
      assert.ok(
        generated.layers.every((row) =>
          Object.values(row).every(Number.isSafeInteger),
        ),
      );
    }
  const siege = regenerateMarch(preset("Siege"), { siege: 7761650 });
  assert.equal(marchTotals(siege).total, 7761650);
  assert.equal(siege.layers.find((row) => row.tier === 13).siege, 4488990);
});
test("manual marches freeze entirely, and capacity overrides isolate generated marches", () => {
  let automatic = regenerateMarch(preset("Ground"), { ground: 8000000 });
  const manual = structuredClone(automatic);
  manual.id = "manual";
  manual.generation.manual = true;
  manual.layers[0].ground = 123;
  const overridden = structuredClone(automatic);
  overridden.id = "override";
  overridden.capacityOverride = 7000000;
  const plan = {
    keeps: [
      {
        id: "p",
        details: {
          marchSizes: { ground: 8000000 },
          marches: [automatic, manual, overridden],
        },
      },
    ],
  };
  const next = editPlayerDetails(plan, "p", {
    marchSizes: { ground: 9000000 },
  });
  const marches = next.keeps[0].details.marches;
  assert.equal(marchTotals(marches[0]).total, 9000000);
  assert.deepEqual(marches[1].layers, manual.layers);
  assert.deepEqual(marches[1].bases, manual.bases);
  assert.equal(marchTotals(marches[2]).total, 7000000);
  assert.equal(marchCapacity(marches[1], { ground: 9000000 }), 9000000);
  const reset = {
    ...manual,
    generation: { ...manual.generation, manual: false },
  };
  assert.equal(
    marchTotals(regenerateMarch(reset, { ground: 9000000 })).total,
    9000000,
  );
  assert.equal(plan.keeps[0].details.marchSizes.ground, 8000000);
});
test("missing capacity remains blank and impossible allocations fail explicitly", () => {
  assert.deepEqual(regenerateMarch(preset("Ground"), {}).layers, []);
  assert.throws(
    () => regenerateMarch(preset("Ground"), { ground: 1000 }),
    /support layers/,
  );
  const invalid = preset("Ground");
  invalid.generation.weights[15] = 40;
  assert.throws(() => regenerateMarch(invalid, { ground: 8000000 }), /100%/);
  const legacy = {
    id: "legacy",
    name: "Ground",
    layers: [{ tier: 15, ground: 123 }],
  };
  assert.deepEqual(regenerateMarch(legacy, { ground: 8000000 }), legacy);
});

test("large capacities do not lose troops to floating point rounding", () => {
  const generated = regenerateMarch(preset("Siege"), {
    siege: Number.MAX_SAFE_INTEGER,
  });
  assert.equal(marchTotals(generated).total, Number.MAX_SAFE_INTEGER);
});
