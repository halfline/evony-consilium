import assert from "node:assert/strict";

export async function playerRoster({ page, driveFiles }) {
  await page.locator("#team-players").click();
  assert.equal(await page.locator("#players-screen").isVisible(), true);
  assert.equal(await page.locator("#project-screen").isVisible(), false);
  await page.locator("#add-player").click();
  await page.locator("#add-player-dialog").waitFor({ state: "visible" });
  assert.equal(await page.locator("#new-player-level").inputValue(), "42");
  assert.match(
    await page.locator("#new-player-castle").getAttribute("aria-label"),
    /Japan/,
  );
  await page.locator("#new-player-name").fill("First player");
  await page.locator("#new-player-tag").fill("ONE");
  await page.locator("#new-player-form [type=submit]").click();
  await page.locator("#add-player-dialog").waitFor({ state: "hidden" });
  assert.equal(await page.locator("#player-screen").isVisible(), true);
  assert.equal(await page.locator("#player-title").textContent(), "First player");
  await page.locator('[data-screen="players"]').click();
  assert.equal(await page.locator("#players .player-card").count(), 1);
  assert.equal(
    await page.locator("#players").evaluate((list) => getComputedStyle(list).display),
    "flex",
  );
  assert.match(await page.locator("#players").textContent(), /First player/);
  const playerFiles = [...driveFiles.values()].filter(
    ({ data }) => data?.format === "evony-consilium-player",
  );
  assert.equal(playerFiles.length, 1);
  assert.equal(playerFiles[0].data.profile.name, "First player");
  await page.locator("#drive-save").click();
  await page.locator("#drive-save[disabled]").waitFor();
  let team;
  for (let attempt = 0; attempt < 40; attempt++) {
    team = [...driveFiles.values()].find(
      ({ data }) => data?.format === "evony-consilium-team",
    );
    if (team?.data?.plan?.keeps?.[0]?.playerSource) break;
    await page.waitForTimeout(50);
  }
  assert.equal(team.data.plan.keeps[0].playerSource.fileId, playerFiles[0].file.id);
  await page.locator("#players-search").fill("missing");
  assert.equal(await page.locator("#players .player-card").count(), 0);
  await page.locator("#players-search").fill("First");
  assert.equal(await page.locator("#players .player-card").count(), 1);
}
