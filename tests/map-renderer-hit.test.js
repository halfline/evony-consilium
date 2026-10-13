import assert from "node:assert/strict";
import test from "node:test";
import { MapRenderer } from "../web/src/rendering/map-renderer.js";

test("a keep's ground tiles win over a neighboring castle's oversized sprite", () => {
  const equalizer = { x: 565, y: 629, w: 3, h: 3 };
  const aslam = { x: 567, y: 632, w: 2, h: 2 };
  const renderer = {
    hits: [
      {
        id: "equalizer",
        entity: equalizer,
        left: 0,
        right: 80,
        top: 0,
        bottom: 80,
      },
      { id: "aslam", entity: aslam, left: 0, right: 80, top: 0, bottom: 80 },
    ],
    world: () => ({ x: 566, y: 630 }),
    screen: (x, y) => ({ x, y }),
  };
  assert.equal(MapRenderer.prototype.hit.call(renderer, 40, 40), "equalizer");
});

test("opening a placement inspector does not change the map zoom", () => {
  let size = { width: 900, height: 700 };
  const renderer = {
    canvas: {
      getBoundingClientRect: () => size,
      width: 0,
      height: 0,
    },
    camera: { x: 120, y: 80, zoom: 1 },
    draw() {},
  };
  const oldRatio = globalThis.devicePixelRatio;
  globalThis.devicePixelRatio = 1;
  try {
    MapRenderer.prototype.resize.call(renderer);
    size = { width: 900, height: 420 };
    MapRenderer.prototype.resize.call(renderer);
    assert.deepEqual(renderer.camera, { x: 120, y: 80, zoom: 1 });
    assert.equal(renderer.canvas.height, 420);
  } finally {
    globalThis.devicePixelRatio = oldRatio;
  }
});
