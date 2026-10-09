import { renderPortrait } from "./portrait.js";
import { view } from "./dom.js";
import { bindTileActions } from "./tile-actions.js";

export function createPlayersScreen({
  root,
  search,
  getPlan,
  getAvatars,
  getSelection,
  open,
  remove,
  add,
  fileState = () => null,
}) {
  const $ = view(root);
  const grid = $("players");
  const addButton = $("add-player");
  addButton.onclick = add;
  search.oninput = render;
  bindTileActions(grid, {
    tileSelector: ".player-tile",
    triggerSelector: ".player-card",
    className: "player-actions-open",
  });
  function tile(player) {
    const tile = document.createElement("div");
    tile.className = "player-tile";
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "players-row player-card" +
      (getSelection() === player.id ? " selected" : "");
    button.dataset.entity = player.id;
    const portrait = document.createElement("span");
    portrait.className = "player-portrait";
    const catalog = getAvatars();
    const avatar =
      catalog.avatars.find((item) => item.id === player.avatarId) ||
      catalog.avatars.find((item) => item.id === catalog.defaultId);
    if (avatar) renderPortrait(portrait, avatar.previewSrc || avatar.src);
    const level = document.createElement("span");
    level.className = "level";
    level.textContent = "K" + player.level;
    portrait.append(level);
    const identity = document.createElement("span");
    identity.className = "player-identity";
    if (player.allianceTag) {
      const tag = document.createElement("span");
      tag.className = "player-tag";
      tag.textContent = "[" + player.allianceTag + "]";
      identity.append(tag);
    }
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = player.name;
    identity.append(name);
    if (player.accountId) {
      const account = document.createElement("span");
      account.className = "detail";
      account.textContent = "ID " + player.accountId;
      identity.append(account);
    }
    const state = fileState(player);
    if (state && player.playerSource) {
      const sync = document.createElement("span");
      sync.className = "detail";
      sync.textContent = state.label;
      identity.append(sync);
    }
    button.append(portrait, identity);
    button.onclick = () => open(player.id);
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "player-remove";
    removeButton.textContent = "×";
    removeButton.title = "Remove " + player.name;
    removeButton.setAttribute("aria-label", removeButton.title);
    removeButton.onclick = () => remove(player.id);
    tile.append(button, removeButton);
    return tile;
  }
  function render() {
    const query = search.value.toLowerCase();
    const players = getPlan().keeps.filter((player) =>
      (player.name + " " + player.accountId).toLowerCase().includes(query),
    );
    grid.replaceChildren(...players.map(tile), addButton);
  }
  return { render };
}
