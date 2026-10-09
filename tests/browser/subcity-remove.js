import assert from "node:assert/strict";

export async function subcityRemove({ page, driveFiles }) {
  await page.locator("#subcities .subcity-tile").first().hover();
  await page.locator("#subcities .subcity-remove").first().click();
  assert.equal(await page.locator("#subcities .subcity-card").count(), 0);
  await page.locator("#drive-save").click();
  for (let attempt = 0; attempt < 40; attempt++) {
    const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
    if (team?.data.plan.subcities?.length === 0) break;
    await page.waitForTimeout(50);
  }
  const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
  assert.equal(team.data.plan.subcities.length, 0);
}
