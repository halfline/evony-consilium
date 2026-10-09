import test from "node:test";
import assert from "node:assert/strict";
import { defaultRallySetter, ensureRallySetter } from "../web/src/domain/rally.js";

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
