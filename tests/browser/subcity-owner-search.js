import assert from "node:assert/strict";

export async function subcityOwnerSearch({ page, driveFiles }) {
  const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
  const player = team.data.plan.keeps[0];
  await page.locator('[data-screen="subcities"]').click();
  await page.locator("#subcities-search").fill(player.name);
  assert.equal(await page.locator("#subcities .subcity-card").count(), 1);
  assert.match(await page.locator("#subcities .subcity-card").first().textContent(), /Created for player/);
  await page.locator("#subcities-search").fill("");
}
