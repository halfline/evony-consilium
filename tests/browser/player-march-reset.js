import assert from "node:assert/strict";

export async function playerMarchReset({ page, driveFiles }) {
  await page.locator("#player-march-list .march-card").filter({ hasText: "Ground lead" }).click();
  assert.equal(await page.locator("#player-reset-strategy").isVisible(), true);
  await page.locator("#player-reset-strategy").click();
  assert.equal(await page.locator("#player-reset-strategy").isVisible(), false);
  await page.locator("#player-form [type=submit]").click();
  const playerFile = [...driveFiles.values()].find(
    ({ data }) => data?.format === "evony-consilium-player",
  );
  for (let attempt = 0; attempt < 40; attempt++) {
    const march = playerFile.data.profile.details?.marches?.find((item) => item.name === "Ground lead");
    if (march?.generation?.manual === false) break;
    await page.waitForTimeout(50);
  }
  const march = playerFile.data.profile.details.marches.find((item) => item.name === "Ground lead");
  assert.equal(march.generation.manual, false);
  assert.notEqual(march.layers.find((row) => row.tier === 15).ground, 1234567);
}
