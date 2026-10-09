import assert from "node:assert/strict";

export async function playerMarchSize({ page, driveFiles }) {
  await page.locator('[data-player-tab="march-size"]').click();
  assert.equal(await page.locator('[data-player-panel="march-size"]').isVisible(), true);
  await page.locator('[data-march-size="ground"]').fill("7936450");
  await page.locator("#player-form [type=submit]").click();
  const playerFile = [...driveFiles.values()].find(
    ({ data }) => data?.format === "evony-consilium-player",
  );
  for (let attempt = 0; attempt < 40; attempt++) {
    if (playerFile.data.profile.details?.marchSizes?.ground === 7936450) break;
    await page.waitForTimeout(50);
  }
  assert.equal(playerFile.data.profile.details.marchSizes.ground, 7936450);
  assert.equal(playerFile.data.profile.details.marchBoost, 200);
  assert.equal(
    await page.locator('[data-player-tab="march-size"]').getAttribute("aria-selected"),
    "true",
  );
}
