import assert from "node:assert/strict";

export async function mapRemove({ page, driveFiles }) {
  await page.locator("#maps-list .map-list-row").last().hover();
  await page.locator("#maps-list .map-forget").last().click();
  assert.equal(await page.locator("#maps-list .map-row").count(), 1);
  await page.locator("#maps-list .map-list-row").first().hover();
  await page.locator("#maps-list .map-forget").first().click();
  assert.equal(await page.locator("#maps-list .map-row").count(), 0);
  await page.locator("#drive-save").click();
  for (let attempt = 0; attempt < 40; attempt++) {
    const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
    if (team?.data.plan.maps?.length === 0) break;
    await page.waitForTimeout(50);
  }
  const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
  assert.deepEqual(team.data.plan.maps, []);
  assert.equal(team.data.plan.activeMapId, null);
}
