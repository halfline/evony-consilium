import { newObstacle, newStructure, addEntity } from "../domain/entities.js";
import { view } from "./dom.js";
import { autoFormation } from "../domain/formation.js";

export function createFormationControls({ root, getPlan, commit, place, browse,
  fit, resetPlacement, status, terrainFor, canEdit = () => true }) {
  const $ = view(root);
  $("auto-place").onclick = () => {
    if (!canEdit()) return;
    try {
      commit(autoFormation(getPlan(), terrainFor(getPlan().map)));
      fit();
      resetPlacement();
      status("Formation arranged. Higher keep levels are nearest the rally setter.");
    } catch (error) { status(error.message, true); }
  };
  for (const button of root.querySelectorAll("[data-building]"))
    button.onclick = () => {
      if (!canEdit()) return;
      browse(button.dataset.building, (asset) => {
        const structure = newStructure(asset);
        commit(addEntity(getPlan(), "structures", structure));
        place(structure, `Click a free tile to place ${structure.name}.`);
      });
    };
  $("add-obstacle").onclick = () => {
    if (!canEdit()) return;
    const obstacle = newObstacle();
    commit(addEntity(getPlan(), "obstacles", obstacle));
    place(obstacle, "Click a tile to block it.");
  };
  function render() {
    $("add-obstacle").disabled = !canEdit();
    $("auto-place").disabled = !canEdit() || !getPlan().keeps.length;
    for (const button of root.querySelectorAll("[data-building]"))
      button.disabled = !canEdit();
  }
  return { render };
}
