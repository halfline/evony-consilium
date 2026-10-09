import { view } from "./dom.js";
import { canPlace } from "../domain/placement.js";
import { validatePlan } from "../domain/validation.js";

export function createPlacementInspector({
  root, selected, close, getPlan, terrainFor, catalog, commit, status,
  canEdit = () => true,
}) {
  const $ = view(root);
  $("close-inspector").onclick = close;
  $("entity-form").onsubmit = (event) => {
    event.preventDefault();
    const entity = selected();
    if (!entity || !canEdit()) return;
    try {
      const next = structuredClone(getPlan());
      const target = [...next.keeps, ...next.structures, ...next.obstacles]
        .find(({ id }) => id === entity.id);
      target.locked = $("entity-locked").checked;
      const x = $("entity-x").value, y = $("entity-y").value;
      if ((x === "") !== (y === ""))
        throw new Error("Enter both X and Y, or leave both blank.");
      target.x = x === "" ? null : Number(x);
      target.y = y === "" ? null : Number(y);
      if (target.x !== null &&
        !canPlace(target, target.x, target.y, next, [], terrainFor(next.map)))
        throw new Error("That location overlaps another tile or is outside the map.");
      validatePlan(next, catalog);
      commit(next);
      status("Changes applied.");
    } catch (error) { status(error.message, true); }
  };
  function render() {
    const entity = selected();
    root.hidden = !entity;
    if (!entity) return;
    $("entity-title").textContent = entity.name;
    $("entity-kind").textContent = "level" in entity
      ? "SELECTED KEEP" : "SELECTED TILE";
    $("entity-location").textContent = entity.x === null
      ? "Unplaced" : `X ${entity.x} · Y ${entity.y}`;
    $("entity-x").value = entity.x ?? "";
    $("entity-y").value = entity.y ?? "";
    $("entity-locked").checked = !!entity.locked;
    for (const input of $("entity-form").querySelectorAll("input,button"))
      input.disabled = !canEdit();
  }
  return { render };
}
