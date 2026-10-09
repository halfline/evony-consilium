import assert from "node:assert/strict";

export async function formationDragOff({ page, driveFiles }) {
  const teamFile = () => [...driveFiles.values()].find(
    ({ data }) => data?.format === "evony-consilium-team");
  const row = page.locator("#formation-players button").first();
  await row.click();
  let box = await page.locator("#map").boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  assert.doesNotMatch(await row.textContent(), /Unplaced/);
  await page.locator("#drive-save").click();
  for (let attempt = 0; attempt < 40; attempt++) {
    if (Number.isInteger(teamFile()?.data.plan.keeps[0].x)) break;
    await page.waitForTimeout(50);
  }
  assert.ok(Number.isInteger(teamFile().data.plan.keeps[0].x));

  await row.click();
  box = await page.locator("#map").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 20, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  assert.match(await row.textContent(), /Unplaced/);
  await page.locator("#drive-save").click();
  for (let attempt = 0; attempt < 40; attempt++) {
    if (teamFile()?.data.plan.keeps[0].x === null) break;
    await page.waitForTimeout(50);
  }
  const plan = teamFile().data.plan;
  assert.equal(plan.keeps.length, 1);
  assert.equal(plan.keeps[0].x, null);
  const map = plan.maps.find(({ id }) => id === plan.activeMapId);
  assert.equal(map.layout.positions[0].x, null);
}
