import assert from "node:assert/strict";

export async function formationCancelNavigation({ page, driveFiles }) {
  const row = page.locator("#formation-players button").first();
  await row.click();
  let box = await page.locator("#map").boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await row.click();
  const before = await row.textContent();
  box = await page.locator("#map").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 50,
    { steps: 8 });
  await page.locator('[data-screen="players"]').evaluate((button) => button.click());
  await page.mouse.up();
  await page.locator('[data-screen="maps"]').click();
  await page.locator("#maps-list .map-row").filter({ hasText: "Player formation" }).click();
  assert.equal(await page.locator("#formation-players button").first().textContent(), before);
  await page.locator("#drive-save").click();
  let plan;
  for (let attempt = 0; attempt < 40; attempt++) {
    const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
    plan = team?.data.plan;
    if (Number.isInteger(plan?.keeps[0]?.x)) break;
    await page.waitForTimeout(50);
  }
  const map = plan.maps.find(({ id }) => id === plan.activeMapId);
  assert.deepEqual([map.layout.positions[0].x, map.layout.positions[0].y],
    [plan.keeps[0].x, plan.keeps[0].y]);
}
