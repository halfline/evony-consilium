import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyPlan } from "../web/src/domain/plan.js";
import { autoFormation } from "../web/src/domain/formation.js";
import { canPlace } from "../web/src/domain/placement.js";

const keep = (id, level, x = null, y = null) => ({
  id, name: id, level, skin: "map-evony3-castle_lv1",
  x, y, w: 2, h: 2, locked: false,
});

test("arrange keeps strongest recruits nearest the rally setter", () => {
  const plan = createEmptyPlan();
  plan.keeps = [keep("leader", 30), keep("low", 20), keep("high", 45)];
  plan.rallyId = "leader";
  const next = autoFormation(plan);
  assert.deepEqual([next.keeps[0].x, next.keeps[0].y], [600, 600]);
  const distance = (k) => (k.x - 600) ** 2 + (k.y - 600) ** 2;
  assert.ok(distance(next.keeps[2]) <= distance(next.keeps[1]));
  for (const player of next.keeps)
    assert.equal(canPlace(player, player.x, player.y, next), true);
  assert.equal(plan.keeps[0].x, null);
});

test("arrange preserves locked positions and avoids blocked tiles", () => {
  const plan = createEmptyPlan();
  plan.keeps = [keep("leader", 45, 600, 600),
    { ...keep("locked", 40, 602, 600), locked: true }, keep("free", 30)];
  plan.rallyId = "leader";
  plan.obstacles.push({ id: "blocked", name: "Blocked tile", x: 598, y: 598,
    w: 2, h: 2, locked: true });
  const next = autoFormation(plan);
  assert.deepEqual([next.keeps[1].x, next.keeps[1].y], [602, 600]);
  assert.equal(canPlace(next.keeps[2], next.keeps[2].x, next.keeps[2].y, next), true);
});

test("arrange rejects a missing rally setter without changing the plan", () => {
  const plan = createEmptyPlan();
  plan.keeps = [keep("a", 30)];
  const before = structuredClone(plan);
  assert.throws(() => autoFormation(plan), /rally setter/);
  assert.deepEqual(plan, before);
});
