import assert from "node:assert/strict";

export async function formationGroupDelete({ page, driveFiles }) {
  assert.equal(await page.locator("#formation-players button.selected").count(), 2);
  await page.locator("#map").press("Delete");
  assert.equal(await page.locator("#formation-players button").count(), 2);
  for (const row of await page.locator("#formation-players button").all())
    assert.match(await row.textContent(), /Unplaced/);
  await page.locator("#drive-save").click();
  let plan;
  for (let attempt = 0; attempt < 40; attempt++) {
    const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
    plan = team?.data.plan;
    if (plan?.keeps.length === 2 && plan.keeps.every(({ x }) => x === null)) break;
    await page.waitForTimeout(50);
  }
  assert.equal(plan.keeps.length, 2);
  assert.equal(plan.keeps.every(({ x }) => x === null), true);
  const map = plan.maps.find(({ id }) => id === plan.activeMapId);
  assert.equal(map.layout.positions.every(({ x }) => x === null), true);
}
