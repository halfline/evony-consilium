import test from "node:test";
import assert from "node:assert/strict";
import { paintEntityLabels } from "../web/src/rendering/entity-painter.js";

function label(id, name, { selected = false, x = 100, zoom = 1 } = {}) {
  return {
    e: { id, name },
    p: { labels: true, rallyId: null },
    z: zoom,
    major: false,
    spriteZoom: zoom,
    center: { x, y: 100 },
    top: 50,
    rally: false,
    selected,
  };
}

function paint(labels) {
  const drawn = [];
  const view = {
    ctx: {
      measureText: (value) => ({ width: value.length * 6 }),
      fillRect() {},
      fillText: (value) => drawn.push(value),
    },
  };
  paintEntityLabels(view, labels);
  return drawn;
}

test("selected map names win over overlapping ordinary names", () => {
  assert.deepEqual(
    paint([label("a", "Ordinary"), label("b", "Selected", { selected: true })]),
    ["Selected"],
  );
  assert.deepEqual(
    paint([label("a", "First"), label("b", "Second", { x: 250 })]),
    ["First", "Second"],
  );
});

test("low zoom keeps selected names while hiding ordinary names", () => {
  assert.deepEqual(
    paint([
      label("a", "Ordinary", { zoom: 0.2 }),
      label("b", "Selected", { selected: true, zoom: 0.2 }),
    ]),
    ["Selected"],
  );
});
