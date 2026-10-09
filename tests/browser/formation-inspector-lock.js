import assert from "node:assert/strict";

export async function formationInspectorLock({ page, driveFiles }) {
  const checkbox = page.locator("#entity-locked");
  assert.equal(await checkbox.isChecked(), false);
  await checkbox.check();
  await page.locator("#entity-form .apply-entity").click();
  await page.locator("#drive-save").click();
  const saved = () => [...driveFiles.values()].find(
    ({ data }) => data?.format === "evony-consilium-team")?.data.plan;
  for (let attempt = 0; attempt < 40 && !saved()?.keeps[0]?.locked; attempt++)
    await page.waitForTimeout(50);
  let plan = saved();
  assert.equal(plan.keeps[0].locked, true);
  let map = plan.maps.find(({ id }) => id === plan.activeMapId);
  assert.equal(map.layout.positions.find(({ id }) => id === plan.keeps[0].id).locked, true);
  await checkbox.uncheck();
  await page.locator("#entity-form .apply-entity").click();
  await page.locator("#drive-save").click();
  for (let attempt = 0; attempt < 40 && saved()?.keeps[0]?.locked; attempt++)
    await page.waitForTimeout(50);
  plan = saved();
  assert.equal(plan.keeps[0].locked, false);
  map = plan.maps.find(({ id }) => id === plan.activeMapId);
  assert.equal(map.layout.positions.find(({ id }) => id === plan.keeps[0].id).locked, false);
}
