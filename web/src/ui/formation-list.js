import { view } from "./dom.js";

export function createFormationList({ root, getPlan, getSelection, group, select, canEdit, place, center, setRally }) {
  const $ = view(root);
  function render() {
    $("formation-players").replaceChildren(
      ...getPlan().keeps.map((keep) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "players-row" +
          (getSelection() === keep.id || group.has(keep.id) ? " selected" : "");
        button.textContent = `${keep.name} · ${keep.x === null ? "Unplaced · click to position" : `X ${keep.x} · Y ${keep.y}`}`;
        button.disabled = keep.x === null && !canEdit();
        button.onclick = () => {
          select(keep.id);
          if (keep.x === null) place(keep);
          else center(keep);
        };
        const row = document.createElement("div");
        row.className = "formation-player-row";
        const star = document.createElement("button");
        star.type = "button";
        star.className = "rally-star" + (keep.id === getPlan().rallyId ? " active" : "");
        star.textContent = keep.id === getPlan().rallyId ? "★" : "☆";
        star.title = keep.id === getPlan().rallyId
          ? "Rally setter" : `Make ${keep.name} rally setter`;
        star.setAttribute("aria-label", star.title);
        star.disabled = keep.id === getPlan().rallyId || !canEdit();
        star.onclick = () => setRally(keep.id);
        row.append(button, star);
        return row;
      }),
    );
    $("structure-list").replaceChildren(
      ...[...getPlan().structures, ...getPlan().obstacles].map((entity) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "players-row" +
          (getSelection() === entity.id || group.has(entity.id) ? " selected" : "");
        button.textContent = `${entity.name} · ${entity.x === null
          ? "Unplaced · click to position" : `X ${entity.x} · Y ${entity.y}`}`;
        button.disabled = entity.x === null && !canEdit();
        button.onclick = () => {
          select(entity.id);
          if (entity.x === null) place(entity);
          else center(entity);
        };
        return button;
      }),
    );
  }
  return { render };
}
