import assert from "node:assert/strict";
import { mockGoogleDrive } from "../drive-mock.js";

export async function subcityOwnership({ browser }) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  try {
    const files = await mockGoogleDrive(context);
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4174");
    await page.locator("#google-login:not([disabled])").click();
    await page.locator("#project-tab-create").click();
    await page.locator("#project-name").fill("Ownership team");
    await page.locator("[form=project-create]").click();
    await page.locator("#planner").waitFor({ state: "visible" });
    for (const name of ["Alice", "Bob"]) {
      await page.locator('[data-screen="players"]').click();
      if (!(await page.locator("#add-player-dialog").isVisible()))
        await page.locator("#add-player").click();
      await page.locator("#new-player-name").fill(name);
      if (name === "Alice") {
        await page.locator("#new-player-tag").fill("AVN");
        await page.locator("#new-player-account").fill("319846102");
      }
      await page.locator("#new-player-form [type=submit]").click();
      await page.locator("#add-player-dialog").waitFor({ state: "hidden" });
    }
    const sourceProfiles = [...files.values()].filter(
      (record) => record.data?.format === "evony-consilium-player",
    );
    const sourceSnapshot = sourceProfiles.map((record) =>
      JSON.stringify(record.data),
    );
    await page.locator('[data-screen="players"]').click();
    await page.locator("#players .player-card").first().click();
    await page.locator('[data-player-tab="subcities"]').click();
    await page.locator("#player-add-subcity").click();
    assert.equal(
      await page.locator("#assign-subcity-dialog").isVisible(),
      false,
    );
    assert.equal(await page.locator("#subcity-dialog").isVisible(), true);
    assert.equal(
      await page.locator("#subcity-owner-name").textContent(),
      "[AVN] Alice",
    );
    await page.locator("#subcity-castle").click();
    await page.locator("#subcity-filter-color").selectOption("red");
    await page.locator("#subcity-browser-grid button").first().click();
    assert.equal(await page.locator("#subcity-name-field").isVisible(), false);
    await page.locator('[data-close="subcity-dialog"]').click();
    await page.locator('[data-screen="subcities"]').click();
    await page.locator("#add-subcity").click();
    await page.locator("#subcity-name").fill("First city");
    await page.locator("#subcity-owner").click();
    assert.doesNotMatch(
      await page.locator("#subcity-owner-grid").textContent(),
      /319846102/,
    );
    await page.locator("#subcity-owner-search").fill("319846102");
    assert.match(
      await page.locator("#subcity-owner-grid").textContent(),
      /ID 319846102/,
    );
    await page.locator("#subcity-owner-search").fill("Alice");
    assert.doesNotMatch(
      await page.locator("#subcity-owner-grid").textContent(),
      /319846102/,
    );
    assert.equal(await page.locator("#subcity-owner-grid button").count(), 1);
    const alice = await page
      .locator("#subcity-owner-grid button")
      .first()
      .getAttribute("data-owner");
    await page.locator("#subcity-owner-grid button").first().click();
    assert.equal(
      await page.locator("#subcity-owner-name").textContent(),
      "[AVN] Alice",
    );
    await page.locator("#subcity-save").click();
    await page.locator("#add-subcity").click();
    await page.locator("#subcity-name").fill("Second city");
    await page.locator("#subcity-save").click();
    assert.match(
      await page.locator("#subcities .subcity-card").first().textContent(),
      /Alice/,
    );
    await page.locator("#subcities-search").fill("Alice");
    assert.equal(await page.locator("#subcities .subcity-card").count(), 1);
    await page.locator("#subcities-search").fill("AVN");
    assert.equal(await page.locator("#subcities .subcity-card").count(), 1);
    await page.locator("#subcities-search").fill("");
    const openPlayer = async (index) => {
      await page.locator('[data-screen="players"]').click();
      await page.locator("#players .player-card").nth(index).click();
      await page.locator('[data-player-tab="subcities"]').click();
    };
    await openPlayer(0);
    assert.equal(
      await page.locator("#player-subcities .subcity-card").count(),
      1,
    );
    assert.equal(
      await page.locator("#player-profile-actions").isVisible(),
      false,
    );
    await page.locator("#player-add-subcity").click();
    await page.locator("#assign-subcity-list .subcity-card").first().click();
    assert.equal(
      await page.locator("#player-subcities .subcity-card").count(),
      2,
    );
    await page.locator("#player-subcities .subcity-card").first().click();
    await page.locator("#subcity-owner").click();
    await page.locator("#subcity-owner-search").fill("Bob");
    await page.locator("#subcity-owner-grid button").first().click();
    await page.locator("#subcity-save").click();
    assert.equal(
      await page.locator("#player-subcities .subcity-card").count(),
      1,
    );
    await openPlayer(1);
    assert.equal(
      await page.locator("#player-subcities .subcity-card").count(),
      1,
    );
    await page.locator("#player-subcities .subcity-card").first().hover();
    await page.locator("#player-subcities .subcity-remove").first().click();
    assert.equal(
      await page.locator("#player-subcities .subcity-card").count(),
      0,
    );
    await page.locator('[data-screen="subcities"]').click();
    assert.equal(await page.locator("#subcities .subcity-card").count(), 2);
    assert.match(
      await page.locator("#subcities .subcity-card").first().textContent(),
      /Unowned/,
    );
    await openPlayer(0);
    await page.locator("#player-add-subcity").click();
    assert.equal(
      await page
        .locator("#assign-subcity-list > :last-child")
        .getAttribute("id"),
      "player-create-subcity",
    );
    await page.locator("#player-create-subcity").click();
    assert.equal(
      await page.locator("#subcity-owner").getAttribute("data-owner"),
      alice,
    );
    assert.equal(await page.locator("#subcity-owner").isDisabled(), true);
    assert.equal(await page.locator("#subcity-owner-clear").isVisible(), false);
    await page.locator("#subcity-name").fill("New owned city");
    await page.locator("#subcity-save").click();
    assert.equal(
      await page.locator("#player-subcities .subcity-card").count(),
      2,
    );
    // Ownership changes never upload another copy into a player profile file.
    assert.deepEqual(
      sourceProfiles.map((record) => JSON.stringify(record.data)),
      sourceSnapshot,
    );
    await page.locator("#drive-save").click();
    await page.waitForFunction(
      () =>
        document.getElementById("drive-save").disabled &&
        document.getElementById("drive-save").getAttribute("aria-busy") ===
          "false",
    );
    const team = [...files.values()].find(
      (record) => record.data?.format === "evony-consilium-team",
    );
    assert.equal(
      team.data.plan.subcities.filter((city) => city.ownerId === alice).length,
      2,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({ path: "test-results/player-subcities-mobile.png" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator("#project-back").click();
    team.file.capabilities.canEdit = false;
    await page.locator("#project-list .project-row button").first().click();
    await page.locator("#planner").waitFor({ state: "visible" });
    await openPlayer(0);
    assert.equal(
      await page.locator("#player-subcities .subcity-card").count(),
      2,
    );
    assert.equal(await page.locator("#player-add-subcity").isVisible(), false);
    assert.equal(
      await page.locator("#player-subcities .subcity-remove").count(),
      0,
    );
    await page.locator("#player-subcities .subcity-card").first().click();
    assert.equal(await page.locator("#subcity-owner").isDisabled(), true);
    assert.equal(await page.locator("#subcity-save").isVisible(), false);
  } finally {
    await context.close();
  }
}
