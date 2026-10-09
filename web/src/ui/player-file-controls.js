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
          "This player is still read-only. Ask an admin to grant write access to its file in Drive, then unlock again.",
        );
      status("Player editing unlocked for your account.");
    });
  $("player-unlock").onclick = unlockPlayer;
  function render() {
    const player = getPlayer();
    if (!player) return;
    const state = getFiles()?.state(player) || { label: "Team copy" };
    $("player-unlock").hidden = !!state.canEdit;
    $("player-unlock").disabled = !!state.busy;
  }
  return { render, resolve, unlock: unlockPlayer };
}
