import assert from "node:assert/strict";

export async function formationArrange({ page, driveFiles }) {
  const rows = page.locator("#formation-players .players-row");
  assert.equal(await rows.count(), 2);
  await page.locator("#auto-place").click();
  assert.match(await page.locator("#toast").textContent(), /Formation arranged/);
  for (const row of await rows.all())
    assert.doesNotMatch(await row.textContent(), /Unplaced/);
  await page.locator("#drive-save").click();
  let plan;
  for (let attempt = 0; attempt < 40; attempt++) {
    const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
    plan = team?.data.plan;
    if (plan?.keeps.length === 2 && plan.keeps.every(({ x }) => Number.isInteger(x))) break;
    await page.waitForTimeout(50);
  }
  assert.equal(plan.keeps.every(({ x, y }) => Number.isInteger(x) && Number.isInteger(y)), true);
  const map = plan.maps.find(({ id }) => id === plan.activeMapId);
  for (const keep of plan.keeps) {
    const position = map.layout.positions.find(({ id }) => id === keep.id);
    assert.deepEqual([position.x, position.y], [keep.x, keep.y]);
  }
  assert.equal(map.layout.obstacles.length, 1);
}
