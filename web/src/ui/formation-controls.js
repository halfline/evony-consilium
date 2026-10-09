import { newObstacle, addEntity } from "../domain/entities.js";
import { view } from "./dom.js";

export function createFormationControls({ root, getPlan, commit, place, canEdit = () => true }) {
  const $ = view(root);
  $("add-obstacle").onclick = () => {
    if (!canEdit()) return;
    const obstacle = newObstacle();
    commit(addEntity(getPlan(), "obstacles", obstacle));
    place(obstacle, "Click a tile to block it.");
  };
  function render() {
    $("add-obstacle").disabled = !canEdit();
  }
  return { render };
}
