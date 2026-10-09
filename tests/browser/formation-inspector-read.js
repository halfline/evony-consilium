import assert from "node:assert/strict";

export async function formationInspectorRead({ page, driveFiles }) {
  const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
  const keep = team.data.plan.keeps[0];
  await page.locator("#inspector").waitFor({ state: "visible" });
  assert.equal(await page.locator("#entity-title").textContent(), keep.name);
  assert.equal(await page.locator("#entity-kind").textContent(), "SELECTED KEEP");
  assert.match(await page.locator("#entity-location").textContent(), /X \d+ · Y \d+/);
  await page.locator("#close-inspector").click();
  assert.equal(await page.locator("#inspector").isHidden(), true);
  assert.equal(await page.locator("#formation-players .players-row.selected").count(), 0);
}
