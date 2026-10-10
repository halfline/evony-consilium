import { renderSubcityArt } from "./subcity-browser.js";
import { SUBCITY_COLORS } from "../domain/subcities.js";
import { labelWithIcon } from "./icons.js";

// Shared presentation for the team registry, player ownership, and assignment picker.
export function createSubcityCard({
  city,
  types,
  owner,
  open,
  remove,
  removeLabel,
}) {
  const tile = document.createElement("div");
  tile.className = "subcity-tile player-tile";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "subcity-card map-row";
  button.dataset.subcity = city.id;
  const color = SUBCITY_COLORS.find((item) => item.id === city.color);
  const asset =
    city.color === "red"
      ? types.find((type) => type.id === city.cityType)
      : types.find(
          (type) => type.culture === city.culture && type.color === city.color,
        );
  const cityName =
    city.color === "red" ? asset?.name || city.cityType : city.culture;
  const customName = city.color === "red" ? "" : city.name;
  const portrait = document.createElement("span");
  portrait.className = "map-portrait subcity-portrait";
  renderSubcityArt(portrait, asset);
  const caption = document.createElement("strong");
  caption.textContent = customName || cityName;
  caption.title = caption.textContent;
  button.title = `${caption.textContent} · ${city.culture} · ${color.name}`;
  const details = document.createElement("span");
  details.className = "subcity-details";
  details.textContent = `${customName ? cityName + " · " : ""}${color.name}`;
  const coordinates = document.createElement("span");
  coordinates.className = "subcity-coordinates";
  coordinates.textContent =
    city.x === null ? "Coordinates not set" : `X: ${city.x} · Y: ${city.y}`;
  button.append(portrait, caption, details, coordinates);
  if (owner !== undefined) {
    const name = document.createElement("span");
    name.className = "subcity-owner";
    name.textContent = owner
      ? `${owner.allianceTag ? `[${owner.allianceTag}] ` : ""}${owner.name}`
      : "Unowned";
    button.append(name);
  }
  button.onclick = open;
  tile.append(button);
  if (remove) {
    const action = document.createElement("button");
    action.type = "button";
    action.className = "player-remove subcity-remove";
    labelWithIcon(action, "close");
    action.title = removeLabel || `Remove ${customName || cityName} subcity`;
    action.setAttribute("aria-label", action.title);
    action.onclick = remove;
    tile.append(action);
  }
  return tile;
}
