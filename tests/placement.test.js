import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyPlan } from "../web/src/domain/plan.js";
import { canPlace } from "../web/src/domain/placement.js";
import { overlap } from "../web/src/domain/geometry.js";

test("touching tile edges are legal, overlapping footprints are rejected", () => {
  assert.equal(
    overlap({ x: 0, y: 0, w: 2, h: 2 }, { x: 2, y: 0, w: 2, h: 2 }),
    false,
  );
  const plan = createEmptyPlan();
  plan.keeps.push({ id: "placed", x: 0, y: 0, w: 2, h: 2 });
  const candidate = { id: "new", w: 2, h: 2 };
  assert.equal(canPlace(candidate, 2, 0, plan), true);
  assert.equal(canPlace(candidate, 1, 0, plan), false);
  assert.equal(canPlace(candidate, -1, 0, plan), false);
  assert.equal(canPlace(candidate, 1199, 0, plan), false);
});

test("terrain blocks an otherwise vacant footprint", () => {
  const plan = createEmptyPlan();
  const terrain = {
    width: 1201, extent: 1200,
    blocked: new Uint8Array(1201 * 1201),
    landmarks: [],
  };
  terrain.blocked[600 * terrain.width + 600] = 1;
  const candidate = { id: "keep", w: 2, h: 2 };
  assert.equal(canPlace(candidate, 600, 600, plan, [], terrain), false);
  assert.equal(canPlace(candidate, 602, 600, plan, [], terrain), true);
});
