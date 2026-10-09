import test from "node:test";
import assert from "node:assert/strict";
import { saveSubcity, removeSubcity, assignSubcityOwner, validateSubcities } from "../web/src/domain/subcities.js";
import { createEmptyPlan } from "../web/src/domain/plan.js";

const values = { name: "", culture: "Japan", color: "gold", x: 0, y: 1199 };
const redTypes = [
  { id: "famouscity-1001", name: "Rostock", culture: "Europe", color: "red" },
  { id: "famouscity-10001", name: "Germany Famous City", culture: "Germany", color: "red" },
];

test("saving a city keeps fixed coordinates and edits its existing record", () => {
  const original = createEmptyPlan();
  const saved = saveSubcity(original, values);
  assert.deepEqual(original.subcities, []);
  const city = saved.subcities[0];
  assert.equal(city.x, 0);
  assert.equal(city.y, 1199);
  const edited = saveSubcity(saved, { ...values, culture: "Korea", x: 10, y: 20 }, city.id);
  assert.equal(edited.subcities[0].id, city.id);
  assert.equal(edited.subcities[0].culture, "Korea");
});

test("red cities require a specific matching catalog choice", () => {
  let plan = createEmptyPlan();
  for (const type of redTypes)
    plan = saveSubcity(plan, { ...values, culture: type.culture, color: "red", cityType: type.id }, null, redTypes);
  assert.equal(plan.subcities.length, 2);
  assert.throws(() => saveSubcity(plan, { ...values, color: "red", cityType: "" }), /specific red subcity/);
  assert.throws(() => saveSubcity(plan, { ...values, color: "red", cityType: "unknown" }, null, redTypes), /specific red subcity/);
});

test("city import rejects duplicate IDs and malformed coordinates", () => {
  const city = saveSubcity(createEmptyPlan(), values).subcities[0];
  for (const patch of [{ x: -1 }, { y: 1200 }, { x: 0.5 }, { x: null }, { culture: "invalid" }, { color: "invalid" }])
    assert.throws(() => validateSubcities([{ ...city, ...patch }]));
  assert.throws(() => validateSubcities([city, city]), /Duplicate/);
  assert.equal(saveSubcity({ ...createEmptyPlan(), subcities: [city] }, { ...values, x: null, y: null }, city.id).subcities[0].x, null);
});

test("removing a city leaves the source team unchanged", () => {
  const plan = saveSubcity(createEmptyPlan(), values);
  const id = plan.subcities[0].id;
  const removed = removeSubcity(plan, id);
  assert.equal(removed.subcities.length, 0);
  assert.equal(plan.subcities[0].id, id);
});

test("city ownership is one optional reference to a team player", () => {
  const original = createEmptyPlan();
  original.keeps = [{ id: "first" }, { id: "second" }];
  const unowned = saveSubcity(original, values);
  const id = unowned.subcities[0].id;
  const assigned = assignSubcityOwner(unowned, id, "first");
  assert.equal(assigned.subcities[0].ownerId, "first");
  assert.equal(unowned.subcities[0].ownerId, null);
  const transferred = assignSubcityOwner(assigned, id, "second");
  assert.equal(transferred.subcities[0].ownerId, "second");
  assert.equal(saveSubcity(transferred, { ...values, x: 100 }, id).subcities[0].ownerId, "second");
  assert.equal(assignSubcityOwner(assigned, id, null).subcities[0].ownerId, null);
  assert.throws(() => assignSubcityOwner(assigned, id, "unknown"), /player on this team/);
  assert.throws(() => assignSubcityOwner(assigned, "missing", null), /Subcity not found/);
});
