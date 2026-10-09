import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyPlan } from "../web/src/domain/plan.js";
import { createLayout, captureLayout, applyLayout } from "../web/src/domain/layout.js";

test("map layouts capture placed players and restore independent positions", () => {
  const plan = createEmptyPlan();
  plan.keeps = [{ id: "one", x: 20, y: 30, w: 2, h: 2, locked: true }];
  const first = captureLayout(plan);
  const second = createLayout("server", { extent: 900 });
  assert.equal(second.extent, 900);
  assert.deepEqual(first.positions, [{ id: "one", x: 20, y: 30, w: 2, h: 2, locked: true }]);
  applyLayout(plan, second);
  assert.equal(plan.keeps[0].x, null);
  assert.equal(plan.keeps[0].locked, false);
  applyLayout(plan, first);
  assert.equal(plan.keeps[0].x, 20);
  assert.equal(plan.keeps[0].locked, true);
});
