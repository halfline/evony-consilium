import assert from "node:assert/strict";

export async function mapLabels({ page, driveFiles }) {
  const checkbox = page.locator("#show-labels");
  assert.equal(await checkbox.isChecked(), true);
  const saved = () => [...driveFiles.values()].find(
    ({ data }) => data?.format === "evony-consilium-team")?.data.plan;
  await checkbox.uncheck();
  await page.locator("#drive-save").click();
  for (let attempt = 0; attempt < 40 && saved()?.labels !== false; attempt++)
    await page.waitForTimeout(50);
  assert.equal(saved().labels, false);
  await checkbox.check();
  await page.locator("#drive-save").click();
  for (let attempt = 0; attempt < 40 && saved()?.labels !== true; attempt++)
    await page.waitForTimeout(50);
  assert.equal(saved().labels, true);
}
