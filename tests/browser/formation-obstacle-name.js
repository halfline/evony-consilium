import assert from "node:assert/strict";

export async function formationObstacleName({ page, driveFiles }) {
  assert.equal(await page.locator("#placement-name").isVisible(), true);
  await page.locator("#placement-name").fill("West gate blocked");
  await page.locator("#entity-form .apply-entity").click();
  assert.match(await page.locator("#structure-list .players-row").last().textContent(),
    /West gate blocked/);
  await page.locator("#drive-save").click();
  let plan;
  for (let attempt = 0; attempt < 40; attempt++) {
    const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
    plan = team?.data.plan;
    if (plan?.obstacles[0]?.name === "West gate blocked") break;
    await page.waitForTimeout(50);
  }
  assert.equal(plan.obstacles[0].name, "West gate blocked");
  const map = plan.maps.find(({ id }) => id === plan.activeMapId);
  assert.equal(map.layout.obstacles[0].name, "West gate blocked");
}
