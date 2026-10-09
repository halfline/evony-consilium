import assert from "node:assert/strict";

export async function formationObstacleSize({ page, driveFiles }) {
  await page.locator("#structure-list .players-row").last().click();
  assert.equal(await page.locator("#entity-w").isVisible(), true);
  await page.locator("#entity-w").fill("2");
  await page.locator("#entity-h").fill("3");
  await page.locator("#entity-form .apply-entity").click();
  assert.match(await page.locator("#toast").textContent(), /Changes applied/);
  await page.locator("#drive-save").click();
  let plan;
  for (let attempt = 0; attempt < 40; attempt++) {
    const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
    plan = team?.data.plan;
    if (plan?.obstacles[0]?.w === 2 && plan.obstacles[0]?.h === 3) break;
    await page.waitForTimeout(50);
  }
  assert.deepEqual([plan.obstacles[0].w, plan.obstacles[0].h], [2, 3]);
  const map = plan.maps.find(({ id }) => id === plan.activeMapId);
  assert.deepEqual([map.layout.obstacles[0].w, map.layout.obstacles[0].h], [2, 3]);
}
