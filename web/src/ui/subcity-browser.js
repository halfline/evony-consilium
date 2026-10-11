import { view, option } from "./dom.js";
import { SUBCITY_COLORS } from "../domain/subcities.js";
import {
  subcityFilterCategory,
  subcityTypeOptions,
} from "./subcity-filters.js";

export function renderSubcityArt(root, type) {
  const color = SUBCITY_COLORS.find((item) => item.id === type?.color);
  root.style.setProperty("--subcity-color", color?.color || "var(--gold)");
  if (type?.src) {
    const image = document.createElement("img");
    image.src = type.src;
    image.alt = "";
    image.loading = "lazy";
    root.replaceChildren(image);
  } else {
    const placeholder = document.createElement("span");
    placeholder.className = "subcity-art-placeholder";
    placeholder.textContent = (type?.name || "?").slice(0, 2).toUpperCase();
    placeholder.title = "Artwork unavailable";
    root.replaceChildren(placeholder);
  }
}
export function createSubcityBrowser({ root, types }) {
  const $ = view(root);
  let choose, selectedId;
  function render() {
    const query = $("subcity-search").value.trim().toLowerCase();
    const category = $("subcity-filter-type").value;
    const color = $("subcity-filter-color").value;
    const choices = types().filter(
      (type) =>
        type.color !== "white" &&
        (!category || subcityFilterCategory(type, type.culture) === category) &&
        (!color || type.color === color) &&
        `${type.name} ${type.culture}`.toLowerCase().includes(query),
    );
    $("subcity-browser-grid").replaceChildren(
      ...choices.map((type) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className =
          "castle-card subcity-choice" +
          (type.id === selectedId ? " selected" : "");
        button.dataset.subcityType = type.id;
        button.setAttribute("aria-pressed", String(type.id === selectedId));
        const portrait = document.createElement("span");
        portrait.className = "map-portrait subcity-portrait";
        renderSubcityArt(portrait, type);
        const name = document.createElement("strong");
        name.textContent = type.name;
        const color = document.createElement("small");
        color.textContent = SUBCITY_COLORS.find(
          (item) => item.id === type.color,
        ).name;
        button.append(portrait, name, color);
        button.onclick = () => {
          root.close();
          choose(type);
        };
        return button;
      }),
    );
    $("subcity-browser-empty").hidden = choices.length !== 0;
  }
  $("subcity-search").oninput = render;
  function updateType() {
    const red = ["historic", "famous"].includes($("subcity-filter-type").value);
    const color = $("subcity-filter-color");
    if (red) color.value = "red";
    else if (color.disabled) color.value = "";
    color.disabled = red;
    render();
  }
  $("subcity-filter-type").onchange = updateType;
  $("subcity-filter-color").onchange = render;
  return {
    open(id, callback) {
      selectedId = id;
      choose = callback;
      $("subcity-search").value = "";
      $("subcity-filter-type").replaceChildren(...subcityTypeOptions());
      $("subcity-filter-color").replaceChildren(
        option("", "All colors"),
        ...SUBCITY_COLORS.filter((color) => color.id !== "white").map((color) =>
          option(color.id, color.name),
        ),
      );
      updateType();
      root.showModal();
      $("subcity-search").focus();
    },
    close: () => root.close(),
  };
}
