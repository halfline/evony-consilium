import assert from "node:assert/strict";

export async function mapResetView({ page, driveFiles }) {
  const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
  const leader = team.data.plan.keeps.find(({ id }) => id === team.data.plan.rallyId);
  await page.locator("#reset-view").click();
  assert.equal(await page.locator("#zoom-level").textContent(), "100%");
  const box = await page.locator("#map").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const label = await page.locator("#map-coordinates").textContent();
  const [, x, y] = /^X: (\d+) · Y: (\d+)$/.exec(label);
  assert.ok(Math.abs(Number(x) - leader.x) <= 1);
  assert.ok(Math.abs(Number(y) - leader.y) <= 1);
}
