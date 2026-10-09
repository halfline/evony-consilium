import test from "node:test";
import assert from "node:assert/strict";
import { validatePlayerDetails } from "../web/src/domain/player-details-schema.js";

test("player buffs, march sizes, troops, and attack marches validate independently", () => {
  const details = {
    buffs: { city: { ground: { attack: 3385 } }, rally: { ground: { hp: 0 } } },
    marchSizes: { ground: 7_936_450, ranged: null },
    troops: [{ tier: 1, ground: 100 }],
    marches: [{ id: "g", name: "Ground", layers: [{ tier: 15, ground: 100 }] }],
  };
  assert.equal(validatePlayerDetails(details), details);
  assert.throws(() => validatePlayerDetails({ buffs: { rally: { ground: { attack: -1 } } } }), /buff/);
  assert.throws(() => validatePlayerDetails({ marchSizes: { ground: -1 } }), /march size/);
  assert.throws(() => validatePlayerDetails({ troops: [{ tier: 1, ground: 1.5 }] }), /troop count/);
});
