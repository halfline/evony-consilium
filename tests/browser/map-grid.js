import assert from "node:assert/strict";

export async function mapGrid({ page, driveFiles }) {
  const checkbox = page.locator("#show-grid");
  assert.equal(await checkbox.isChecked(), true);
  await checkbox.uncheck();
  await page.locator("#drive-save").click();
  const saved = () => [...driveFiles.values()].find(
    ({ data }) => data?.format === "evony-consilium-team")?.data.plan;
  for (let attempt = 0; attempt < 40 && saved()?.showGrid !== false; attempt++)
    await page.waitForTimeout(50);
  assert.equal(saved().showGrid, false);
  await checkbox.check();
  await page.locator("#drive-save").click();
  for (let attempt = 0; attempt < 40 && saved()?.showGrid !== true; attempt++)
    await page.waitForTimeout(50);
  assert.equal(saved().showGrid, true);
}
