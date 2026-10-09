import assert from "node:assert/strict";

export async function subcityEdit({ page, driveFiles }) {
  await page.locator("#subcities .subcity-card").first().click();
  await page.locator("#subcity-dialog").waitFor({ state: "visible" });
  assert.equal(await page.locator("#subcity-title").textContent(), "Edit subcity");
  await page.locator("#subcity-name").fill("Edited city");
  await page.locator("#subcity-save").click();
  await page.locator("#subcity-dialog").waitFor({ state: "hidden" });
  await page.locator("#subcities-search").fill("Edited");
  assert.equal(await page.locator("#subcities .subcity-card").count(), 1);
  await page.locator("#drive-save").click();
  for (let attempt = 0; attempt < 40; attempt++) {
    const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
    if (team?.data.plan.subcities?.[0]?.name === "Edited city") break;
    await page.waitForTimeout(50);
  }
  const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
  assert.equal(team.data.plan.subcities[0].name, "Edited city");
}
