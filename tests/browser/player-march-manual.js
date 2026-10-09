import assert from "node:assert/strict";

export async function playerMarchManual({ page, driveFiles }) {
  await page.locator("#player-march-list .march-card").filter({ hasText: "Ground" }).click();
  assert.equal(await page.locator("#player-march-editor").isVisible(), true);
  await page.getByRole("spinbutton", { name: "T15 Ground" }).fill("1234567");
  await page.getByRole("spinbutton", { name: "Mounted base count" }).fill("6789");
  await page.locator("#player-march-name").fill("Ground lead");
  await page.locator("#player-form [type=submit]").click();
  const playerFile = [...driveFiles.values()].find(
    ({ data }) => data?.format === "evony-consilium-player",
  );
  for (let attempt = 0; attempt < 40; attempt++) {
    if (playerFile.data.profile.details?.marches?.some((march) => march.name === "Ground lead")) break;
    await page.waitForTimeout(50);
  }
  const march = playerFile.data.profile.details.marches.find((item) => item.name === "Ground lead");
  assert.equal(march.layers.find((row) => row.tier === 15).ground, 1234567);
  assert.equal(march.bases.mounted, 6789);
  assert.equal(march.generation.manual, true);
}
