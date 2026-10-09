import { view } from "./dom.js";

export function createPlacementInspector({ root, selected, close }) {
  const $ = view(root);
  $("close-inspector").onclick = close;
  function render() {
    const entity = selected();
    root.hidden = !entity;
    if (!entity) return;
    $("entity-title").textContent = entity.name;
    $("entity-kind").textContent = "level" in entity
      ? "SELECTED KEEP" : "SELECTED TILE";
    $("entity-location").textContent = entity.x === null
      ? "Unplaced" : `X ${entity.x} · Y ${entity.y}`;
  }
  return { render };
}
