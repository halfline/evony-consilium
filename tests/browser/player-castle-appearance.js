import assert from "node:assert/strict";

export async function playerCastleAppearance({ page, driveFiles }) {
  await page.locator('[data-screen="players"]').click();
  await page.locator("#players .player-card").first().click();
  const playerFile = [...driveFiles.values()].find(
    ({ data }) => data?.format === "evony-consilium-player",
  );
  const previousSkin = playerFile.data.profile.skin;
  await page.locator("#player-castle").click();
  await page.locator("#catalog-dialog").waitFor({ state: "visible" });
  const choice = page.locator('#catalog-grid [data-family="culture-europe"]');
  const nextSkin = await choice.getAttribute("data-asset");
  assert.notEqual(nextSkin, previousSkin);
  await choice.click();
  for (let attempt = 0; attempt < 40; attempt++) {
    if (playerFile.data.profile.skin === nextSkin) break;
    await page.waitForTimeout(50);
  }
  assert.equal(playerFile.data.profile.skin, nextSkin);
  assert.match(await page.locator("#player-castle").getAttribute("aria-label"), /Europe/);
}
