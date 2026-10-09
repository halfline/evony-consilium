import assert from "node:assert/strict";

export async function formationDelete({ page, driveFiles }) {
  await page.locator('[data-screen="maps"]').click();
  await page.locator("#maps-list .map-row").filter({ hasText: "Player formation" }).click();
  const row = page.locator("#formation-players button").first();
  assert.doesNotMatch(await row.textContent(), /Unplaced/);
  await row.click();
  await page.locator("#map").press("Delete");
  assert.match(await row.textContent(), /Unplaced/);
  await page.locator("#drive-save").click();
  let plan;
  for (let attempt = 0; attempt < 40; attempt++) {
    const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
    plan = team?.data.plan;
    const map = plan?.maps.find(({ id }) => id === plan.activeMapId);
    if (plan?.keeps[0]?.x === null && map?.layout.positions[0]?.x === null) break;
    await page.waitForTimeout(50);
  }
  assert.equal(plan.keeps.length, 1);
  assert.equal(plan.keeps[0].x, null);
  const map = plan.maps.find(({ id }) => id === plan.activeMapId);
  assert.equal(map.layout.positions[0].x, null);
}
