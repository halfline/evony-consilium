import assert from "node:assert/strict";

export async function formationObstacle({ page, driveFiles }) {
  await page.locator("#add-obstacle").click();
  const row = page.locator("#structure-list .players-row").last();
  assert.match(await row.textContent(), /Blocked tile · Unplaced/);
  const box = await page.locator("#map").boundingBox();
  await page.mouse.click(box.x + box.width / 2 + 20, box.y + box.height / 2 + 10);
  assert.doesNotMatch(await row.textContent(), /Unplaced/);
  await page.locator("#drive-save").click();
  let plan;
  for (let attempt = 0; attempt < 40; attempt++) {
    const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
    plan = team?.data.plan;
    if (Number.isInteger(plan?.obstacles[0]?.x)) break;
    await page.waitForTimeout(50);
  }
  assert.equal(plan.obstacles.length, 1);
  assert.equal(Number.isInteger(plan.obstacles[0].x), true);
  const map = plan.maps.find(({ id }) => id === plan.activeMapId);
  assert.deepEqual(map.layout.obstacles, plan.obstacles);
}
