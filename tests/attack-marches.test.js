import test from "node:test";
import assert from "node:assert/strict";
import { marchTotals, validateMarches, newMarch } from "../web/src/domain/attack-marches.js";

test("march totals include every lower-tier base layer", () => {
  const march = {
    layers: [{ tier: 15, ground: 2_295_435 }],
    bases: { ground: 5_000, ranged: 5_000, mounted: 5_000, siege: 5_000 },
    baseThrough: 9,
  };
  assert.equal(marchTotals(march).total, 2_295_435 + 4 * 5_000 * 9);
  assert.equal(marchTotals(march).ground, 2_295_435 + 5_000 * 9);
});

test("new marches start with validated generated settings", () => {
  const march = newMarch("Siege", "siege", 15);
  assert.equal(march.name, "Siege");
  assert.equal(march.generation.highestTier, 15);
  assert.equal(march.generation.strategy, "big-siege");
  assert.doesNotThrow(() => validateMarches([march]));
});

test("attack march validation rejects duplicate IDs and overlapping bases", () => {
  const march = { id: "ground", name: "Ground", layers: [{ tier: 15, ground: 100 }], bases: { ground: 5000 }, baseThrough: 9 };
  assert.doesNotThrow(() => validateMarches([march]));
  assert.throws(() => validateMarches([march, march]), /duplicate march ID/);
  assert.throws(
    () => validateMarches([{ ...march, layers: [{ tier: 9, ground: 100 }] }]),
    /overlap/,
  );
});
