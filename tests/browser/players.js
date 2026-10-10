import assert from "node:assert/strict";

export async function playerCreation({ page, playersScreen }) {
  await playersScreen();
  assert.equal(
    await page.locator("#players-empty").textContent(),
    "No players yet.",
  );
  assert.equal(await page.locator("#players-empty").isVisible(), true);
  await page.locator("#add-player").click();
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
  await page.locator("#add-player-dialog").waitFor({ state: "visible" });
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
  await page.locator("#players-search").fill("ONE");
  assert.equal(await page.locator("#players .player-card").count(), 1);
  assert.match(
    await page.locator("#players .player-card").textContent(),
    /First player/,
  );
  await page.locator("#players-search").fill("");
  await page.locator("#players-search").fill("no such player");
  assert.equal(
    await page.locator("#players-empty").textContent(),
    "No matching players.",
  );
  await page.locator("#players-search").fill("");
  assert.equal(
    await page
      .locator("#add-player")
      .evaluate((button) => button.parentElement.id),
    "players",
  );
  assert.equal(
    await page.locator("#players").evaluate((grid) => grid.lastElementChild.id),
    "add-player",
  );
  for (const width of [390, 392]) {
    await page.setViewportSize({ width, height: 844 });
    const cards = await page
      .locator("#players .player-tile")
      .evaluateAll((tiles) =>
        tiles.map((tile) => tile.getBoundingClientRect().toJSON()),
      );
    assert.equal(cards[0].y, cards[1].y);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "test-results/player-cards.png" });
  await page.locator("#players .player-card").first().focus();
  await page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector("#players .player-remove"))
        .opacity === "1",
  );
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
