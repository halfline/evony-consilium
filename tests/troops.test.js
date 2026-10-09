import test from "node:test";
import assert from "node:assert/strict";
import { troopTotals, validateTroops } from "../web/src/domain/troops.js";

test("troop totals distinguish unknown counts from zero", () => {
  assert.equal(troopTotals().total, null);
  assert.deepEqual(troopTotals([{ tier: 1, ground: 0 }]).ground, 0);
  assert.equal(troopTotals([{ tier: 1, ground: 3 }, { tier: 2, ground: 4 }]).total, 7);
});

test("troop tiers and counts reject duplicates, fractions, and unsafe sums", () => {
  assert.throws(() => validateTroops([{ tier: 1 }, { tier: 1 }]), /Duplicate/);
  assert.throws(() => validateTroops([{ tier: 1, ground: 1.5 }]), /troop count/);
  assert.throws(
    () => validateTroops([{ tier: 1, ground: Number.MAX_SAFE_INTEGER, siege: 1 }]),
    /supported range/,
  );
});
