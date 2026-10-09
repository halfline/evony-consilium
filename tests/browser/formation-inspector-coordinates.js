import assert from "node:assert/strict";

export async function formationInspectorCoordinates({ page, driveFiles }) {
  await page.locator("#formation-players .players-row").first().click();
  const x = Number(await page.locator("#entity-x").inputValue());
  const y = Number(await page.locator("#entity-y").inputValue());
  await page.locator("#entity-x").fill("999999");
  await page.locator("#entity-form .apply-entity").click();
  assert.match(await page.locator("#toast").textContent(), /outside the map/);
  await page.locator("#entity-x").fill(String(x + 1));
  await page.locator("#entity-y").fill(String(y));
  await page.locator("#entity-form .apply-entity").click();
  assert.match(await page.locator("#toast").textContent(), /Changes applied/);
  await page.locator("#drive-save").click();
  let plan;
  for (let attempt = 0; attempt < 40; attempt++) {
    const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
    plan = team?.data.plan;
    if (plan?.keeps[0]?.x === x + 1) break;
    await page.waitForTimeout(50);
  }
  assert.deepEqual([plan.keeps[0].x, plan.keeps[0].y], [x + 1, y]);
  const map = plan.maps.find(({ id }) => id === plan.activeMapId);
  const position = map.layout.positions.find(({ id }) => id === plan.keeps[0].id);
  assert.deepEqual([position.x, position.y], [x + 1, y]);
}
