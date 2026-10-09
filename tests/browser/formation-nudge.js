import assert from "node:assert/strict";

export async function formationNudge({ page, driveFiles }) {
  const row = page.locator("#formation-players button").first();
  await row.click();
  const box = await page.locator("#map").boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const before = await row.textContent();
  await row.click();
  await page.locator("#map").press("ArrowRight");
  assert.notEqual(await row.textContent(), before);
  await page.locator("#drive-save").click();
  let plan, position;
  for (let attempt = 0; attempt < 40; attempt++) {
    const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
    plan = team?.data.plan;
    const map = plan?.maps.find(({ id }) => id === plan.activeMapId);
    position = map?.layout.positions[0];
    if (Number.isInteger(position?.x) && position.x === plan.keeps[0].x) break;
    await page.waitForTimeout(50);
  }
  assert.deepEqual([position.x, position.y], [plan.keeps[0].x, plan.keeps[0].y]);
}
