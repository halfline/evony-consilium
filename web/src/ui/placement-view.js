import { view } from "./dom.js";

const guide =
  "Drag to move · Shift-drag / Ctrl-click to select · Delete to remove · Scroll to zoom";

export function createPlacementView({ root, selection, renderer, refresh }) {
  const $ = view(root);
  function reset() {
    selection.pending = null;
    renderer.preview = null;
    renderer.previews = null;
    $("map-guide").textContent = guide;
    renderer.draw();
  }
  function select(id) {
    reset();
    selection.select(id);
    refresh();
    renderer.draw();
  }
  function place(entity, message) {
    selection.pending = entity.id;
    $("map-guide").textContent =
      message || "Click a free map tile to place " + entity.name;
  }
  return { reset, select, place };
}
