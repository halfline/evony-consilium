import test from "node:test";
import assert from "node:assert/strict";
import { PlacementSelection } from "../web/src/application/placement-selection.js";

test("selection reconciles primary, pending, and group members after team edits", () => {
  let plan = {
    keeps: [{ id: "player" }],
    structures: [{ id: "building" }],
    obstacles: [{ id: "blocked" }],
  };
  const selection = new PlacementSelection(() => plan);
  selection.select("player");
  selection.pending = "building";
  selection.ids.add("player").add("blocked");
  assert.equal(selection.selected, plan.keeps[0]);
  plan = { keeps: [], structures: [], obstacles: [{ id: "blocked" }] };
  selection.reconcile();
  assert.equal(selection.selected, undefined);
  assert.equal(selection.id, null);
  assert.equal(selection.pending, null);
  assert.deepEqual([...selection.ids], ["blocked"]);
});

test("primary navigation cancels pending placement and preserves a multi-selection", () => {
  const plan = { keeps: [{ id: "player" }], structures: [], obstacles: [] };
  const selection = new PlacementSelection(() => plan);
  selection.ids.add("player");
  selection.pending = "player";
  selection.select(null);
  assert.equal(selection.pending, null);
  assert.deepEqual([...selection.ids], ["player"]);
  selection.clear();
  assert.equal(selection.ids.size, 0);
  assert.deepEqual(plan.keeps, [{ id: "player" }]);
});
