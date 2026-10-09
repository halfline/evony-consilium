import test from "node:test";
import assert from "node:assert/strict";
import { catalog } from "./fixtures/catalog.js";
import { createDemoPlan } from "../web/src/domain/plan.js";
import { canPlace } from "../web/src/domain/placement.js";
import { overlap } from "../web/src/domain/geometry.js";
const keep = (id, level, x = null, y = null) => ({
  id,
  name: id,
  accountId: "",
  level,
  skin: "map-evony1-castle_lv7",
  x,
  y,
  w: 2,
  h: 2,
  locked: false,
});
function planWith(keeps) {
  const p = createDemoPlan(catalog);
  p.keeps = keeps;
  p.structures = [];
  p.obstacles = [];
  p.rallyId = keeps[0]?.id || null;
  return p;
}
test("touching tile edges are legal, overlapping footprints are rejected", () => {
  assert.equal(
    overlap({ x: 0, y: 0, w: 2, h: 2 }, { x: 2, y: 0, w: 2, h: 2 }),
    false,
  );
  const p = planWith([keep("a", 30, 0, 0)]);
  const k = keep("b", 30);
  assert.ok(canPlace(k, 2, 0, p));
  assert.ok(!canPlace(k, 1, 0, p));
  assert.ok(!canPlace(k, -1, 0, p));
  assert.ok(!canPlace(k, 1199, 0, p));
});
