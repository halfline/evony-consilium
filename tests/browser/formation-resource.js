import assert from "node:assert/strict";

export async function formationResource({ page, driveFiles }) {
  await page.locator('[data-building="resource"]').click();
  await page.locator("#catalog-dialog").waitFor({ state: "visible" });
  assert.match(await page.locator("#catalog-title").textContent(), /resource sprite/i);
  await page.locator('#catalog-grid [data-asset="map-world_food_guild"]').click();
  assert.match(await page.locator("#structure-list .players-row").filter({ hasText: "World Food Guild" }).textContent(),
    /Unplaced/);
  await page.locator("#drive-save").click();
  let plan;
  for (let attempt = 0; attempt < 40; attempt++) {
    const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
    plan = team?.data.plan;
    if (plan?.structures.some(({ skin }) => skin === "map-world_food_guild")) break;
    await page.waitForTimeout(50);
  }
  assert.equal(plan.structures.find(({ skin }) => skin === "map-world_food_guild")?.x, null);
}
