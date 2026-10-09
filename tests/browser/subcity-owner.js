import assert from "node:assert/strict";

export async function subcityOwner({ page, driveFiles }) {
  await page.locator("#subcities .subcity-card").first().click();
  await page.locator("#subcity-dialog").waitFor({ state: "visible" });
  await page.locator("#subcity-owner").click();
  await page.locator("#subcity-owner-dialog").waitFor({ state: "visible" });
  await page.locator("#subcity-owner-grid .subcity-owner-card").first().click();
  await page.locator("#subcity-owner-dialog").waitFor({ state: "hidden" });
  assert.notEqual(await page.locator("#subcity-owner").getAttribute("data-owner"), "");
  await page.locator("#subcity-save").click();
  await page.locator("#subcity-dialog").waitFor({ state: "hidden" });
  await page.locator("#drive-save").click();
  for (let attempt = 0; attempt < 40; attempt++) {
    const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
    if (team?.data.plan.subcities?.[0]?.ownerId) break;
    await page.waitForTimeout(50);
  }
  const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
  assert.equal(team.data.plan.subcities[0].ownerId, team.data.plan.keeps[0].id);
  await page.locator("#subcities .subcity-card").first().click();
  await page.locator("#subcity-owner-clear").click();
  assert.equal(await page.locator("#subcity-owner").getAttribute("data-owner"), "");
  await page.locator("#subcity-save").click();
  await page.locator("#subcity-dialog").waitFor({ state: "hidden" });
  await page.locator("#drive-save").click();
  for (let attempt = 0; attempt < 40; attempt++) {
    const updated = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
    if (updated?.data.plan.subcities?.[0]?.ownerId === null) break;
    await page.waitForTimeout(50);
  }
  const updated = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
  assert.equal(updated.data.plan.subcities[0].ownerId, null);
}
