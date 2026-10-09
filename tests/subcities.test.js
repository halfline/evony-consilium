import test from "node:test";
import assert from "node:assert/strict";
import {
  saveSubcity,
  removeSubcity,
  validateSubcities,
} from "../web/src/domain/subcities.js";
import { createEmptyPlan } from "../web/src/domain/plan.js";
import { validatePlan } from "../web/src/domain/validation.js";
import {
  createMapPlan,
  selectMapPlan,
  projectFingerprint,
} from "../web/src/domain/map-plans.js";
import { catalog } from "./fixtures/catalog.js";
const redTypes = [
  { id: "famouscity-1001", name: "Rostock", culture: "Europe", color: "red" },
  {
    id: "famouscity-10001",
    name: "Germany Famous City",
    culture: "Germany",
    color: "red",
  },
];
const values = { name: "", culture: "Japan", color: "gold", x: 0, y: 1199 };

test("subcities retain culture, color and fixed server coordinates across map layouts", () => {
  const original = createEmptyPlan();
  const plan = saveSubcity(original, values);
  assert.deepEqual(original.subcities, []);
  const id = plan.subcities[0].id;
  const first = createMapPlan(plan, "server", "Hive");
  const second = createMapPlan(first, "boc", "Rally");
  assert.deepEqual(second.subcities, plan.subcities);
  assert.deepEqual(
    selectMapPlan(second, first.activeMapId).subcities,
    plan.subcities,
  );
  const edited = saveSubcity(
    second,
    { ...values, culture: "Korea", x: 10, y: 20 },
    id,
  );
  assert.equal(edited.subcities[0].id, id);
  assert.equal(edited.subcities[0].culture, "Korea");
  assert.equal(removeSubcity(edited, id).subcities.length, 0);
});
test("red subcities require a specific city and preserve both historic and cultural choices", () => {
  let plan = createEmptyPlan();
  for (const type of redTypes)
    plan = saveSubcity(
      plan,
      { ...values, culture: type.culture, color: "red", cityType: type.id },
      null,
      redTypes,
    );
  assert.equal(
    validatePlan(plan, { ...catalog, subcityTypes: redTypes }).subcities.length,
    2,
  );
  assert.notEqual(plan.subcities[0].cityType, plan.subcities[1].cityType);
  assert.throws(
    () => saveSubcity(plan, { ...values, color: "red", cityType: "" }),
    /specific red subcity/,
  );
  assert.throws(
    () =>
      saveSubcity(
        plan,
        { ...values, color: "red", cityType: redTypes[0].id },
        null,
        redTypes,
      ),
    /specific red subcity/,
  );
  assert.throws(
    () =>
      saveSubcity(
        plan,
        { ...values, color: "red", cityType: "unknown" },
        null,
        redTypes,
      ),
    /specific red subcity/,
  );
});
test("subcity imports reject malformed records and coordinates while supporting old teams", () => {
  const plan = saveSubcity(createEmptyPlan(), values);
  const city = plan.subcities[0];
  for (const patch of [
    { x: -1 },
    { y: 1200 },
    { x: 0.5 },
    { x: null },
    { culture: "invalid" },
    { color: "invalid" },
  ])
    assert.throws(() => validateSubcities([{ ...city, ...patch }]));
  assert.throws(() => validateSubcities([city, city]), /Duplicate/);
  const emptyCoordinates = saveSubcity(
    plan,
    { ...values, x: null, y: null },
    city.id,
  );
  assert.equal(validatePlan(emptyCoordinates, catalog).subcities[0].x, null);
  const legacy = createEmptyPlan();
  delete legacy.subcities;
  assert.deepEqual(validatePlan(legacy, catalog).subcities, []);
  assert.equal(
    projectFingerprint(legacy),
    projectFingerprint(createEmptyPlan()),
  );
});

test("subcity ownership is a single optional team-player reference", async () => {
  const { assignSubcityOwner } = await import("../web/src/domain/subcities.js");
  const { createDemoPlan } = await import("../web/src/domain/plan.js");
  const { removePlayer } = await import("../web/src/domain/players.js");
  const team = validatePlan(createDemoPlan(catalog), catalog);
  const [first, second] = team.keeps;
  const unowned = saveSubcity(team, values);
  const city = unowned.subcities[0];
  const assigned = assignSubcityOwner(unowned, city.id, first.id);
  assert.equal(assigned.subcities[0].ownerId, first.id);
  assert.equal(unowned.subcities[0].ownerId, null);
  assert.deepEqual(assigned.keeps, unowned.keeps);
  assert.equal(validatePlan(assigned, catalog).subcities[0].ownerId, first.id);
  const transferred = assignSubcityOwner(assigned, city.id, second.id);
  assert.equal(transferred.subcities[0].ownerId, second.id);
  const edited = saveSubcity(transferred, { ...values, x: 100 }, city.id);
  assert.equal(edited.subcities[0].ownerId, second.id);
  const released = removePlayer(edited, second.id);
  assert.equal(released.subcities.length, 1);
  assert.equal(released.subcities[0].ownerId, null);
  assert.equal(
    assignSubcityOwner(assigned, city.id, null).subcities[0].ownerId,
    null,
  );
  assert.throws(
    () => assignSubcityOwner(assigned, city.id, "unknown"),
    /player on this team/,
  );
  assert.throws(
    () => assignSubcityOwner(assigned, "missing", null),
    /Subcity not found/,
  );
  assert.throws(
    () =>
      validatePlan(
        { ...assigned, subcities: [{ ...city, ownerId: "unknown" }] },
        catalog,
      ),
    /player on this team/,
  );
  assert.throws(
    () => saveSubcity(team, { ...values, ownerId: "unknown" }),
    /player on this team/,
  );
});
