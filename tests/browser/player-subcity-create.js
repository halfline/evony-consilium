import assert from "node:assert/strict";

export async function playerSubcityCreate({ page, driveFiles }) {
  await page.locator("#player-add-subcity").click();
  await page.locator("#assign-subcity-dialog").waitFor({ state: "visible" });
  await page.locator("#player-create-subcity").click();
  await page.locator("#assign-subcity-dialog").waitFor({ state: "hidden" });
  await page.locator("#subcity-dialog").waitFor({ state: "visible" });
  assert.equal(await page.locator("#subcity-owner").isDisabled(), true);
  await page.locator("#subcity-name").fill("Created for player");
  await page.locator("#subcity-save").click();
  await page.locator("#subcity-dialog").waitFor({ state: "hidden" });
  assert.equal(await page.locator("#player-subcities .subcity-card").count(), 1);
  await page.locator("#drive-save").click();
  for (let attempt = 0; attempt < 40; attempt++) {
    const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
    if (team?.data.plan.subcities?.some((city) => city.name === "Created for player")) break;
    await page.waitForTimeout(50);
  }
  const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
  const city = team.data.plan.subcities.find((city) => city.name === "Created for player");
  assert.equal(city.ownerId, team.data.plan.keeps[0].id);
}
