import { view } from "./dom.js";
import { OperationCancelled } from "../services/cancellation.js";
export function createPlayerFileControls({
  root,
  dialog,
  getPlayer,
  getFiles,
  unlock,
  status,
  refresh,
}) {
  const $ = view(root, dialog);
  let pending;
  function resolve(conflicts) {
    dialog.querySelector("#player-sync-conflicts").textContent =
      conflicts.join(", ");
    dialog.showModal();
    return new Promise((accept) => {
      pending = accept;
    });
  }
  function close(value = null) {
    const accept = pending;
    pending = null;
    dialog.close();
    accept?.(value);
  }
  for (const button of dialog.querySelectorAll("[data-resolution]"))
    button.onclick = () =>
      close(
        button.dataset.resolution === "cancel"
          ? null
          : button.dataset.resolution,
      );
  dialog.oncancel = (event) => {
    event.preventDefault();
    close();
  };
  async function run(task) {
    try {
      await task();
    } catch (error) {
      if (!(error instanceof OperationCancelled)) status(error.message, true);
    } finally {
      refresh();
    }
  }
  const unlockPlayer = () =>
    run(async () => {
      await unlock();
      const access = getFiles().state(getPlayer());
      if (!access.canEdit)
        throw new Error(
          "This player file is still read-only. Ask its owner for Editor access in Drive, then check access again.",
        );
      status("Player file connected with Editor access.");
    });
  $("player-unlock").onclick = unlockPlayer;
  function render() {
    const player = getPlayer();
    if (!player) return;
    const state = getFiles()?.state(player) || { label: "Team copy" };
    $("player-unlock").hidden = !!state.canEdit;
    $("player-unlock").disabled = !!state.busy;
    $("player-unlock").textContent = !player.playerSource
      ? "Create player file"
      : state.connected
        ? "Check editing access"
        : "Connect player file";
    $("player-unlock").setAttribute(
      "aria-label",
      $("player-unlock").textContent,
    );
    $("player-unlock").title = !player.playerSource
      ? "Read-only team copy. Create a player file to edit it."
      : state.connected
        ? "Read-only profile. The file owner can grant Editor access in Drive."
        : "Read-only cached profile. Connect the player file to edit it.";
    const fileLink = $("player-drive-link");
    fileLink.hidden = !player.playerSource;
    if (player.playerSource) {
      const url = new URL(
        `https://drive.google.com/file/d/${player.playerSource.fileId}/view`,
      );
      if (player.playerSource.resourceKey)
        url.searchParams.set("resourcekey", player.playerSource.resourceKey);
      fileLink.href = url.href;
    }
  }
  return { render, resolve, unlock: unlockPlayer };
}
