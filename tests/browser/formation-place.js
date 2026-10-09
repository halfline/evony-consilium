import assert from "node:assert/strict";

export async function formationPlace({ page, driveFiles }) {
  await page.locator('[data-screen="maps"]').click();
  await page.locator("#add-map").click();
  await page.locator("#new-formation-type").selectOption("blank");
  await page.locator("#new-formation-name").fill("Player formation");
  await page.locator('#add-map-form button[type="submit"]').click();
  await page.locator("#add-map-dialog").waitFor({ state: "hidden" });
  const row = page.locator("#formation-players .players-row").first();
  assert.match(await row.textContent(), /Unplaced/);
  await row.click();
  assert.match(await page.locator("#map-guide").textContent(), /Click a free map tile/);
  const box = await page.locator("#map").boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() =>
    /X \d+ · Y \d+/.test(document.querySelector("#formation-players")?.textContent || ""));
  await page.locator("#drive-save").click();
  let placed, position;
  for (let attempt = 0; attempt < 40; attempt++) {
    const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
    placed = team?.data.plan.keeps[0];
    const active = team?.data.plan.maps.find(({ id }) => id === team.data.plan.activeMapId);
    position = active?.layout.positions.find(({ id }) => id === placed?.id);
    if (Number.isInteger(placed?.x) && position?.x === placed.x && position?.y === placed.y) break;
    await page.waitForTimeout(50);
  }
  assert.ok(Number.isInteger(placed.x) && Number.isInteger(placed.y));
  assert.ok(placed.x >= 0 && placed.y >= 0);
  assert.deepEqual([position.x, position.y], [placed.x, placed.y]);
}
