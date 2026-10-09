import assert from "node:assert/strict";

export async function formationDrag({ page, driveFiles }) {
  const teamFile = () => [...driveFiles.values()].find(
    ({ data }) => data?.format === "evony-consilium-team");
  const before = teamFile().data.plan.keeps[0];
  const origin = [before.x, before.y];
  const box = await page.locator("#map").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 50,
    { steps: 8 });
  await page.mouse.up();
  await page.locator("#drive-save").click();
  let moved, position;
  for (let attempt = 0; attempt < 40; attempt++) {
    const plan = teamFile()?.data.plan;
    moved = plan?.keeps[0];
    const map = plan?.maps.find(({ id }) => id === plan.activeMapId);
    position = map?.layout.positions.find(({ id }) => id === moved?.id);
    if (moved && (moved.x !== origin[0] || moved.y !== origin[1]) &&
      position?.x === moved.x && position?.y === moved.y) break;
    await page.waitForTimeout(50);
  }
  assert.notDeepEqual([moved.x, moved.y], origin);
  assert.deepEqual([position.x, position.y], [moved.x, moved.y]);
}
