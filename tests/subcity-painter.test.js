import test from "node:test";
import assert from "node:assert/strict";
import { drawSubcities } from "../web/src/rendering/subcity-painter.js";
test("server subcity markers include owners and exclude unlocated cities and battlefields", () => {
  const labels = [];
  const ctx = new Proxy(
    {
      measureText: (text) => ({ width: text.length * 5 }),
      fillText: (text) => labels.push(text),
    },
    { get: (target, key) => target[key] || (() => {}) },
  );
  const view = {
    ctx,
    camera: { zoom: 1 },
    width: 1000,
    height: 1000,
    screen: (x, y) => ({ x, y }),
    image: () => null,
  };
  const plan = {
    map: "server",
    labels: true,
    keeps: [{ id: "owner", name: "Alice" }],
    subcities: [
      {
        id: "city",
        ownerId: "owner",
        name: "Harbor",
        culture: "Europe",
        color: "gold",
        x: 100,
        y: 200,
      },
      { id: "unplaced", x: null, y: null },
    ],
  };
  drawSubcities(view, plan, []);
  assert.deepEqual(
    view.subcityHits.map((hit) => hit.id),
    ["city"],
  );
  assert.deepEqual(labels, ["Harbor · Alice"]);
  drawSubcities(view, { ...plan, map: "boc" }, []);
  assert.deepEqual(view.subcityHits, []);
});
