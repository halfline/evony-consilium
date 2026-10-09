import assert from "node:assert/strict";

export async function playerProfileUnlock({ page, driveFiles }) {
  const playerFile = [...driveFiles.values()].find(
    ({ data }) => data?.format === "evony-consilium-player" && data.profile.name === "Renamed player",
  );
  assert.ok(playerFile);
  playerFile.file.capabilities.canEdit = false;
  await page.evaluate(() => {
    window.__originalDateNow = Date.now;
    const baseline = Date.now();
    Date.now = () => baseline + 31000;
  });
  await page.locator('[data-screen="players"]').click();
  await page.locator("#players .player-card").first().click();
  await page.locator("#player-unlock").waitFor({ state: "visible" });
  assert.equal(await page.locator("#player-avatar").isDisabled(), true);
  playerFile.file.capabilities.canEdit = true;
  await page.locator("#player-unlock").click();
  await page.locator("#player-unlock").waitFor({ state: "hidden" });
  assert.equal(await page.locator("#player-avatar").isEnabled(), true);
  assert.match(await page.locator("#toast").textContent(), /unlocked/i);
  await page.evaluate(() => { Date.now = window.__originalDateNow; });
}
