import assert from "node:assert/strict";

export async function altOwnership({ page, playersScreen }) {
  const ids = await page
    .locator("#players .player-card")
    .evaluateAll((cards) => cards.map((card) => card.dataset.entity));
  const altsScreen = () => page.locator('[data-screen="alts"]').click();
  await altsScreen();
  assert.equal(await page.locator("#alts-screen").isVisible(), true);
  assert.equal(
    await page.locator("#alts-list-empty").textContent(),
    "No alts yet.",
  );
  await page.locator("#add-alt").click();
  await page.locator("#add-player-dialog").waitFor({ state: "visible" });
  assert.equal(
    await page.locator("#new-player-title").textContent(),
    "Add alt",
  );
  assert.equal(await page.locator("#import-player-file").isVisible(), false);
  assert.equal(await page.locator("#new-player-level").inputValue(), "35");
  assert.equal(
    await page.locator("#new-player-owner-name").textContent(),
    "Choose player",
  );
  await page.locator("#new-player-name").fill("Test alt");
  await page.locator("#new-player-owner-choice").click();
  await page.locator("#new-player-owner-dialog [data-close]").click();
  await page.locator("#add-player-dialog").waitFor({ state: "visible" });
  assert.equal(await page.locator("#new-player-name").inputValue(), "Test alt");
  await page.locator("#new-player-owner-choice").click();
  await page.locator("#new-player-owner-dialog").waitFor({ state: "visible" });
  await page.locator("#new-player-owner-search").fill("First player");
  assert.equal(await page.locator("#new-player-owner-grid button").count(), 1);
  assert.equal(
    await page.locator("#new-player-owner-grid .player-picker-card").count(),
    1,
  );
  await page.locator("#new-player-owner-grid button").click();
  await page.locator("#add-player-dialog").waitFor({ state: "visible" });
  assert.equal(await page.locator("#new-player-owner").inputValue(), ids[0]);
  assert.equal(
    await page.locator("#new-player-owner-name").textContent(),
    "First player",
  );
  await page.screenshot({ path: "test-results/add-alt-dialog.png" });
  await page.locator("#new-player-form [type=submit]").click();
  await page.locator("#add-player-dialog").waitFor({ state: "hidden" });
  assert.equal(await page.locator("#player-owner").count(), 0);
  assert.doesNotMatch(
    await page.locator("#player-screen").textContent(),
    /emancipat/i,
  );
  assert.equal(await page.locator("#alts-return-arrow").isVisible(), true);
  assert.equal(await page.locator("#players-return-arrow").isVisible(), false);
  for (const tab of ["buffs", "march-size", "rally-capacity", "troops", "alts"])
    assert.equal(
      await page.locator(`[data-player-tab="${tab}"]`).isVisible(),
      false,
    );
  assert.deepEqual(
    await page
      .locator("#player-section-select option:not([hidden])")
      .evaluateAll((options) => options.map((option) => option.value)),
    ["overview", "subcities"],
  );
  assert.match(await page.locator("#player-main").textContent(), /Main player/);
  assert.match(
    await page.locator("#player-main button").textContent(),
    /First player/,
  );
  await page.screenshot({ path: "test-results/alt-overview.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator("#player-main button").isVisible(), true);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({ path: "test-results/alt-overview-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator("#player-main button").click();
  assert.equal(
    await page.locator("#player-title").textContent(),
    "First player",
  );
  assert.equal(
    await page
      .locator('[data-player-tab="overview"]')
      .getAttribute("aria-selected"),
    "true",
  );
  await page.locator('[data-player-tab="alts"]').click();
  assert.equal(
    await page
      .locator('[data-player-tab="alts"]')
      .getAttribute("aria-selected"),
    "true",
  );
  assert.equal(
    await page.locator("#player-profile-actions").isVisible(),
    false,
  );
  assert.match(await page.locator("#player-alts").textContent(), /Test alt/);
  const ownerSaveDisabled = await page.locator("#player-save").isDisabled();
  await page.locator("#player-alts summary").click();
  await page.locator("[data-alt-unlink]").click();
  assert.equal(await page.locator("#player-alts .player-alt-row").count(), 0);
  assert.equal(await page.locator("#player-alts-empty").count(), 0);
  assert.equal(
    (await page.locator("#player-add-alt").textContent()).trim(),
    "Assign player as alt",
  );
  assert.equal(
    await page.locator("#player-save").isDisabled(),
    ownerSaveDisabled,
  );
  await playersScreen();
  assert.equal(await page.locator("#players .player-card").count(), 3);
  await page.locator(`#players [data-entity="${ids[1]}"]`).click();
  await page.locator('[data-player-tab="alts"]').click();
  await page.locator("#player-add-alt").click();
  await page.locator("#assign-alt-dialog").waitFor({ state: "visible" });
  assert.equal(await page.locator("#assign-alt-confirm").isDisabled(), true);
  assert.equal(
    await page.locator(`#assign-alt-list [data-player="${ids[1]}"]`).count(),
    0,
  );
  await page.locator("#assign-alt-search").fill("Test alt");
  assert.equal(await page.locator("#assign-alt-list button").count(), 1);
  assert.equal(
    await page.locator("#assign-alt-list .player-picker-card").count(),
    1,
  );
  await page.locator("#assign-alt-list button").click();
  assert.equal(
    await page.locator("#assign-alt-list button").getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(await page.locator("#assign-alt-help").textContent(), "");
  assert.equal(
    (await page.locator("#assign-alt-confirm").textContent()).trim(),
    "Add alt",
  );
  // Choosing an account does not change the roster until explicitly confirmed.
  await page.locator("#assign-alt-dialog [data-close]").first().click();
  await playersScreen();
  assert.equal(await page.locator("#players .player-card").count(), 3);
  await page.locator(`#players [data-entity="${ids[1]}"]`).click();
  await page.locator('[data-player-tab="alts"]').click();
  await page.locator("#player-add-alt").click();
  await page.locator("#assign-alt-search").fill("Test alt");
  await page.locator("#assign-alt-list button").click();
  await page.locator("#assign-alt-confirm").click();
  await page.locator("#assign-alt-dialog").waitFor({ state: "hidden" });
  assert.equal(await page.locator("#player-alts .player-alt-row").count(), 1);
  assert.equal(await page.locator("#player-save").isDisabled(), true);
  const altRow = await page
    .locator("#player-alts .player-alt-row")
    .boundingBox();
  const altPanel = await page.locator("#player-alts").boundingBox();
  const altMenu = await page.locator("#player-alts summary").boundingBox();
  assert.ok(
    altRow.width <= altPanel.width / 2,
    "Desktop alts use compact columns",
  );
  assert.ok(
    altMenu.x + altMenu.width < altRow.x + altRow.width,
    "Alt action stays inside its row",
  );
  await page.screenshot({ path: "test-results/player-alts.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  const mobileAlt = await page
    .locator("#player-alts .player-alt-row")
    .boundingBox();
  const mobilePanel = await page.locator("#player-alts").boundingBox();
  assert.ok(
    Math.abs(mobileAlt.width - mobilePanel.width) < 1,
    "Phone alts use full-width rows",
  );
  await page.screenshot({ path: "test-results/player-alts-mobile.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await altsScreen();
  const altLayout = await page
    .locator("#alts .player-card")
    .evaluate((card) => {
      const portrait = card
        .querySelector(".player-portrait")
        .getBoundingClientRect();
      const identity = card
        .querySelector(".player-identity")
        .getBoundingClientRect();
      const bounds = card.getBoundingClientRect();
      return {
        portraitAboveIdentity: portrait.bottom <= identity.top,
        identityWithinCard:
          identity.left >= bounds.left && identity.right <= bounds.right,
      };
    });
  assert.deepEqual(altLayout, {
    portraitAboveIdentity: true,
    identityWithinCard: true,
  });
  assert.match(
    await page.locator("#alts .player-card").textContent(),
    /Owner: Second player/,
  );
  await page.locator("#alts-search").fill("First player");
  assert.equal(await page.locator("#alts .player-card").count(), 0);
  assert.equal(
    await page.locator("#alts-list-empty").textContent(),
    "No matching alts.",
  );
  await page.locator("#alts-search").fill("Second player");
  assert.equal(await page.locator("#alts .player-card").count(), 1);
  await page.locator("#alts-search").fill("");
  await page.locator("#alts .player-card").click();
  await page.locator("#player-main button").click();
  await page.locator('[data-player-tab="alts"]').click();
  await page.locator("#player-alts summary").click();
  await page.locator("[data-alt-unlink]").click();
  await playersScreen();
  assert.equal(await page.locator("#players .player-card").count(), 3);
  await page.locator(`#players [data-entity="${ids[0]}"]`).click();
  await page.locator('[data-player-tab="alts"]').click();
  await page.locator("#player-add-alt").click();
  await page.locator("#assign-alt-search").fill("Test alt");
  await page.locator("#assign-alt-list button").click();
  await page.locator("#assign-alt-confirm").click();
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
