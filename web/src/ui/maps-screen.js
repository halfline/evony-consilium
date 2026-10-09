import { MAP_ICONS } from "../domain/maps.js";
import { view } from "./dom.js";
export function createMapsScreen({ root, getPlan, open, status }) {
  const $ = view(root);
  $("add-map").hidden = true;
  function openMap(id) {
    try {
      if (!getPlan().maps?.some((map) => map.id === id))
        throw new Error("Choose a map to open.");
      open(id);
    } catch (error) {
      status(error.message, true);
    }
  }
  function render() {
    const plan = getPlan();
    $("maps-list").replaceChildren(
      ...(plan.maps || []).map((map) => {
        const row = document.createElement("div");
        row.className = "map-list-row";
        const button = document.createElement("button");
        button.className =
          "map-row" + (map.id === plan.activeMapId ? " selected" : "");
        const name = document.createElement("strong");
        name.textContent = map.name;
        const arrow = document.createElement("span");
        arrow.textContent = "→";
        arrow.setAttribute("aria-hidden", "true");
        const portrait = document.createElement("span");
        portrait.className = "map-portrait";
        const icon = MAP_ICONS[map.type];
        if (icon) {
          const image = document.createElement("img");
          image.src = icon;
          image.alt = "";
          portrait.append(image);
        } else portrait.classList.add("blank-map-portrait");
        const caption = document.createElement("span");
        caption.className = "map-caption";
        caption.append(name, arrow);
        button.append(portrait, caption);
        button.onclick = () => openMap(map.id);
        row.append(button);
        return row;
      }),
    );
  }
  return { render, enter() { render(); } };
}
