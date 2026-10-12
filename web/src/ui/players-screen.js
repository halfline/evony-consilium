import { renderPlayerPortrait } from "./portrait.js";
import { view } from "./dom.js";
import { bindTileActions } from "./tile-actions.js";
import { createCollectionControls } from "./collection-controls.js";
import { paintStatusBadge } from "./status-badge.js";
import { matchesPlayerSearch, comparePlayerSearch } from "./player-search.js";
import { createRemoveButton } from "./remove-button.js";
import { orderByPlayerOwner } from "./owner-group-order.js";

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
  const collection = createCollectionControls({
    root,
    grid,
    add: addButton,
    views: true,
    title: alts ? "Alts" : "Players",
    description: alts
      ? "Linked alternate accounts"
      : "Profiles for strategy, tactics, and growth",
    label: alts ? "Add alt" : "Add player",
    kind: alts ? "alts" : "players",
    emptyTitle: $(alts ? "alts-list-empty" : "players-empty"),
  });
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
    button.title = `${player.name} · K${player.level}${player.allianceTag ? ` · [${player.allianceTag}]` : ""}`;
    const portrait = document.createElement("span");
    portrait.className = "player-portrait";
    renderPlayerPortrait(portrait, getAvatars(), player);
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
    const removeButton = createRemoveButton({
      className: "player-remove",
      label: "Remove " + player.name,
      remove: () => remove(player.id),
    });
    tile.append(button, removeButton);
    return tile;
  }
  function render() {
    const query = search.value.trim().toLowerCase();
    const hasOwner = getPlan().keeps.some((player) => player.ownerId == null);
    const players = getPlan().keeps.filter((player) => {
      const owner = getPlan().keeps.find((item) => item.id === player.ownerId);
      return (
        (player.ownerId != null) === alts &&
        matchesPlayerSearch(player, query, owner?.name)
      );
    });
    players.sort((a, b) =>
      comparePlayerSearch(
        a,
        b,
        query,
        getPlan().keeps.find((player) => player.id === a.ownerId)?.name,
        getPlan().keeps.find((player) => player.id === b.ownerId)?.name,
      ),
    );
    if (alts)
      orderByPlayerOwner(getPlan(), players, (player) => player.ownerId);
    else if (!query) players.sort((a, b) => b.level - a.level);
    if (alts) {
      addButton.disabled = !hasOwner;
      $("alts-empty").hidden = hasOwner;
    }
    const total = getPlan().keeps.filter(
      (player) => (player.ownerId != null) === alts,
    ).length;
    collection.render({
      count: players.length,
      total,
      filtered: !!query,
      emptyTitle:
        alts && !hasOwner
          ? null
          : query
            ? `No matching ${alts ? "alts" : "players"}.`
            : `No ${alts ? "alts" : "players"} yet.`,
      help: query
        ? "Try another name, alliance tag, or account ID."
        : alts
          ? "Create a regular player first, then link their alternate accounts here."
          : "Add a player to start planning tactics and tracking growth.",
      clear: () => {
        search.value = "";
        render();
        search.focus();
      },
    });
    grid.replaceChildren(...players.map((player) => tile(player, query)));
  }
  return { render };
}
