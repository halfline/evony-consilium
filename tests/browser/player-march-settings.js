import assert from "node:assert/strict";

export async function playerMarchSettings({ page, driveFiles }) {
  await page.locator("#player-march-list .march-card").filter({ hasText: "Ground lead" }).click();
  await page.locator("#player-march-highest").selectOption("16");
  await page.locator("#player-march-capacity").fill("5000000");
  await page.locator("#player-march-capacity").press("Tab");
  await page.locator("#player-march-layer-size").fill("1000");
  await page.locator("#player-march-layer-size").press("Tab");
  await page.locator("#player-form [type=submit]").click();
  const playerFile = [...driveFiles.values()].find(
    ({ data }) => data?.format === "evony-consilium-player",
  );
  for (let attempt = 0; attempt < 40; attempt++) {
    const march = playerFile.data.profile.details?.marches?.find((item) => item.name === "Ground lead");
    if (march?.generation?.highestTier === 16 && march.capacityOverride === 5000000 && march.generation.layerSize === 1000) break;
    await page.waitForTimeout(50);
  }
  const march = playerFile.data.profile.details.marches.find((item) => item.name === "Ground lead");
  assert.equal(march.generation.highestTier, 16);
  assert.equal(march.capacityOverride, 5000000);
  assert.equal(march.generation.layerSize, 1000);
  assert.equal(march.layers.find((row) => row.tier === 15).ground, 1234567);
}
