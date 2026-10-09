import assert from "node:assert/strict";

export async function playerAvatarChange({ page, driveFiles }) {
  await page.locator("#players .player-card").first().click();
  const playerFile = [...driveFiles.values()].find(
    ({ data }) => data?.format === "evony-consilium-player",
  );
  const before = playerFile.data.profile.avatarId;
  await page.locator("#player-avatar").click();
  const dialog = page.locator("#avatar-dialog");
  await dialog.waitFor({ state: "visible" });
  const next = await dialog.locator("#avatar-grid [data-avatar]").evaluateAll(
    (buttons, current) => buttons.find((button) => button.dataset.avatar !== current)?.dataset.avatar,
    before,
  );
  assert.ok(next);
  await dialog.locator(`[data-avatar="${next}"]`).click();
  for (let attempt = 0; attempt < 40; attempt++) {
    if (playerFile.data.profile.avatarId === next) break;
    await page.waitForTimeout(50);
  }
  assert.equal(playerFile.data.profile.avatarId, next);
  assert.equal(await dialog.isVisible(), false);
}
