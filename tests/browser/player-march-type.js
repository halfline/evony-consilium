import assert from "node:assert/strict";

export async function playerMarchType({ page, driveFiles }) {
  await page.locator("#player-march-list .march-card").filter({ hasText: "Ground lead" }).click();
  await page.locator("#player-march-type").selectOption("ranged");
  assert.equal(await page.locator("#player-march-type").inputValue(), "ranged");
  await page.locator("#player-form [type=submit]").click();
  const playerFile = [...driveFiles.values()].find(
    ({ data }) => data?.format === "evony-consilium-player",
  );
  for (let attempt = 0; attempt < 40; attempt++) {
    const march = playerFile.data.profile.details?.marches?.find((item) => item.name === "Ground lead");
    if (march?.troopType === "ranged") break;
    await page.waitForTimeout(50);
  }
  const march = playerFile.data.profile.details.marches.find((item) => item.name === "Ground lead");
  assert.equal(march.troopType, "ranged");
  assert.equal(march.capacityOverride, 5000000);
}
