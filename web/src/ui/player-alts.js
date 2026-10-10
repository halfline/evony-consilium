import { view } from "./dom.js";
import { renderPortrait } from "./portrait.js";
import { assignPlayerOwner } from "../domain/players.js";
import { createSearchablePicker } from "./searchable-picker.js";
import { playerPickerCard } from "./player-picker-card.js";

// Alt relationships are team data. Manage them from the owning player's tab,
// independently of access to either account's profile file.
export function createPlayerAlts({
  root,
  dialog,
  getPlan,
  getPlayer,
  getAvatars,
  canEdit,
  commit,
  context,
  openPlayer,
  status,
}) {
  const $ = view(root, dialog);
  let assigningTo, openedContext, selectedId;
  const candidates = () =>
    getPlan().keeps.filter(
      (player) => player.id !== assigningTo && player.ownerId == null,
    );
  const picker = createSearchablePicker({
    dialog,
    search: $("assign-alt-search"),
    grid: $("assign-alt-list"),
    empty: $("assign-alt-empty"),
    items: candidates,
    matches: (player, query) =>
      `${player.name} ${player.accountId} ${player.allianceTag}`
        .toLowerCase()
        .includes(query),
    renderCard: (player, query) =>
      playerPickerCard(player, getAvatars, { details: true, query }),
    closeOnSelect: false,
  });
  function accountButton(player, className, open) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.dataset.alt = player.id;
    const portrait = document.createElement("span");
    portrait.className = "player-alt-portrait";
    const catalog = getAvatars();
    const avatar =
      catalog.avatars.find((item) => item.id === player.avatarId) ||
      catalog.avatars.find((item) => item.id === catalog.defaultId);
    if (avatar) renderPortrait(portrait, avatar.previewSrc || avatar.src);
    const identity = document.createElement("span");
    identity.className = "player-alt-identity";
    const name = document.createElement("strong");
    name.textContent = `${player.allianceTag ? `[${player.allianceTag}] ` : ""}${player.name}`;
    const detail = document.createElement("span");
    detail.className = "muted";
    detail.textContent = `K${player.level}${player.accountId ? ` · ID ${player.accountId}` : ""}`;
    identity.append(name, detail);
    button.append(portrait, identity);
    button.onclick = open;
    return button;
  }
  function current() {
    const player = getPlayer();
    return (
      openedContext === context() &&
      canEdit() &&
      player?.id === assigningTo &&
      player.ownerId == null
    );
  }
  function renderChoices() {
    const choices = candidates();
    const selected = choices.find((player) => player.id === selectedId);
    if (!selected) selectedId = null;
    picker.render();
    renderSelection();
  }
  function renderSelection() {
    const selected = candidates().find((player) => player.id === selectedId);
    $("assign-alt-confirm").disabled = !selected;
    const children = getPlan().keeps.filter(
      (player) => selected && player.ownerId === selected.id,
    );
    $("assign-alt-help").textContent = children.length
      ? children.length === 1
        ? "Their existing alt will move too."
        : `${children.length} existing alts will move too.`
      : "";
  }
  $("player-add-alt").onclick = () => {
    const player = getPlayer();
    if (!canEdit() || !player || player.ownerId != null) return;
    assigningTo = player.id;
    openedContext = context();
    selectedId = null;
    $("assign-alt-title").textContent = `Add an alt to ${player.name}`;
    picker.open(null, (candidate) => {
      selectedId = candidate.id;
      renderSelection();
    });
    renderSelection();
  };
  $("assign-alt-confirm").onclick = () => {
    if (!current()) return dialog.close();
    if (!candidates().some((player) => player.id === selectedId)) {
      renderChoices();
      return;
    }
    try {
      commit(assignPlayerOwner(getPlan(), selectedId, assigningTo));
      dialog.close();
      status("Alt added. Team changes save automatically.");
    } catch (error) {
      $("assign-alt-help").textContent = error.message;
    }
  };
  $("player-alt-open-owner").onclick = () => {
    const ownerId = getPlayer()?.ownerId;
    if (!ownerId) return;
    openPlayer(ownerId);
    root.querySelector('[data-player-tab="alts"]').click();
  };
  function render() {
    const player = getPlayer();
    if (dialog.open) {
      if (!current()) dialog.close();
      else renderChoices();
    }
    if (!player) return;
    const owner = getPlan().keeps.find((item) => item.id === player.ownerId);
    $("player-alt-owner").hidden = !owner;
    $("player-alt-owner").textContent = owner ? `Alt of ${owner.name}` : "";
    $("player-alt-open-owner").hidden = !owner;
    $("player-alt-open-owner").textContent = owner
      ? `View ${owner.name}'s alts`
      : "View player's alts";
    const alts = getPlan().keeps.filter((item) => item.ownerId === player.id);
    $("player-add-alt").hidden = !!owner || !canEdit();
    $("player-alts").replaceChildren(
      ...alts.map((alt) => {
        const row = document.createElement("div");
        row.className = "player-alt-row";
        row.append(
          accountButton(alt, "player-alt-open", () => openPlayer(alt.id)),
        );
        if (canEdit()) {
          const menu = document.createElement("details");
          menu.className = "player-alt-menu";
          const trigger = document.createElement("summary");
          trigger.textContent = "⋯";
          trigger.setAttribute("aria-label", `Actions for ${alt.name}`);
          const unlink = document.createElement("button");
          unlink.type = "button";
          unlink.dataset.altUnlink = alt.id;
          unlink.textContent = "Make regular player";
          unlink.onclick = () => {
            if (!canEdit() || getPlayer()?.id !== player.id) return;
            const latest = getPlan().keeps.find((item) => item.id === alt.id);
            if (latest?.ownerId !== player.id) return;
            try {
              commit(assignPlayerOwner(getPlan(), alt.id, null));
              status(
                `${alt.name} is now a regular player. Team changes save automatically.`,
              );
            } catch (error) {
              status(error.message, true);
            }
          };
          menu.append(trigger, unlink);
          row.append(menu);
        }
        return row;
      }),
    );
  }
  return { render };
}
