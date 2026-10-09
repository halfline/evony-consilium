import assert from "node:assert/strict";

export async function subcityRegistry({ page, driveFiles }) {
  await page.locator('[data-screen="subcities"]').click();
  assert.equal(await page.locator("#subcities-screen").isVisible(), true);
  await page.locator("#add-subcity").click();
  await page.locator("#subcity-dialog").waitFor({ state: "visible" });
  await page.locator("#subcity-castle").click();
  await page.locator("#subcity-browser-dialog").waitFor({ state: "visible" });
  await page.locator('[data-subcity-type="subcity-china-blue"]').click();
  await page.locator("#subcity-browser-dialog").waitFor({ state: "hidden" });
  await page.locator("#subcity-name").fill("First city");
  await page.locator("#subcity-x").fill("0");
  await page.locator("#subcity-y").fill("1199");
  await page.locator("#subcity-save").click();
  await page.locator("#subcity-dialog").waitFor({ state: "hidden" });
  assert.equal(await page.locator("#subcities .subcity-card").count(), 1);
  assert.match(await page.locator("#subcities .subcity-card").textContent(), /First city/);
  await page.locator("#drive-save").click();
  const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
  for (let attempt = 0; attempt < 40; attempt++) {
    if (team.data.plan.subcities?.length === 1) break;
    await page.waitForTimeout(50);
  }
  assert.equal(team.data.plan.subcities[0].x, 0);
  assert.equal(team.data.plan.subcities[0].y, 1199);
  assert.equal(team.data.plan.subcities[0].culture, "China");
  assert.equal(team.data.plan.subcities[0].color, "blue");
  await page.locator("#subcities-search").fill("missing");
  assert.equal(await page.locator("#subcities .subcity-card").count(), 0);
  await page.locator("#subcities-search").fill("First");
  assert.equal(await page.locator("#subcities .subcity-card").count(), 1);
}
