import assert from "node:assert/strict";

export async function altOwnership({ page, playersScreen }) {
  const ids = await page
    .locator("#players .player-card")
    .evaluateAll((cards) => cards.map((card) => card.dataset.entity));
  const altsScreen = () => page.locator('[data-screen="alts"]').click();
  await altsScreen();
  assert.equal(await page.locator("#alts-screen").isVisible(), true);
  await page.locator("#add-alt").click();
  await page.locator("#add-player-dialog").waitFor({ state: "visible" });
  assert.equal(
    await page.locator("#new-player-title").textContent(),
    "Add alt",
  );
  await page.locator("#new-player-owner").selectOption(ids[0]);
  await page.locator("#new-player-name").fill("Test alt");
  await page.locator("#new-player-form [type=submit]").click();
  await page.locator("#add-player-dialog").waitFor({ state: "hidden" });
  assert.equal(await page.locator("#player-owner").inputValue(), ids[0]);
  assert.equal(await page.locator("#alts-return-arrow").isVisible(), true);
  assert.equal(await page.locator("#players-return-arrow").isVisible(), false);
  await page.locator("#player-owner").selectOption(ids[1]);
  await altsScreen();
  assert.match(
    await page.locator("#alts .player-card").textContent(),
    /Owner: Second player/,
  );
  await page.locator("#alts-search").fill("First player");
  assert.equal(await page.locator("#alts .player-card").count(), 0);
  await page.locator("#alts-search").fill("Second player");
  assert.equal(await page.locator("#alts .player-card").count(), 1);
  await page.locator("#alts-search").fill("");
  await page.locator("#alts .player-card").click();
  await page.locator("#player-owner").selectOption("");
  assert.equal(await page.locator("#players-return-arrow").isVisible(), true);
  await playersScreen();
  assert.equal(await page.locator("#players .player-card").count(), 3);
  await page
    .locator("#players .player-card")
    .filter({ hasText: "Test alt" })
    .click();
  await page.locator("#player-owner").selectOption(ids[0]);
  await altsScreen();
  const tile = page
    .locator("#alts .player-tile")
    .filter({ hasText: "Test alt" });
  await tile.hover();
  await tile.locator(".player-remove").click();
  assert.equal(await page.locator("#alts .player-card").count(), 0);
  await playersScreen();
  assert.equal(await page.locator("#players .player-card").count(), 2);
}
