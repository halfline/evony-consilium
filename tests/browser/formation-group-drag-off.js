import assert from "node:assert/strict";

export async function formationGroupDragOff({ page, driveFiles }) {
  const rows = page.locator("#formation-players button");
  assert.equal(await rows.count(), 2);
  assert.equal(await page.locator("#formation-players button.selected").count(), 2);
  const box = await page.locator("#map").boundingBox();
  const first = { x: box.x + box.width / 2 + 60, y: box.y + box.height / 2 + 30 };
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width + 30, first.y, { steps: 8 });
  await page.mouse.up();
  for (const row of await rows.all())
    assert.match(await row.textContent(), /Unplaced/);
  await page.locator("#drive-save").click();
  let plan;
  for (let attempt = 0; attempt < 40; attempt++) {
    const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
    plan = team?.data.plan;
    if (plan?.keeps.length === 2 && plan.keeps.every(({ x }) => x === null)) break;
    await page.waitForTimeout(50);
  }
  assert.equal(plan.keeps.every(({ x, y }) => x === null && y === null), true);
  const map = plan.maps.find(({ id }) => id === plan.activeMapId);
  assert.equal(map.layout.positions.every(({ x, y }) => x === null && y === null), true);
  await page.locator("#map").press("Control+z");
  await page.locator("#drive-save").click();
  await page.locator("#drive-save[disabled]").waitFor();
  await page.keyboard.down("Shift");
  await page.mouse.move(box.x + 2, box.y + 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height - 2, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  assert.equal(await page.locator("#formation-players button.selected").count(), 2);
}
