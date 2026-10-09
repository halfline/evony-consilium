import assert from "node:assert/strict";

export async function playerFileResolution({ page }) {
  const result = await page.evaluate(async () => {
    const { createPlayerFileControls } = await import("/src/ui/player-file-controls.js");
    const root = document.createElement("div");
    root.innerHTML = '<button id="player-unlock" type="button">Unlock</button>';
    const dialog = document.createElement("dialog");
    dialog.innerHTML = '<p id="player-sync-conflicts"></p><button data-resolution="team">Keep mine</button><button data-resolution="player">Use theirs</button><button data-resolution="cancel">Cancel</button>';
    document.body.append(root, dialog);
    const controls = createPlayerFileControls({
      root,
      dialog,
      getPlayer: () => ({ id: "player" }),
      getFiles: () => ({ state: () => ({ canEdit: true, busy: false }) }),
      unlock: async () => {},
      status: () => {},
      refresh: () => {},
    });
    const mine = controls.resolve(["name", "level"]);
    const conflicts = dialog.querySelector("#player-sync-conflicts").textContent;
    dialog.querySelector('[data-resolution="team"]').click();
    const team = await mine;
    const theirs = controls.resolve(["avatar"]);
    dialog.querySelector('[data-resolution="player"]').click();
    const player = await theirs;
    const cancelled = controls.resolve(["tag"]);
    dialog.querySelector('[data-resolution="cancel"]').click();
    const cancel = await cancelled;
    root.remove();
    dialog.remove();
    return { conflicts, team, player, cancel };
  });
  assert.deepEqual(result, { conflicts: "name, level", team: "team", player: "player", cancel: null });
}
