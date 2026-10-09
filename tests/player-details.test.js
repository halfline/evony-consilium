import { validatePlayerDetails } from "../web/src/domain/player-details-schema.js";
import { troopTotals } from "../web/src/domain/troops.js";
import { marchTotals } from "../web/src/domain/attack-marches.js";
import test from "node:test";
import assert from "node:assert/strict";
import { editPlayerDetails } from "../web/src/domain/player-details.js";
import { createDemoPlan } from "../web/src/domain/plan.js";
import { validatePlan } from "../web/src/domain/validation.js";
import { createMapPlan, selectMapPlan } from "../web/src/domain/map-plans.js";
import { TeamStore } from "../web/src/application/team-store.js";
import { catalog } from "./fixtures/catalog.js";
test("buff contexts and march sizes remain independent, with unknown distinct from zero", () => {
  const details = {
    buffs: {
      city: { ground: { attack: 3385 } },
      rally: { ground: { attack: 4333 } },
      solo: { ground: { attack: 3758, hp: 0 } },
    },
    marchSizes: { ground: 7936450, ranged: null },
    marchBoost: 200,
  };
  assert.equal(validatePlayerDetails(details), details);
  assert.equal(troopTotals().total, null);
  assert.equal(troopTotals([{ tier: 1, ground: 0 }]).total, 0);
  assert.throws(() =>
    validatePlayerDetails({ buffs: { rally: { ground: { attack: -1 } } } }),
  );
});
test("base counts apply to every lower tier and overlapping explicit layers are rejected", () => {
  const march = {
    id: "g",
    name: "Ground",
    layers: [{ tier: 15, ground: 2295435 }],
    bases: { ground: 5000, ranged: 5000, mounted: 5000, siege: 5000 },
    baseThrough: 9,
  };
  assert.equal(marchTotals(march).total, 2295435 + 4 * 5000 * 9);
  assert.equal(marchTotals(march).ground, 2295435 + 5000 * 9);
  assert.doesNotThrow(() => validatePlayerDetails({ marches: [march] }));
  assert.throws(
    () =>
      validatePlayerDetails({
        marches: [{ ...march, layers: [{ tier: 9, ground: 1 }] }],
      }),
    /overlap/,
  );
});
test("invalid counts, repeated tiers, and incomplete subcity coordinates cannot enter shared data", () => {
  for (const details of [
    { troops: [{ tier: 1, ground: 1.5 }] },
    { troops: [{ tier: 1 }, { tier: 1 }] },
    { marchSize: -1 },
    { troops: [{ tier: 1, ground: Number.MAX_SAFE_INTEGER, siege: 1 }] },
    { subcities: [{ id: "a", x: 10, y: null }] },
    { subcities: [{ id: "a" }, { id: "a" }] },
    { marches: [{ id: "a", name: "", layers: [] }] },
  ])
    assert.throws(() => validatePlayerDetails(details));
});
test("details survive map switches, shared-file validation, and Undo without changing placements", () => {
  const store = new TeamStore(catalog);
  store.replace(createDemoPlan(catalog));
  const player = store.plan.keeps[0],
    first = store.plan.activeMapId;
  store.commit(createMapPlan(store.plan, "blank", "Second"));
  const before = structuredClone(store.plan.keeps[0]);
  const details = {
    marchSizes: { ground: 7936450 },
    buffs: { city: { ground: { attack: 3385 } } },
    marches: [
      {
        id: "g",
        name: "Ground",
        layers: [{ tier: 15, ground: 2295435 }],
        bases: { ground: 5000 },
        baseThrough: 9,
      },
    ],
    subcities: [
      {
        id: "sub",
        culture: "Japan",
        quality: "Gold",
        name: "Main",
        x: 299,
        y: 299,
      },
    ],
  };
  store.commit(editPlayerDetails(store.plan, player.id, details));
  assert.equal(store.plan.keeps[0].x, before.x);
  const restored = validatePlan(
    JSON.parse(JSON.stringify(selectMapPlan(store.plan, first))),
    catalog,
  );
  assert.equal(restored.keeps[0].x, player.x);
  assert.deepEqual(restored.keeps[0].details, { ...details, marchBoost: 200 });
  store.undo();
  assert.equal(store.plan.keeps[0].details, undefined);
});
