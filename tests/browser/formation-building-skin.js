import assert from "node:assert/strict";

export async function formationBuildingSkin({ page, driveFiles }) {
  await page.locator("#structure-list .players-row").filter({ hasText: "Alliance Castle" }).click();
  await page.locator("#entity-x").fill("");
  await page.locator("#entity-y").fill("");
  await page.locator("#entity-form .apply-entity").click();
  await page.locator("#choose-building-skin").click();
  await page.locator("#catalog-dialog").waitFor({ state: "visible" });
  await page.locator('#catalog-grid [data-asset="map-castle_guild_honour"]').click();
  await page.locator("#drive-save").click();
  let plan;
  for (let attempt = 0; attempt < 40; attempt++) {
    const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
    plan = team?.data.plan;
    if (plan?.structures.some(({ skin }) => skin === "map-castle_guild_honour")) break;
    await page.waitForTimeout(50);
  }
  const structure = plan.structures.find(({ skin }) => skin === "map-castle_guild_honour");
  assert.ok(structure);
  assert.deepEqual([structure.w, structure.h], [4, 4]);
  const map = plan.maps.find(({ id }) => id === plan.activeMapId);
  assert.deepEqual(map.layout.structures.find(({ id }) => id === structure.id), structure);
}
