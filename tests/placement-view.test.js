import test from "node:test";
import assert from "node:assert/strict";
import { createPlacementView } from "../web/src/ui/placement-view.js";

test("placement view keeps selection, preview, and guide in step", () => {
  const guide = { id: "map-guide", textContent: "" };
  const root = {
    id: "formation-screen",
    querySelectorAll: () => [guide],
    contains: (node) => node === guide,
  };
  const selection = {
    pending: "old",
    id: null,
    select(id) { this.id = id; },
  };
  const renderer = {
    preview: {},
    previews: [{}],
    draws: 0,
    draw() { this.draws++; },
  };
  let refreshes = 0;
  const placement = createPlacementView({
    root,
    selection,
    renderer,
    refresh: () => refreshes++,
  });
  placement.select("keep");
  assert.equal(selection.id, "keep");
  assert.equal(selection.pending, null);
  assert.equal(refreshes, 1);
  placement.place({ id: "next", name: "Next" });
  assert.equal(selection.pending, "next");
  assert.match(guide.textContent, /Next/);
  placement.reset();
  assert.equal(renderer.preview, null);
  assert.equal(renderer.previews, null);
  assert.match(guide.textContent, /Drag to move/);
});
