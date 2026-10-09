import test from "node:test";
import assert from "node:assert/strict";
import { project, unproject } from "../web/src/domain/geometry.js";
test("affine projection round trips skewed and negative coordinate axes", () => {
  for (const grid of [
    { ax: 48, ay: 24, bx: -48, by: 24 },
    { ax: 71, ay: 13, bx: -49, by: 37 },
    { ax: -40, ay: 21, bx: 60, by: 28 },
  ])
    for (const [x, y] of [
      [0, 0],
      [600, 721],
      [1200, 0],
      [-4.5, 3.2],
    ]) {
      const s = project(x, y, grid),
        p = unproject(s.x, s.y, grid);
      assert.ok(Math.abs(p.x - x) < 1e-8);
      assert.ok(Math.abs(p.y - y) < 1e-8);
    }
});
test("parallel projection axes are rejected", () =>
  assert.throws(() => unproject(0, 0, { ax: 1, ay: 1, bx: 2, by: 2 })));
