import assert from "node:assert/strict";

export async function mapList({ page, driveFiles }) {
  await page.locator('[data-screen="maps"]').click();
  assert.equal(await page.locator("#maps-screen").isVisible(), true);
  await page.locator("#add-map-dialog").waitFor({ state: "visible" });
  await page.locator("#new-formation-name").fill("First hive");
  await page.locator('#add-map-form button[type="submit"]').click();
  await page.locator("#add-map-dialog").waitFor({ state: "hidden" });
  assert.equal(await page.locator("#formation-screen").isVisible(), true);
  assert.equal(await page.locator("#map-name").textContent(), "Server map");
  assert.equal(await page.locator("#map-kicker").textContent(), "Alliance hive");
  await page.locator('[data-screen="maps"]').click();
  assert.equal(await page.locator("#maps-list .map-row").count(), 1);
  await page.locator("#add-map").click();
  await page.locator("#new-formation-type").selectOption("boc");
  await page.locator("#new-formation-name").fill("Battle map");
  await page.locator('#add-map-form button[type="submit"]').click();
  await page.locator("#add-map-dialog").waitFor({ state: "hidden" });
  assert.equal(await page.locator("#map-name").textContent(), "Battle of Constantinople");
  assert.equal(await page.locator("#map-kicker").textContent(), "BoC");
  await page.locator('[data-screen="maps"]').click();
  assert.equal(await page.locator("#maps-list .map-row").count(), 2);
  await page.locator("#drive-save").click();
  await page.waitForFunction(() => document.querySelector("#drive-save")?.disabled);
  for (let attempt = 0; attempt < 40; attempt++) {
    const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
    if (team?.data.plan.maps?.length === 2) break;
    await page.waitForTimeout(50);
  }
  const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
  assert.deepEqual(team.data.plan.maps.map(({ name }) => name), ["First hive", "Battle map"]);
  assert.equal(await page.locator("#drive-save").isDisabled(), true);
}
