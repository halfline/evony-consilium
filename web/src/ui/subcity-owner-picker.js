import { view } from "./dom.js";
import { renderPortrait } from "./portrait.js";
import { createSearchablePicker } from "./searchable-picker.js";
import { playerPickerCard } from "./player-picker-card.js";
import { matchesPlayerSearch } from "./player-search.js";

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
    matches: matchesPlayerSearch,
    renderCard(player, query) {
      const card = playerPickerCard(player, getAvatars, { query });
      card.dataset.owner = player.id;
      return card;
    },
  });
  return {
    renderOwner,
    open: (id, callback) => picker.open(id, (player) => callback(player.id)),
    close: picker.close,
  };
}
