import { view } from "./dom.js";
import { canPlace } from "../domain/placement.js";
import { validatePlan } from "../domain/validation.js";
import { changeAppearance } from "../domain/appearance-commands.js";
import { renderCastleButton } from "./castle-button.js";

export function createPlacementInspector({
  root, selected, close, getPlan, terrainFor, catalog, assets, browse, commit, status,
  applied = () => {},
  canEdit = () => true,
}) {
  const $ = view(root);
  $("close-inspector").onclick = close;
  function applyAsset(id, asset) {
    try {
      const next = changeAppearance(getPlan(), id, asset,
        terrainFor(getPlan().map));
      validatePlan(next, catalog);
      commit(next);
    } catch (error) { status(error.message, true); }
  }
  $("choose-building-skin").onclick = () => {
    if (!canEdit()) return;
    const entity = selected();
    const asset = assets.get(entity?.skin);
    if (asset) browse(asset.kind, (chosen) => applyAsset(entity.id, chosen));
  };
  $("game-footprint").onclick = () => {
    if (!canEdit()) return;
    const entity = selected();
    if (entity) applyAsset(entity.id, assets.get(entity.skin));
  };
  $("entity-form").onsubmit = (event) => {
    event.preventDefault();
    const entity = selected();
    if (!entity || !canEdit()) return;
    try {
      const next = structuredClone(getPlan());
      const target = [...next.keeps, ...next.structures, ...next.obstacles]
        .find(({ id }) => id === entity.id);
      if (!("level" in target)) {
        target.name = $("placement-name").value.trim();
        if (!target.name) throw new Error("Enter a name.");
      }
      if (next.obstacles.some(({ id }) => id === target.id)) {
        target.w = Number($("entity-w").value);
        target.h = Number($("entity-h").value);
      }
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
      applied();
      status("Changes applied.");
    } catch (error) { status(error.message, true); }
  };
  function render() {
    const entity = selected();
    root.hidden = !entity;
    if (!entity) return;
    $("entity-title").textContent = entity.name;
    $("placement-name").value = entity.name;
    $("placement-name").closest("label").hidden = "level" in entity;
    $("placement-name").disabled = "level" in entity || !canEdit();
    const obstacle = getPlan().obstacles.some(({ id }) => id === entity.id);
    $("entity-kind").textContent = "level" in entity
      ? "SELECTED KEEP" : obstacle
        ? "BLOCKED TILE" : "ALLIANCE / BATTLEFIELD TILE";
    $("entity-x").value = entity.x ?? "";
    $("entity-y").value = entity.y ?? "";
    $("entity-locked").checked = !!entity.locked;
    const structureAsset = assets.get(entity.skin);
    $("game-footprint").hidden = !structureAsset?.footprint ||
      (entity.w === structureAsset.footprint && entity.h === structureAsset.footprint);
    $("game-footprint").textContent = structureAsset?.footprint
      ? `Use game size: ${structureAsset.footprint} × ${structureAsset.footprint}`
      : "Use game size";
    $("choose-building-skin").hidden = obstacle || "level" in entity || !structureAsset;
    $("choose-building-skin").disabled = !canEdit();
    if (structureAsset) renderCastleButton($("choose-building-skin"), structureAsset);
    for (const key of ["w", "h"]) {
      const input = $("entity-" + key);
      input.value = entity[key];
      input.closest("label").hidden = !obstacle;
      input.disabled = !obstacle || !canEdit();
    }
    for (const input of $("entity-form").querySelectorAll("input,button"))
      if (!input.matches("#entity-w, #entity-h, #placement-name"))
        input.disabled = !canEdit();
  }
  return { render };
}
