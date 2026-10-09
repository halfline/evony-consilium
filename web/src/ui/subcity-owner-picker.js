import { view } from "./dom.js";
import { renderPortrait } from "./portrait.js";
import { createSearchablePicker } from "./searchable-picker.js";

export function createSubcityOwnerPicker({ root, getPlan, getAvatars }) {
  const $ = view(root);
  function renderOwner(element, player) {
    const catalog = getAvatars();
    const avatar =
      player &&
      (catalog.avatars.find((item) => item.id === player.avatarId) ||
        catalog.avatars.find((item) => item.id === catalog.defaultId));
    renderPortrait(element, avatar && (avatar.previewSrc || avatar.src));
  }
  const picker = createSearchablePicker({
    dialog: root,
    search: $("subcity-owner-search"),
    grid: $("subcity-owner-grid"),
    empty: $("subcity-owner-empty"),
    items: () => getPlan().keeps,
    matches: (player, query) =>
      `${player.name} ${player.allianceTag}`.toLowerCase().includes(query),
    renderCard(player) {
      const button = document.createElement("button");
      button.className = "castle-card subcity-owner-card";
      button.dataset.owner = player.id;
      const portrait = document.createElement("span");
      portrait.className = "avatar-choice";
      renderOwner(portrait, player);
      const name = document.createElement("strong");
      name.textContent = `${player.allianceTag ? `[${player.allianceTag}] ` : ""}${player.name}`;
      button.append(portrait, name);
      return button;
    },
  });
  return {
    renderOwner,
    open: (id, callback) => picker.open(id, (player) => callback(player.id)),
    close: picker.close,
  };
}
