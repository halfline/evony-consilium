import { footprint } from "../domain/entities.js";
import { renderAvatarButton } from "./avatar-browser.js";
import { renderCastleButton } from "./castle-button.js";
import { updateKeepAppearances } from "../domain/castles.js";
import { view } from "./dom.js";
import { newPlayer } from "../domain/players.js";
import { OperationCancelled } from "../services/cancellation.js";
import { renderPortrait } from "./portrait.js";
import { createSearchablePicker } from "./searchable-picker.js";
import { playerPickerCard } from "./player-picker-card.js";
export function createAddPlayerDialog({
  root,
  ownerDialog,
  assets,
  lastTag,
  browse,
  add,
  importPlayer,
  getAvatars,
  browseAvatar,
  getPlan,
  context = () => null,
}) {
  const $ = view(root, ownerDialog);
  const dialog = $("add-player-dialog");
  let openedContext,
    draft,
    busy = false,
    addingAlt = false;
  const owners = () =>
    getPlan().keeps.filter((player) => player.ownerId == null);
  function avatarFor(player) {
    const catalog = getAvatars();
    return (
      catalog.avatars.find((item) => item.id === player.avatarId) ||
      catalog.avatars.find((item) => item.id === catalog.defaultId)
    );
  }
  function renderOwner(player) {
    $("new-player-owner").value = player?.id || "";
    $("new-player-owner-name").textContent = player?.name || "Choose player";
    const avatar = player && avatarFor(player);
    renderPortrait(
      $("new-player-owner-portrait"),
      avatar && (avatar.previewSrc || avatar.src),
    );
    $("new-player-owner-choice").setAttribute(
      "aria-label",
      player ? `Change owner: ${player.name}` : "Choose alt owner",
    );
  }
  const ownerPicker = createSearchablePicker({
    dialog: ownerDialog,
    search: $("new-player-owner-search"),
    grid: $("new-player-owner-grid"),
    empty: $("new-player-owner-empty"),
    items: owners,
    matches: (player, query) =>
      `${player.name} ${player.allianceTag} ${player.accountId}`
        .toLowerCase()
        .includes(query),
    renderCard: (player) => playerPickerCard(player, getAvatars),
  });
  $("new-player-owner-choice").onclick = () => {
    if (busy || !addingAlt) return;
    dialog.close();
    ownerPicker.open($("new-player-owner").value, (player) =>
      renderOwner(player),
    );
  };
  ownerDialog.addEventListener("close", () => {
    if (addingAlt && openedContext === context() && !dialog.open) {
      dialog.showModal();
      $("new-player-owner-choice").focus();
    }
  });
  $("new-player-castle").onclick = () =>
    browse("keep", (asset) => {
      draft.skin = asset.id;
      draft.w = draft.h = footprint(asset);
      renderCastleButton($("new-player-castle"), asset);
    });
  $("new-player-avatar").onclick = () =>
    browseAvatar(draft.avatarId, (avatar) => {
      draft.avatarId = avatar.id;
      renderAvatarButton($("new-player-avatar"), getAvatars(), draft.avatarId);
    });
  $("new-player-level").oninput = () => {
    if (!draft) return;
    const player = { ...draft, level: Number($("new-player-level").value) };
    updateKeepAppearances([player], assets);
    draft.skin = player.skin;
    renderCastleButton($("new-player-castle"), assets.get(draft.skin));
  };
  $("new-player-form").onsubmit = async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    const submit = $("new-player-form").querySelector("[type=submit]");
    submit.disabled = true;
    try {
      const player = {
        ...draft,
        name: $("new-player-name").value.trim(),
        accountId: $("new-player-account").value.trim(),
        allianceTag: $("new-player-tag").value.trim(),
        level: Number($("new-player-level").value),
      };
      if (addingAlt) {
        const ownerId = $("new-player-owner").value;
        if (!ownerId) throw new Error("Choose an owner for this alt.");
        if (!owners().some((owner) => owner.id === ownerId))
          throw new Error("Choose a regular player as the owner.");
        player.ownerId = ownerId;
      }
      if (!player.name) throw new Error("Enter a player name.");
      await add(player, () => dialog.close());
      if (dialog.open) dialog.close();
    } catch (error) {
      if (openedContext === context()) {
        if (!dialog.open) dialog.showModal();
        $("new-player-error").textContent =
          error instanceof OperationCancelled
            ? "Player was not added. Your entries are still here."
            : error.message;
      }
    } finally {
      busy = false;
      submit.disabled = false;
    }
  };
  $("import-player-file").onclick = async () => {
    if (busy) return;
    busy = true;
    const button = $("import-player-file");
    button.disabled = true;
    $("new-player-error").textContent = "";
    dialog.close();
    try {
      await importPlayer();
    } catch (error) {
      if (openedContext === context()) {
        dialog.showModal();
        if (!(error instanceof OperationCancelled))
          $("new-player-error").textContent = error.message;
      }
    } finally {
      busy = false;
      button.disabled = false;
    }
  };
  return {
    player: () =>
      dialog.open
        ? { ...draft, level: Number($("new-player-level").value) }
        : null,
    open(alt = false) {
      if (dialog.open || busy) return;
      openedContext = context();
      addingAlt = alt;
      draft = newPlayer(assets, lastTag(), alt ? 35 : 42);
      draft.avatarId = getAvatars().defaultId;
      renderAvatarButton($("new-player-avatar"), getAvatars(), draft.avatarId);
      $("new-player-form").reset();
      $("new-player-title").textContent = alt ? "Add alt" : "Add player";
      $("new-player-form").querySelector("[type=submit]").textContent = alt
        ? "Add alt"
        : "Add player";
      $("import-player-file").hidden = alt;
      $("new-player-owner-control").hidden = !alt;
      renderOwner(null);
      $("new-player-tag").value = draft.allianceTag;
      $("new-player-level").value = draft.level;
      renderCastleButton($("new-player-castle"), assets.get(draft.skin));
      $("new-player-error").textContent = "";
      dialog.showModal();
      $("new-player-name").focus();
    },
  };
}
