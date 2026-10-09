import assert from "node:assert/strict";

export async function playerFileUnlock({ page }) {
  const result = await page.evaluate(async () => {
    const { createPlayerFileControls } = await import("/src/ui/player-file-controls.js");
    const root = document.createElement("div");
    root.innerHTML = '<button id="player-unlock" type="button">Unlock</button>';
    document.body.append(root);
    let editable = false;
    let refreshes = 0;
    const messages = [];
    const controls = createPlayerFileControls({
      root,
      getPlayer: () => ({ id: "player" }),
      getFiles: () => ({ state: () => ({ canEdit: editable, busy: false }) }),
      unlock: async () => { editable = true; },
      status: (message) => messages.push(message),
      refresh: () => { refreshes++; controls.render(); },
    });
    controls.render();
    const initiallyVisible = !root.querySelector("#player-unlock").hidden;
    await controls.unlock();
    const hiddenAfterUnlock = root.querySelector("#player-unlock").hidden;
    root.remove();
    return { initiallyVisible, hiddenAfterUnlock, refreshes, messages };
  });
  assert.equal(result.initiallyVisible, true);
  assert.equal(result.hiddenAfterUnlock, true);
  assert.equal(result.refreshes, 1);
  assert.deepEqual(result.messages, ["Player editing unlocked for your account."]);
}
