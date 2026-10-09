import assert from "node:assert/strict";

export async function playerRallyCapacity({ page, driveFiles }) {
  await page.locator('[data-player-tab="rally-capacity"]').click();
  assert.equal(await page.locator('[data-player-panel="rally-capacity"]').isVisible(), true);
  await page.locator("#player-rally-capacity").fill("12345678");
  await page.locator("#player-form [type=submit]").click();
  const playerFile = [...driveFiles.values()].find(
    ({ data }) => data?.format === "evony-consilium-player",
  );
  for (let attempt = 0; attempt < 40; attempt++) {
    if (playerFile.data.profile.details?.rallyCapacity === 12345678) break;
    await page.waitForTimeout(50);
  }
  assert.equal(playerFile.data.profile.details.rallyCapacity, 12345678);
  assert.equal(playerFile.data.profile.details.marchSizes.ground, 7936450);
  assert.equal(playerFile.data.profile.details.buffs.city.ground.attack, 3385);
}
