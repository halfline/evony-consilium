import test from "node:test";
import assert from "node:assert/strict";
import { createMapPlan, selectMapPlan, syncMapLayouts } from "../web/src/domain/map-plans.js";
import { createEmptyPlan } from "../web/src/domain/plan.js";
import {
  previewPlacementMove,
  movePlacements,
  removePlacements,
} from "../web/src/domain/placement-commands.js";

function fixture() {
  const plan = createEmptyPlan();
  plan.map = "blank";
  plan.keeps = [
    {
      id: "a",
      name: "Player A",
      x: 10,
      y: 10,
      w: 2,
      h: 2,
      locked: false,
      avatarId: "portrait",
      buffs: { mountedAttack: 1234 },
    },
    { id: "b", name: "Player B", x: 12, y: 10, w: 2, h: 2, locked: false },
  ];
  plan.structures = [
    { id: "building", x: 20, y: 20, w: 3, h: 3, locked: false },
  ];
  plan.obstacles = [{ id: "locked", x: 30, y: 30, w: 2, h: 2, locked: true }];
  return plan;
}

test("a group can move into its own former positions in one atomic edit", () => {
  const plan = fixture();
  const preview = previewPlacementMove(plan, plan.keeps, 2, 0);
  assert.equal(preview.valid, true);
  const next = movePlacements(plan, preview.positions);
  assert.deepEqual(
    next.keeps.map((player) => player.x),
    [12, 14],
  );
  assert.deepEqual(
    plan.keeps.map((player) => player.x),
    [10, 12],
  );
  assert.deepEqual(next.keeps[0].buffs, { mountedAttack: 1234 });
  assert.equal(next.keeps[0].avatarId, "portrait");
});

test("removing placements preserves profiles and locked objects but removes buildings", () => {
  const plan = fixture();
  const next = removePlacements(plan, new Set(["a", "building", "locked", "missing"]));
  assert.equal(next.keeps.length, 2);
  assert.equal(next.keeps[0].x, null);
  assert.equal(next.keeps[0].y, null);
  assert.equal(next.keeps[0].name, "Player A");
  assert.deepEqual(next.keeps[0].buffs, { mountedAttack: 1234 });
  assert.equal(next.structures.length, 0);
  assert.equal(next.obstacles.length, 1);
  assert.equal(plan.keeps[0].x, 10);
  assert.equal(plan.structures.length, 1);
});

test("unplacing a player on one map leaves other map positions intact", () => {
  let plan = createMapPlan(fixture(), "blank", "First map");
  const first = plan.activeMapId;
  plan.keeps[0].x = plan.keeps[0].y = 10;
  syncMapLayouts(plan);
  plan = createMapPlan(plan, "blank", "Second map");
  const second = plan.activeMapId;
  plan.keeps[0].x = plan.keeps[0].y = 40;
  syncMapLayouts(plan);
  plan = syncMapLayouts(removePlacements(plan, new Set(["a"])));
  assert.equal(plan.keeps[0].x, null);
  plan = selectMapPlan(plan, first);
  assert.equal(plan.keeps[0].x, 10);
  assert.deepEqual(plan.keeps[0].buffs, { mountedAttack: 1234 });
  plan = selectMapPlan(plan, second);
  assert.equal(plan.keeps[0].x, null);
});

test("a blocked group move rejects every member and preserves the original document", () => {
  const plan = fixture();
  const before = structuredClone(plan);
  const preview = previewPlacementMove(plan, plan.keeps, 10, 10);
  assert.equal(preview.valid, false);
  assert.throws(() => movePlacements(plan, preview.positions), /overlaps/);
  assert.deepEqual(plan, before);
});

test("moves reject locked, missing, unplaced, fractional, and out-of-map positions", () => {
  for (const position of [
    { id: "locked", x: 40, y: 40 },
    { id: "missing", x: 40, y: 40 },
    { id: "a", x: -1, y: 10 },
    { id: "a", x: 10.5, y: 10 },
    { id: "a", x: 1200, y: 10 },
  ])
    assert.throws(() => movePlacements(fixture(), [position]));
  const plan = fixture();
  plan.keeps[0].x = plan.keeps[0].y = null;
  assert.throws(
    () => movePlacements(plan, [{ id: "a", x: 5, y: 5 }]),
    /cannot be moved/,
  );
});
