import { bindTileActions } from "./tile-actions.js";
import { view } from "./dom.js";

// Compact placement rows belong to the formation workflow, separate from player profile tiles.
export function createFormationList({
  root,
  canEdit = () => true,
  setRally,
  getPlan,
  assets,
  getSelection,
  select,
  place,
  center,
}) {
  const $ = view(root);
  bindTileActions($("formation-players"), {
    tileSelector: ".formation-player-row",
    triggerSelector: ".players-row",
    className: "rally-actions-open",
    enabled: canEdit,
  });
  function row(entity) {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "players-row" + (getSelection() === entity.id ? " selected" : "");
    button.dataset.entity = entity.id;
    const asset = assets.get(entity.skin);
    if (asset) {
      const image = document.createElement("img");
      image.src = asset.previewSrc || asset.src;
      image.alt = "";
      button.append(image);
    }
    const text = document.createElement("span");
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = entity.name + (entity.locked ? " · Locked" : "");
    const detail = document.createElement("span");
    detail.className = "detail";
    detail.textContent =
      entity.x === null
        ? "Unplaced · click to position"
        : `X ${entity.x} · Y ${entity.y}`;
    if (!("level" in entity) && asset?.name)
      detail.textContent += " · " + asset.name;
    text.append(name, detail);
    button.append(text);
    if ("level" in entity) {
      const level = document.createElement("span");
      level.className = "level";
      level.textContent = "K" + entity.level;
      button.append(level);
    }
    button.onclick = () => {
      select(entity.id);
      if (entity.x === null) place(entity);
      else center(entity);
    };
    if (!("level" in entity)) return button;
    const tile = document.createElement("div");
    tile.className = "formation-player-row";
    const star = document.createElement("button");
    star.type = "button";
    const rally = entity.id === getPlan().rallyId;
    star.className = "rally-star" + (rally ? " active" : "");
    star.textContent = rally ? "★" : "☆";
    star.title = rally ? "Rally setter" : `Make ${entity.name} rally setter`;
    star.setAttribute("aria-label", star.title);
    star.disabled = rally || !canEdit();
    star.onclick = () => {
      if (canEdit()) setRally(entity.id);
    };
    tile.append(button, star);
    return tile;
  }
  function render() {
    const plan = getPlan();
    $("formation-players").replaceChildren(
      ...plan.keeps.filter((player) => player.ownerId == null).map(row),
    );
    $("structure-list").replaceChildren(
      ...[...plan.structures, ...plan.obstacles].map(row),
    );
  }
  return { render };
}
