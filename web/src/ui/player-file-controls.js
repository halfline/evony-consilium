import { view } from "./dom.js";
import { OperationCancelled } from "../services/cancellation.js";

export function createPlayerFileControls({
  root,
  getPlayer,
  getFiles,
  unlock,
  status,
  refresh,
}) {
  const $ = view(root);
  async function unlockPlayer() {
    try {
      await unlock();
      const access = getFiles().state(getPlayer());
      if (!access.canEdit)
        throw new Error(
          "This player is still read-only. Ask an admin to grant write access to its file in Drive, then unlock again.",
        );
      status("Player editing unlocked for your account.");
    } catch (error) {
      if (!(error instanceof OperationCancelled)) status(error.message, true);
    } finally {
      refresh();
    }
  }
  $("player-unlock").onclick = unlockPlayer;
  function render() {
    const player = getPlayer();
    if (!player) return;
    const state = getFiles()?.state(player) || { label: "Team copy" };
    $("player-unlock").hidden = !!state.canEdit;
    $("player-unlock").disabled = !!state.busy;
  }
  return { render, unlock: unlockPlayer };
}
