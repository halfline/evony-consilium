import assert from "node:assert/strict";

export async function formationDemo({ page, driveFiles }) {
  await page.locator("#help").click();
  await page.locator("#load-demo").click();
  assert.equal(await page.locator("#help-dialog").isHidden(), true);
  assert.equal(await page.locator("#formation-players .players-row").count(), 12);
  assert.equal(await page.locator("#structure-list .players-row").count(), 0);
  await page.locator("#drive-save").click();
  let plan;
  for (let attempt = 0; attempt < 40; attempt++) {
    const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
    plan = team?.data.plan;
    if (plan?.keeps.length === 12) break;
    await page.waitForTimeout(50);
  }
  assert.equal(plan.keeps.length, 12);
  assert.equal(plan.keeps.every(({ x, y }) => Number.isInteger(x) && Number.isInteger(y)), true);
  assert.equal(plan.rallyId, plan.keeps[0].id);
  const map = plan.maps.find(({ id }) => id === plan.activeMapId);
  assert.equal(map.layout.positions.length, 12);
}
