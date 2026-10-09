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

test("personal subcities require unique IDs and complete coordinates", () => {
  const city = { id: "city-1", name: "Gold City", x: 0, y: 1199 };
  const details = { subcities: [city] };
  assert.equal(validatePlayerDetails(details), details);
  assert.throws(
    () => validatePlayerDetails({ subcities: [city, city] }),
    /duplicate subcity ID/,
  );
  assert.throws(
    () => validatePlayerDetails({ subcities: [{ id: "city-2", x: 12 }] }),
    /both subcity coordinates/,
  );
  assert.throws(
    () => validatePlayerDetails({ subcities: Array.from({ length: 51 }, (_, i) => ({ id: `city-${i}` })) }),
    /Maximum 50 subcities/,
  );
});
