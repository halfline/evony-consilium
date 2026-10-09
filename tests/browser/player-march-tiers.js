import assert from "node:assert/strict";

export async function playerMarchTiers({ page, driveFiles }) {
  await page.locator("#player-march-list .march-card").filter({ hasText: "Ground lead" }).click();
  await page.locator("#player-add-tier").click();
  assert.equal(await page.locator('[data-tier-row="17"]').count(), 1);
  const tierInput = await page.locator('[data-tier-row="17"] input').first().boundingBox();
  assert.ok(tierInput.height <= 40);
  await page.locator("#player-form [type=submit]").click();
  const playerFile = [...driveFiles.values()].find(
    ({ data }) => data?.format === "evony-consilium-player",
  );
  for (let attempt = 0; attempt < 40; attempt++) {
    const march = playerFile.data.profile.details?.marches?.find((item) => item.name === "Ground lead");
    if (march?.generation?.highestTier === 17) break;
    await page.waitForTimeout(50);
  }
  const march = playerFile.data.profile.details.marches.find((item) => item.name === "Ground lead");
  assert.equal(march.generation.highestTier, 17);
}
