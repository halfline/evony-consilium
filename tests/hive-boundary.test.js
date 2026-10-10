import test from "node:test";
import assert from "node:assert/strict";
import { hiveBoundaries } from "../web/src/domain/hive-boundary.js";

const assets = new Map([
  ["normal", { kind: "alliance" }],
  ["chalons", { kind: "alliance" }],
  ["warehouse", { kind: "warehouse" }],
]);

test("hive lines surround the center of each placed alliance castle", () => {
  const plan = {
    hiveSize: 18,
    structures: [
      { skin: "normal", x: 100, y: 200, w: 2, h: 2 },
      { skin: "chalons", x: 300, y: 400, w: 4, h: 4 },
      { skin: "normal", x: null, y: null, w: 2, h: 2 },
      { skin: "warehouse", x: 500, y: 600, w: 2, h: 2 },
    ],
  };
  assert.deepEqual(hiveBoundaries(plan, assets), [
    { x: 92, y: 192, w: 18, h: 18 },
    { x: 293, y: 393, w: 18, h: 18 },
  ]);
  plan.hiveSize = 20;
  assert.deepEqual(hiveBoundaries(plan, assets)[0], {
    x: 91,
    y: 191,
    w: 20,
    h: 20,
  });
});
