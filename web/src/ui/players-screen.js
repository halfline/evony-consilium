import { renderPortrait, initialsFor } from "./portrait.js";
import { view } from "./dom.js";
import { bindTileActions } from "./tile-actions.js";
import { paintStatusBadge } from "./status-badge.js";
import { labelWithIcon } from "./icons.js";

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
  alts = false,
}) {
  const $ = view(root);
  const grid = $(alts ? "alts" : "players");
  const addButton = $(alts ? "add-alt" : "add-player");
  const actionRow = addButton.parentElement;
  addButton.onclick = add;
  search.oninput = render;
  bindTileActions(grid, {
    tileSelector: ".player-tile",
    triggerSelector: ".player-card",
    className: "player-actions-open",
  });
  function tile(player, query) {
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
    const initials = document.createElement("span");
    initials.className = "portrait-initials";
    initials.className = "portrait-initials";
    initials.textContent = initialsFor(player.name);
    initials.setAttribute("aria-hidden", "true");
    portrait.append(initials);
    if (query && player.accountId?.toLowerCase().includes(query)) {
      const account = document.createElement("span");
      account.className = "detail";
      account.textContent = "ID " + player.accountId;
      identity.append(account);
    }
    if (player.ownerId != null) {
      const owner = document.createElement("span");
      owner.className = "detail";
      owner.textContent =
        "Owner: " +
        getPlan().keeps.find((item) => item.id === player.ownerId)?.name;
      identity.append(owner);
    }
    const state = fileState(player);
    if (state?.hasDraft) {
      const draft = document.createElement("span");
      draft.className = "detail draft-badge";
      paintStatusBadge(
        draft,
        state.label?.includes("review")
          ? "Review"
          : state.label?.includes("not saved")
            ? "Not saved"
            : "Draft",
        state.label?.includes("review") || state.label?.includes("not saved")
          ? "warning"
          : "draft",
        state.label,
      );
      identity.append(draft);
    }
    if (state && player.playerSource && !state.canEdit) {
      const sync = document.createElement("span");
      sync.className = "profile-access-indicator";
      sync.setAttribute("role", "img");
      sync.setAttribute("aria-label", state.accessLabel);
      sync.title = state.accessLabel;
      sync.innerHTML =
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/></svg>';
      portrait.append(sync);
    }
    button.append(portrait, identity);
    button.onclick = () => open(player.id);
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "player-remove";
    labelWithIcon(removeButton, "close");
    removeButton.title = "Remove " + player.name;
    removeButton.setAttribute("aria-label", removeButton.title);
    removeButton.onclick = () => remove(player.id);
    tile.append(button, removeButton);
    return tile;
  }
  function render() {
    const query = search.value.trim().toLowerCase();
    const players = getPlan().keeps.filter((player) => {
      const owner = getPlan().keeps.find((item) => item.id === player.ownerId);
      return (
        (player.ownerId != null) === alts &&
        (
          player.name +
          " " +
          player.accountId +
          " " +
          player.allianceTag +
          " " +
          (owner?.name || "")
        )
          .toLowerCase()
          .includes(query)
      );
    });
    if (alts) {
      const hasOwner = getPlan().keeps.some((player) => player.ownerId == null);
      addButton.disabled = !hasOwner;
      $("alts-empty").hidden = hasOwner;
      $("alts-list-empty").hidden = !hasOwner || players.length > 0;
      $("alts-list-empty").textContent = query
        ? "No matching alts."
        : "No alts yet.";
      actionRow.hidden = hasOwner && players.length > 0;
    } else {
      $("players-empty").hidden = players.length > 0;
      $("players-empty").textContent = query
        ? "No matching players."
        : "No players yet.";
      actionRow.hidden = players.length > 0;
    }
    grid.replaceChildren(
      ...players.map((player) => tile(player, query)),
      addButton,
    );
  }
  return { render };
}
