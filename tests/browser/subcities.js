import assert from "node:assert/strict";
import { mockGoogleDrive } from "../drive-mock.js";

export async function subcities({ browser }) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  try {
    const files = await mockGoogleDrive(context);
    const page = await context.newPage();
    await page.goto("http://127.0.0.1:4174");
    await page.locator("#google-login:not([disabled])").click();
    await page.locator("#project-tab-create").click();
    await page.locator("#project-name").fill("Subcities team");
    await page.locator("[form=project-create]").click();
    await page.locator("#planner").waitFor({ state: "visible" });
    const tabs = await page
      .locator(".workflow-nav > button[data-screen]")
      .evaluateAll((buttons) => buttons.map((button) => button.dataset.screen));
    assert.deepEqual(tabs, ["project", "players", "alts", "subcities", "maps"]);
    await page.locator('[data-screen="subcities"]').click();
    assert.equal(await page.locator("#subcities-screen").isVisible(), true);
    assert.equal(
      await page.locator("#subcities-empty").textContent(),
      "No subcities yet.",
    );
    assert.equal(
      await page.locator("#subcities-search-control").isVisible(),
      true,
    );
    assert.equal(
      await page.locator("#players-search-control").isVisible(),
      false,
    );
    assert.deepEqual(
      await page.locator("#subcities-type option").allTextContents(),
      ["All types", "Culture", "Historic", "Famous"],
    );
    const desktopFilters = await page.evaluate(() =>
      ["subcities-search-control", "subcities-type", "subcities-color"].map(
        (id) => document.getElementById(id).getBoundingClientRect().toJSON(),
      ),
    );
    assert.equal(
      desktopFilters.every((rect) => rect.y === desktopFilters[0].y),
      true,
    );
    assert.equal(desktopFilters[1].width <= 140, true);
    assert.equal(desktopFilters[2].width <= 140, true);
    assert.equal(await page.locator("#subcities-owner").count(), 0);
    assert.equal(await page.locator("#formation-screen").isVisible(), false);
    assert.equal(await page.locator("#players-screen").isVisible(), false);
    await page.locator("#add-subcity").click();
    await page.locator("#subcity-castle").click();
    assert.deepEqual(
      await page.locator("#subcity-filter-type option").allTextContents(),
      [
        "All types",
        "Europe",
        "China",
        "Japan",
        "Korea",
        "America",
        "Russia",
        "Arabia",
        "Historic",
        "Famous",
      ],
    );
    assert.equal(
      await page.locator('[data-subcity-type$="-white"]').count(),
      0,
    );
    assert.equal(
      await page.locator('#subcity-filter-color option[value="white"]').count(),
      0,
    );
    await page.locator("#subcity-filter-type").selectOption("Japan");
    await page.locator("#subcity-filter-color").selectOption("gold");
    await page.locator('[data-subcity-type="subcity-japan-gold"]').click();
    await page.locator("#subcity-x").fill("321");
    await page.locator("#subcity-save").click();
    assert.match(
      await page.locator("#subcity-error").textContent(),
      /both subcity coordinates/,
    );
    await page.locator("#subcity-y").fill("654");
    await page.locator("#subcity-save").click();
    await page.locator("#subcity-dialog").waitFor({ state: "hidden" });
    assert.match(
      await page.locator("#subcities .subcity-card").first().textContent(),
      /Japan.*Gold.*321.*654/,
    );
    for (const id of ["famouscity-1001", "famouscity-10001"]) {
      await page.locator("#add-subcity").click();
      await page.locator("#subcity-castle").click();
      await page
        .locator("#subcity-filter-type")
        .selectOption(id === "famouscity-1001" ? "historic" : "famous");
      assert.equal(
        await page
          .locator(
            `[data-subcity-type="${id === "famouscity-1001" ? "famouscity-10001" : "famouscity-1001"}"]`,
          )
          .count(),
        0,
      );
      assert.equal(
        await page.locator("#subcity-filter-color").isDisabled(),
        true,
      );
      assert.equal(
        await page.locator("#subcity-filter-color").inputValue(),
        "red",
      );
      await page.locator(`[data-subcity-type="${id}"]`).click();
      await page.locator("#subcity-save").click();
      await page.locator("#subcity-dialog").waitFor({ state: "hidden" });
    }
    const cards = page.locator("#subcities .subcity-card");
    assert.equal(await cards.count(), 3);
    await page.locator("#subcities-search").fill("no such city");
    assert.equal(
      await page.locator("#subcities-empty").textContent(),
      "No matching subcities.",
    );
    await page.locator("#subcities-search").fill("");
    assert.match(await cards.nth(1).textContent(), /Rostock/);
    assert.match(await cards.nth(2).textContent(), /Germany Famous City/);
    assert.notEqual(
      await cards.nth(1).locator("img").getAttribute("src"),
      await cards.nth(2).locator("img").getAttribute("src"),
    );
    for (const [type, expected] of [
      ["culture", "Japan"],
      ["historic", "Rostock"],
      ["famous", "Germany Famous City"],
    ]) {
      await page.locator("#subcities-type").selectOption(type);
      assert.equal(await cards.count(), 1);
      assert.match(await cards.first().textContent(), new RegExp(expected));
    }
    await page.locator("#subcities-type").selectOption("");
    await cards.first().click();
    await page.locator("#subcity-castle").click();
    await page.locator("#subcity-search").fill("Japan");
    await page.locator("#subcity-filter-color").selectOption("purple");
    await page.locator('[data-subcity-type="subcity-japan-purple"]').click();
    await page.locator("#subcity-save").click();
    assert.match(await cards.first().textContent(), /Purple/);
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
    assert.equal(team.data.plan.subcities.length, 3);
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileCards = await cards.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().toJSON()),
    );
    assert.equal(mobileCards[0].x, mobileCards[2].x);
    assert.equal(mobileCards[0].y, mobileCards[1].y);
    const mobileFilters = await page.evaluate(() =>
      ["subcities-search-control", "subcities-type", "subcities-color"].map(
        (id) => document.getElementById(id).getBoundingClientRect().toJSON(),
      ),
    );
    assert.equal(mobileFilters[0].y < mobileFilters[1].y, true);
    assert.equal(mobileFilters[1].y, mobileFilters[2].y);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.screenshot({ path: "test-results/subcities-mobile.png" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await cards.last().hover();
    await page.locator("#subcities .subcity-remove").last().click();
    assert.equal(await cards.count(), 2);
    await page.locator("#undo").click();
    assert.equal(await cards.count(), 3);
    await page.locator("#project-back").click();
    team.file.capabilities.canEdit = false;
    await page.locator("#project-list .project-row button").first().click();
    await page.locator("#planner").waitFor({ state: "visible" });
    await page.locator('[data-screen="subcities"]').click();
    assert.equal(await page.locator("#add-subcity").isVisible(), false);
    await cards.first().click();
    assert.equal(await page.locator("#subcity-save").isVisible(), false);
    assert.equal(await page.locator("#subcity-castle").isDisabled(), true);
    assert.equal(await page.locator("#subcity-x").getAttribute("readonly"), "");
    const border = await page
      .locator("#subcity-x")
      .evaluate((field) => getComputedStyle(field).borderTopColor);
    assert.equal(border, "rgba(0, 0, 0, 0)");
  } finally {
    await context.close();
  }
}
