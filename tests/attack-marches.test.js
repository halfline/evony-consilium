import test from "node:test";
import assert from "node:assert/strict";
import { marchTotals } from "../web/src/domain/attack-marches.js";

test("march totals include every lower-tier base layer", () => {
  const march = {
    layers: [{ tier: 15, ground: 2_295_435 }],
    bases: { ground: 5_000, ranged: 5_000, mounted: 5_000, siege: 5_000 },
    baseThrough: 9,
  };
  assert.equal(marchTotals(march).total, 2_295_435 + 4 * 5_000 * 9);
  assert.equal(marchTotals(march).ground, 2_295_435 + 5_000 * 9);
});
