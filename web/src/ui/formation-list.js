import { view } from "./dom.js";

export function createFormationList({ root, getPlan, canEdit, place, center }) {
  const $ = view(root);
  function render() {
    $("formation-players").replaceChildren(
      ...getPlan().keeps.map((keep) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "players-row";
        button.textContent = `${keep.name} · ${keep.x === null ? "Unplaced · click to position" : `X ${keep.x} · Y ${keep.y}`}`;
        button.disabled = keep.x === null && !canEdit();
        button.onclick = () => keep.x === null ? place(keep) : center(keep);
        return button;
      }),
    );
  }
  return { render };
}
