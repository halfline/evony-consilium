import test from "node:test";
import assert from "node:assert/strict";
import { defaultRallySetter, ensureRallySetter, setRallySetter, ensureMapRallySetters } from "../web/src/domain/rally.js";

test("default rally setter prefers strongest keep and breaks ties by name", () => {
  const plan = { keeps: [
    { id: "z", name: "Zulu", level: 42 },
    { id: "a", name: "Alpha", level: 42 },
    { id: "b", name: "Beta", level: 40 },
  ], rallyId: null, rallyManual: false };
  assert.equal(defaultRallySetter(plan), "a");
  ensureRallySetter(plan);
  assert.equal(plan.rallyId, "a");
  assert.equal(plan.rallyManual, false);
  plan.rallyManual = true;
  plan.rallyId = "b";
  ensureRallySetter(plan);
  assert.equal(plan.rallyId, "b");
  plan.keeps = plan.keeps.filter(({ id }) => id !== "b");
  ensureRallySetter(plan);
  assert.equal(plan.rallyId, "a");
  assert.equal(plan.rallyManual, false);
});

test("manual rally choice is immutable and survives stronger recruits", () => {
  const plan = { keeps: [
    { id: "a", name: "Alpha", level: 30 },
    { id: "b", name: "Beta", level: 45 },
  ], rallyId: "b", rallyManual: false };
  const chosen = setRallySetter(plan, "a");
  assert.equal(plan.rallyId, "b");
  assert.equal(chosen.rallyId, "a");
  assert.equal(chosen.rallyManual, true);
  chosen.keeps.push({ id: "c", name: "Charlie", level: 50 });
  ensureRallySetter(chosen);
  assert.equal(chosen.rallyId, "a");
  assert.throws(() => setRallySetter(plan, "missing"), /Choose a player/);
});

test("each map keeps its manual rally choice while other maps use default", () => {
  const plan = { keeps: [
    { id: "a", name: "Alpha", level: 30 },
    { id: "b", name: "Beta", level: 45 },
  ], rallyId: null, rallyManual: false, maps: [
    { layout: { rallyId: "a", rallyManual: true } },
    { layout: { rallyId: null, rallyManual: false } },
  ] };
  ensureMapRallySetters(plan);
  assert.equal(plan.rallyId, "b");
  assert.deepEqual(plan.maps.map(({ layout }) => layout.rallyId), ["a", "b"]);
  plan.keeps = plan.keeps.filter(({ id }) => id !== "a");
  ensureMapRallySetters(plan);
  assert.equal(plan.maps[0].layout.rallyId, "b");
  assert.equal(plan.maps[0].layout.rallyManual, false);
});
