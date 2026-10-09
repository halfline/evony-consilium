import assert from "node:assert/strict";

export async function playerMarchShares({ page, driveFiles }) {
  await page.locator("#player-march-list .march-card").filter({ hasText: "Ground lead" }).click();
  const share = page.getByRole("spinbutton", { name: "T15 share (%)" });
  assert.equal(await share.isEnabled(), true);
  await share.fill("35");
  await share.press("Tab");
  const balancingShare = page.getByRole("spinbutton", { name: "T12 share (%)" });
  await balancingShare.fill("15");
  await balancingShare.press("Tab");
  await page.locator("#player-form [type=submit]").click();
  const playerFile = [...driveFiles.values()].find(
    ({ data }) => data?.format === "evony-consilium-player",
  );
  for (let attempt = 0; attempt < 40; attempt++) {
    const march = playerFile.data.profile.details?.marches?.find((item) => item.name === "Ground lead");
    if (march?.generation?.weights?.[15] === 35) break;
    await page.waitForTimeout(50);
  }
  const march = playerFile.data.profile.details.marches.find((item) => item.name === "Ground lead");
  assert.equal(march.generation.weights[15], 35);
  assert.equal(march.generation.weights[12], 15);
  assert.equal(march.generation.manual, false);
}
