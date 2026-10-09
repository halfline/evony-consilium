import assert from "node:assert/strict";

export async function formationAllianceBuilding({ page, driveFiles }) {
  for (const [kind, file] of [
    ["alliance", "map-world_castle_guild.webp"],
    ["warehouse", "map-world_warehouse_guild.webp"],
    ["resource", "map-world_food_guild.webp"],
    ["objective", "map-battlefield-knighthall.webp"],
  ]) {
    const portrait = page.locator(`[data-building="${kind}"] .building-portrait img`);
    assert.equal(await portrait.getAttribute("alt"), "");
    assert.ok((await portrait.getAttribute("src")).endsWith(file));
  }
  await page.locator('[data-building="alliance"]').click();
  await page.locator("#catalog-dialog").waitFor({ state: "visible" });
  await page.locator('#catalog-grid [data-asset="map-world_castle_guild"]').click();
  const row = page.locator("#structure-list .players-row").filter({ hasText: "Alliance Castle" });
  assert.match(await row.textContent(), /Unplaced/);
  const box = await page.locator("#map").boundingBox();
  for (const [dx, dy] of [[-200, -100], [-240, 80], [0, -180], [100, -180],
    [-180, 120], [220, -100]]) {
    await page.mouse.click(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy);
    if (!(await row.textContent()).includes("Unplaced")) break;
  }
  assert.doesNotMatch(await row.textContent(), /Unplaced/);
  await page.locator("#drive-save").click();
  let plan;
  for (let attempt = 0; attempt < 40; attempt++) {
    const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
    plan = team?.data.plan;
    if (Number.isInteger(plan?.structures[0]?.x)) break;
    await page.waitForTimeout(50);
  }
  assert.equal(plan.structures[0].skin, "map-world_castle_guild");
  const map = plan.maps.find(({ id }) => id === plan.activeMapId);
  assert.deepEqual(map.layout.structures, plan.structures);
}
