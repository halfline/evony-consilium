import assert from "node:assert/strict";

export async function playerMarchList({ page, driveFiles }) {
  await page.locator('[data-player-tab="troops"]').click();
  assert.equal(await page.locator('[data-player-panel="troops"]').isVisible(), true);
  const portrait = page.locator("#player-march-list .march-card").filter({ hasText: "Ground" }).locator("img");
  assert.match(await portrait.getAttribute("src"), /troop-icons\/ground\.webp$/);
  await portrait.evaluate((image) => image.decode());
  assert.equal(await portrait.evaluate((image) => image.naturalWidth > 0), true);
  await page.locator("#player-add-march").click();
  assert.equal(await page.evaluate(() => document.activeElement?.id), "player-march-name");
  assert.equal(await page.locator("#player-march-name").evaluate((input) => input.selectionStart), 0);
  await page.locator("#player-form [type=submit]").click();
  const playerFile = [...driveFiles.values()].find(
    ({ data }) => data?.format === "evony-consilium-player",
  );
  for (let attempt = 0; attempt < 40; attempt++) {
    if (playerFile.data.profile.details?.marches?.some((march) => march.name === "New march")) break;
    await page.waitForTimeout(50);
  }
  assert.equal(playerFile.data.profile.details.marches.filter((march) => march.name === "New march").length, 1);
  await page.locator("#player-march-list .march-card").filter({ hasText: "New march" }).click();
  await page.locator("#player-remove-march").click();
  await page.locator("#player-form [type=submit]").click();
  for (let attempt = 0; attempt < 40; attempt++) {
    if (!playerFile.data.profile.details?.marches?.some((march) => march.name === "New march")) break;
    await page.waitForTimeout(50);
  }
  assert.equal(playerFile.data.profile.details.marches.some((march) => march.name === "New march"), false);
  assert.equal(playerFile.data.profile.details.rallyCapacity, 12345678);
}
