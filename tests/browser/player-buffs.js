import assert from "node:assert/strict";

export async function playerBuffs({ page, driveFiles }) {
  await page.locator("#players .player-card").first().click();
  await page.locator('[data-player-tab="buffs"]').click();
  assert.equal(await page.locator('[data-player-panel="buffs"]').isVisible(), true);
  await page.locator('[data-buff="city.ground.attack"]').fill("3385");
  await page.locator("#player-form [type=submit]").click();
  const playerFile = [...driveFiles.values()].find(
    ({ data }) => data?.format === "evony-consilium-player",
  );
  for (let attempt = 0; attempt < 40; attempt++) {
    if (playerFile.data.profile.details?.buffs?.city?.ground?.attack === 3385) break;
    await page.waitForTimeout(50);
  }
  assert.equal(playerFile.data.profile.details.buffs.city.ground.attack, 3385);
  assert.equal(await page.locator('[data-player-tab="buffs"]').getAttribute("aria-selected"), "true");
}
