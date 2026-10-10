import { newStructure, newObstacle, addEntity } from "../domain/entities.js";
import { view } from "./dom.js";
import { autoFormation } from "../domain/formation.js";

export function createFormationControls({
  root,
  toolbar,
  canEdit = () => true,
  assets,
  getPlan,
  terrainFor,
  commit,
  browse,
  place,
  fit,
  resetPlacement,
  status,
}) {
  const $ = view(root, toolbar);
  const size = $("hive-size"),
    customSize = $("hive-size-custom");
  function commitHiveSize(value) {
    if (!canEdit()) return;
    const next = structuredClone(getPlan());
    next.hiveSize = value;
    commit(next);
  }
  size.onchange = () => {
    if (size.value === "custom") {
      customSize.hidden = false;
      customSize.focus();
    } else commitHiveSize(Number(size.value));
  };
  customSize.oninput = () => customSize.setCustomValidity("");
  customSize.onchange = () => {
    const value = Number(customSize.value);
    if (!Number.isInteger(value) || value < 2 || value > 60 || value % 2) {
      customSize.setCustomValidity("Enter an even number from 2 to 60.");
      customSize.reportValidity();
      return;
    }
    commitHiveSize(value);
  };
  $("auto-place").onclick = () => {
    if (!canEdit()) return;
    try {
      commit(autoFormation(getPlan(), terrainFor(getPlan().map)));
      fit();
      resetPlacement();
      status(
        "Formation arranged. Higher keep levels are nearest the rally setter.",
      );
    } catch (e) {
      status(e.message, true);
    }
  };
  const previews = {
    alliance: "map-world_castle_guild",
    warehouse: "map-world_warehouse_guild",
    resource: "map-world_food_guild",
    objective: "map-battlefield-knighthall",
  };
  for (const button of root.querySelectorAll("[data-building]")) {
    const asset = assets.get(previews[button.dataset.building]);
    const portrait = document.createElement("span");
    portrait.className = "building-portrait";
    const image = document.createElement("img");
    image.src = asset.previewSrc || asset.src;
    image.alt = "";
    portrait.append(image);
    const label = document.createElement("span");
    label.textContent = button.textContent.trim();
    button.replaceChildren(portrait, label);
  }
  root.querySelectorAll("[data-building]").forEach(
    (b) =>
      (b.onclick = () => {
        const kind = b.dataset.building;
        browse(kind, (a) => {
          const e = newStructure(a);
          commit(addEntity(getPlan(), "structures", e));
          place(e);
        });
      }),
  );
  $("add-obstacle").onclick = () => {
    const e = newObstacle();
    commit(addEntity(getPlan(), "obstacles", e));
    place(e, "Click a tile to block it.");
  };
  function render() {
    $("auto-place").disabled = !canEdit() || !getPlan().keeps.length;
    const value = getPlan().hiveSize ?? 18;
    size.value = [18, 20].includes(value) ? String(value) : "custom";
    customSize.hidden = size.value !== "custom";
    customSize.value = String(value);
    size.disabled = customSize.disabled = !canEdit();
  }
  return { render };
}
