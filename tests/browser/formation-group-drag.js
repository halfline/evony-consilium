import assert from "node:assert/strict";

export async function formationGroupDrag({ page, driveFiles }) {
  const teamFile = () => [...driveFiles.values()].find(
    ({ data }) => data?.format === "evony-consilium-team");
  await page.locator("#drive-save").click();
  await page.locator("#drive-save[disabled]").waitFor();
  for (let attempt = 0; attempt < 40 && teamFile()?.data.plan.keeps.length !== 2; attempt++)
    await page.waitForTimeout(50);
  const before = teamFile().data.plan.keeps.map(({ id, x, y }) => ({ id, x, y }));
  assert.equal(before.length, 2);
  const box = await page.locator("#map").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 30,
    { steps: 8 });
  await page.mouse.up();
  await page.locator("#drive-save").click();
  let plan;
  for (let attempt = 0; attempt < 40; attempt++) {
    plan = teamFile()?.data.plan;
    if (plan?.keeps.every((keep, index) => keep.x !== before[index].x)) break;
    await page.waitForTimeout(50);
  }
  const after = plan.keeps.map(({ x, y }) => ({ x, y }));
  assert.equal(after.length, 2);
  assert.notEqual(after[0].x, before[0].x);
  assert.deepEqual(
    [after[0].x - before[0].x, after[0].y - before[0].y],
    [after[1].x - before[1].x, after[1].y - before[1].y],
  );
  const map = plan.maps.find(({ id }) => id === plan.activeMapId);
  for (const keep of plan.keeps) {
    const position = map.layout.positions.find(({ id }) => id === keep.id);
    assert.deepEqual([position.x, position.y], [keep.x, keep.y]);
  }
}
