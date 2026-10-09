import assert from "node:assert/strict";

export async function playerRemove({ page, driveFiles }) {
  await page.locator('[data-screen="players"]').click();
  await page.locator("#add-player").click();
  await page.locator("#new-player-name").fill("Temporary player");
  await page.locator("#new-player-form [type=submit]").click();
  await page.locator("#add-player-dialog").waitFor({ state: "hidden" });
  assert.equal(await page.locator("#players .player-card").count(), 2);
  assert.equal(await page.locator("#player-title").textContent(), "Temporary player");
  assert.equal(await page.locator("#player-remove").getAttribute("aria-label"), "Remove Temporary player");
  await page.locator("#player-title").dispatchEvent("pointerdown", {
    pointerType: "touch",
    clientX: 20,
    clientY: 20,
  });
  await page.waitForTimeout(600);
  assert.equal(await page.locator(".player-name-actions").evaluate(
    (element) => element.classList.contains("player-name-actions-open")), true);
  assert.equal(await page.locator("#player-remove").evaluate(
    (element) => getComputedStyle(element).opacity), "1");
  await page.locator("#player-remove").click();
  assert.equal(await page.locator("#players-screen").isVisible(), true);
  assert.equal(await page.locator("#players .player-card").count(), 1);
  assert.doesNotMatch(await page.locator("#players").textContent(), /Temporary player/);
  await page.locator("#drive-save").click();
  for (let attempt = 0; attempt < 40; attempt++) {
    const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
    if (team?.data?.plan?.keeps?.length === 1) break;
    await page.waitForTimeout(50);
  }
  const team = [...driveFiles.values()].find(({ data }) => data?.format === "evony-consilium-team");
  assert.equal(team.data.plan.keeps.length, 1);
  assert.equal(team.data.plan.keeps[0].name, "Renamed player");
}
