import assert from "node:assert/strict";

export async function playerCreation({ page, playersScreen }) {
  await page.locator("#add-player-dialog").waitFor({ state: "visible" });
  assert.equal(await page.locator("#new-player-level").inputValue(), "42");
  assert.match(
    await page.locator("#new-player-castle").getAttribute("aria-label"),
    /Japan/,
  );
  assert.equal(await page.locator("#new-player-castle").textContent(), "");
  assert.equal(await page.locator("#new-player-castle img").count(), 1);
  assert.equal(
    await page
      .locator("#new-player-name")
      .evaluate((element) => element === document.activeElement),
    true,
  );
  assert.equal(await page.locator("#new-player-avatar img").count(), 1);
  await page.locator("#new-player-avatar").click();
  assert.equal(await page.locator("#avatar-dialog").isVisible(), true);
  assert.ok((await page.locator("#avatar-grid button").count()) > 100);
  await page.locator("#avatar-category").selectOption("collection");
  assert.ok((await page.locator("#avatar-grid button").count()) > 27);
  assert.deepEqual(
    await page.locator("#avatar-category option").allTextContents(),
    [
      "All avatars",
      "Europe",
      "China",
      "Japan",
      "Korea",
      "America",
      "Russia",
      "Arabia",
      "Collection",
      "General",
    ],
  );
  await page.locator("#avatar-category").selectOption("culture-3");
  assert.equal(await page.locator("#avatar-grid button").count(), 6);
  assert.equal(await page.locator("#avatar-grid strong").count(), 0);
  assert.equal(await page.locator("#avatar-grid").textContent(), "");
  await page.locator("#avatar-category").selectOption("general");
  await page.locator("#avatar-search").fill("Dragon God - Martinus");
  assert.equal(await page.locator("#avatar-grid button").count(), 1);
  await page.locator("#avatar-category").selectOption("collection");
  await page.locator("#avatar-search").fill("Thunder Lord");
  assert.equal(await page.locator("#avatar-grid button").count(), 1);
  await page.screenshot({ path: "test-results/avatar-picker.png" });
  await page.locator('[data-avatar="avatar-1001"]').click();
  assert.match(
    await page.locator("#new-player-avatar").getAttribute("aria-label"),
    /Thunder Lord/,
  );
  await page.locator("#new-player-name").fill("First player");
  await page.locator("#new-player-tag").fill("ONE");
  await page.locator("#new-player-form [type=submit]").click();
  await page.locator("#add-player-dialog").waitFor({ state: "hidden" });
  assert.equal(await page.locator("#player-tag").inputValue(), "ONE");
  assert.match(
    await page.locator("#player-avatar").getAttribute("aria-label"),
    /Thunder Lord/,
  );
  assert.match(
    await page.locator("#players .player-card img").first().getAttribute("src"),
    /avatar-1001/,
  );
  assert.equal(
    await page.locator(".player-heading #player-avatar img").count(),
    1,
  );
  await page.locator("#player-avatar").click();
  await page.locator("#avatar-search").fill("Radiant Goddess");
  await page.locator('[data-avatar="avatar-1002"]').click();
  await page.waitForFunction(() =>
    document
      .getElementById("player-avatar")
      .getAttribute("aria-label")
      .includes("Radiant Goddess"),
  );
  assert.match(
    await page.locator("#player-avatar").getAttribute("aria-label"),
    /Radiant Goddess/,
  );
  await playersScreen();
  await page.locator("#add-player").click();
  assert.doesNotMatch(
    await page.locator("#new-player-avatar").getAttribute("aria-label"),
    /Radiant Goddess|Thunder Lord/,
  );
  assert.equal(await page.locator("#new-player-tag").inputValue(), "ONE");
  await page.locator("#new-player-name").fill("Second player");
  await page.locator("#new-player-tag").fill("TWO");
  await page.locator("#new-player-form [type=submit]").click();
  await page.locator("#add-player-dialog").waitFor({ state: "hidden" });
  assert.equal(await page.locator("#player-tag").inputValue(), "TWO");
  await playersScreen();
  await page.locator("#players .player-card").first().click();
  assert.equal(await page.locator("#player-screen").isVisible(), true);
  assert.equal(await page.locator("#players-screen").isVisible(), false);
  assert.equal(await page.locator("#players-return-arrow").isVisible(), true);
  assert.equal(await page.locator("#player-tag").inputValue(), "ONE");
  assert.equal(
    await page.locator("#players .player-portrait .level").count(),
    2,
  );
  assert.doesNotMatch(
    await page.locator("#players").textContent(),
    /Radiant Goddess/,
  );
  await playersScreen();
  await page.screenshot({ path: "test-results/player-cards.png" });
  const removablePlayer = page
    .locator("#players .player-tile")
    .filter({ hasText: "Second player" });
  await removablePlayer.locator(".player-card").dispatchEvent("pointerdown", {
    pointerType: "touch",
    clientX: 10,
    clientY: 10,
  });
  await page.waitForTimeout(700);
  await removablePlayer
    .locator(".player-card")
    .dispatchEvent("pointerup", { pointerType: "touch" });
  await removablePlayer.locator(".player-card").dispatchEvent("click");
  assert.equal(await page.locator("#players-screen").isVisible(), true);
  await removablePlayer.locator(".player-remove").click();
  assert.equal(await page.locator("#players .player-card").count(), 1);
  await page.locator("#undo").click();
  assert.equal(await page.locator("#players .player-card").count(), 2);
}
