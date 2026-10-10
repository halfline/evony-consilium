import assert from "node:assert/strict";

export async function mapSelection({ page, playersScreen, driveFiles }) {
  await page.locator('[data-screen="maps"]').click();
  await page.locator("#add-map-dialog").waitFor({ state: "visible" });
  assert.equal(await page.locator("#new-formation-name").inputValue(), "Hive");
  await page.locator("#new-formation-type").selectOption("bog");
  assert.equal(await page.locator("#new-formation-name").inputValue(), "Rally");
  await page.locator("#new-formation-name").fill("Temple taking");
  await page.locator("#new-formation-type").selectOption("server");
  assert.equal(
    await page.locator("#new-formation-name").inputValue(),
    "Temple taking",
  );
  await page.locator('#add-map-form button[type="submit"]').click();
  assert.equal(
    await page.locator("#formation-name").textContent(),
    "Temple taking",
  );
  assert.equal(await page.locator("#maps-return-arrow").isVisible(), true);
  assert.equal(await page.locator("#map-back").count(), 0);
  assert.equal(await page.locator("#map-status").count(), 0);
  assert.equal(
    await page
      .locator(".map-toolbar")
      .evaluate((element) => Boolean(element.closest(".workflow-nav"))),
    true,
  );
  await page.locator('[data-screen="maps"]').click();
  await page.locator("#maps-screen").waitFor({ state: "visible" });
  assert.equal(await page.locator("#maps-return-arrow").isVisible(), false);
  assert.equal(await page.locator(".map-toolbar").isVisible(), false);
  assert.equal(await page.locator("#planner").isVisible(), true);
  assert.equal(await page.locator("#maps-list .map-row").count(), 1);
  assert.equal(
    await page.locator("#maps-screen input[type=search]").count(),
    0,
  );
  assert.equal(await page.locator("#saved-map-editor").count(), 0);
  await page
    .locator("#maps-list .map-portrait img")
    .first()
    .evaluate((image) => image.decode());
  assert.match(
    await page
      .locator("#maps-list .map-portrait img")
      .first()
      .getAttribute("src"),
    /map-icons\/server\.webp/,
  );
  const iconBox = await page
    .locator("#maps-list .map-portrait")
    .first()
    .boundingBox();
  const captionBox = await page
    .locator("#maps-list .map-caption")
    .first()
    .boundingBox();
  assert.ok(captionBox.y >= iconBox.y + iconBox.height);
  assert.equal(
    await page
      .locator("#add-map")
      .evaluate((button) => button.parentElement.id),
    "maps-actions",
  );
  assert.equal(await page.locator("#add-map").isVisible(), true);
  assert.match(await page.locator("#add-map").textContent(), /Add map/);
  await page.screenshot({ path: "test-results/maps-screen.png" });
  await page.locator("#maps-list .map-row").first().click();
  await page
    .locator("#formation-screen")
    .waitFor({ state: "visible", timeout: 3000 });
  assert.equal(
    await page.locator("#formation-name").textContent(),
    "Temple taking",
  );
  await page.locator('[data-screen="maps"]').click();
  await page.locator("#maps-list .map-row").first().click();
  await page
    .locator("#formation-screen")
    .waitFor({ state: "visible", timeout: 3000 });
  assert.equal(
    await page.locator("#formation-name").textContent(),
    "Temple taking",
  );
  await page.locator('[data-screen="maps"]').click();
  assert.equal(
    await page.locator("#maps-list .map-row strong").first().textContent(),
    "Temple taking",
  );
  assert.equal(
    await page
      .locator("#maps-list .map-caption > svg")
      .first()
      .getAttribute("aria-hidden"),
    "true",
  );
  await page.locator("#add-map").click();
  await page.locator("#new-formation-type").selectOption("blank");
  await page.locator("#new-formation-name").fill("Temporary");
  await page.locator('#add-map-form button[type="submit"]').click();
  await page.locator('[data-screen="maps"]').click();
  await page.locator(".map-list-row").filter({ hasText: "Temporary" }).hover();
  await page
    .getByRole("button", { name: "Forget Temporary", exact: true })
    .click();
  assert.equal(await page.locator("#maps-list .map-row").count(), 1);
  await page.locator("#undo").click();
  assert.equal(await page.locator("#maps-list .map-row").count(), 2);
  await page.locator(".map-list-row").filter({ hasText: "Temporary" }).hover();
  await page
    .getByRole("button", { name: "Forget Temporary", exact: true })
    .click();
  await playersScreen();
  assert.equal(await page.locator("#export-csv").count(), 0);
  assert.equal(await page.locator("#export-image").count(), 0);

  assert.equal(
    [...driveFiles.values()].filter(
      (r) => r.file.mimeType === "application/vnd.google-apps.folder",
    ).length,
    1,
  );
  assert.ok(
    [...driveFiles.values()].some(
      (r) => r.data?.format === "evony-consilium-team",
    ),
  );

  await page.locator('[data-screen="alts"]').click();
  await page.locator("#add-alt").click();
  await page.locator("#new-player-name").fill("Map list alt");
  await page.locator("#new-player-owner-choice").click();
  await page.locator("#new-player-owner-grid button").first().click();
  await page.locator("#new-player-form [type=submit]").click();
  await page.locator("#add-player-dialog").waitFor({ state: "hidden" });
  await page.locator('[data-screen="maps"]').click();
  await page.locator("#maps-list .map-row").first().click();
  assert.equal(
    await page.locator("#formation-players .players-row").count(),
    2,
  );
  assert.doesNotMatch(
    await page.locator("#formation-players").textContent(),
    /Map list alt/,
  );
  await page.locator('[data-screen="alts"]').click();
  const altTile = page
    .locator("#alts .player-tile")
    .filter({ hasText: "Map list alt" });
  await altTile.hover();
  await altTile.locator(".player-remove").click();
  await playersScreen();
}
