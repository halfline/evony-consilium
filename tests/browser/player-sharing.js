import assert from "node:assert/strict";
import { mockGoogleDrive } from "../drive-mock.js";

export async function playerSharing({ browser }) {
  const admin = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const member = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  try {
    const files = await mockGoogleDrive(admin);
    const a = await admin.newPage();
    await a.goto("http://127.0.0.1:4174");
    await a.locator("#google-login:not([disabled])").click();
    await a.locator("#project-tab-create").click();
    await a.locator("#project-name").fill("Delegation test");
    await a.locator("[form=project-create]").click();
    await a.locator("#planner").waitFor({ state: "visible" });
    await a.locator('[data-screen="players"]').click();
    for (const name of ["Managed account", "Other account"]) {
      if (!(await a.locator("#add-player-dialog").isVisible()))
        await a.locator("#add-player").click();
      await a.locator("#new-player-name").fill(name);
      await a.locator("#new-player-form [type=submit]").click();
      await a.locator("#add-player-dialog").waitFor({ state: "hidden" });
      await a.locator('[data-screen="players"]').click();
    }
    await a.locator("#drive-save").click();
    await a.waitForFunction(
      () =>
        document.getElementById("drive-save").disabled &&
        document.getElementById("drive-save").getAttribute("aria-busy") ===
          "false",
    );
    const team = [...files.values()].find(
      (record) => record.data?.format === "evony-consilium-team",
    );
    const sources = team.data.plan.keeps.map((player) =>
      files.get(player.playerSource.fileId),
    );
    assert.equal(sources.length, 2);
    assert.ok(
      sources.every((source) =>
        source.file.parents.includes(team.file.parents[0]),
      ),
    );
    team.file.capabilities.canEdit = false;
    sources[1].file.capabilities.canEdit = false;
    const grants = new Set();
    await mockGoogleDrive(member, { files, grants });
    const p = await member.newPage();
    await p.goto("http://127.0.0.1:4174");
    await p.locator("#google-login:not([disabled])").click();
    await p
      .locator("#project-url")
      .fill(`https://drive.google.com/file/d/${team.file.id}/view`);
    await p.locator("[form=project-join]").click();
    await p.locator("#planner").waitFor({ state: "visible" });
    assert.deepEqual([...grants], [team.file.id]);
    await p.locator('[data-screen="players"]').click();
    await p.locator("#players .player-card").first().click();
    assert.equal(await p.locator("#player-name").getAttribute("readonly"), "");
    assert.equal(await p.locator("#player-drive-link").isVisible(), true);
    assert.equal(
      await p.locator("#player-drive-link").getAttribute("aria-label"),
      "Open player file and sharing in Drive",
    );
    assert.equal(
      await p.locator(".player-footer #player-drive-link").count(),
      1,
    );
    assert.equal(await p.locator("#player-unlock").isVisible(), true);
    await p.locator("#player-unlock").click();
    await p.waitForFunction(
      () => !document.getElementById("player-name").readOnly,
    );
    assert.equal(grants.has(sources[0].file.id), true);
    assert.equal(grants.has(sources[1].file.id), false);
    const cachedName = team.data.plan.keeps[0].name;
    await p.locator("#player-name").fill("Player changed their profile");
    await p.locator('[data-player-tab="buffs"]').click();
    await p.locator('[data-buff="city.ground.attack"]').fill("1234");
    await p.locator('[data-screen="players"]').click();
    assert.match(
      await p.locator("#players .player-card").first().textContent(),
      /draft unsaved/,
    );
    assert.equal(sources[0].data.profile.name, cachedName);
    assert.equal(await p.locator("#drive-save").isDisabled(), true);
    // Reload restores the form draft, including its original source baseline.
    await p.reload();
    await p.locator("#google-login:not([disabled])").click();
    await p.locator("#planner").waitFor({ state: "visible" });
    await p.locator("#players .player-card").first().click();
    await p.waitForFunction(
      () =>
        document.getElementById("player-name").value ===
          "Player changed their profile" &&
        !document.getElementById("player-name").readOnly,
    );
    await p.locator('[data-player-tab="buffs"]').click();
    assert.equal(
      await p.locator('[data-buff="city.ground.attack"]').inputValue(),
      "1234",
    );
    sources[0].data.profile.allianceTag = "NEW";
    sources[0].file.version = String(Number(sources[0].file.version) + 1);
    await p.locator("#player-form [type=submit]").click();
    await p.waitForFunction(
      () =>
        document.getElementById("player-title").textContent ===
        "Player changed their profile",
    );
    assert.equal(sources[0].data.profile.name, "Player changed their profile");
    assert.equal(sources[0].data.profile.allianceTag, "NEW");
    assert.equal(
      sources[0].data.profile.details.buffs.city.ground.attack,
      1234,
    );
    assert.equal(team.data.plan.keeps[0].name, cachedName);
    assert.equal(await p.locator("#drive-save").isDisabled(), true);
    await p.locator('[data-screen="project"]').click();
    const beforeAccessCheck = await p.evaluate(
      () => (window.__pickerCalls || []).length,
    );
    await p.locator("#team-unlock").click();
    await p.waitForFunction(() =>
      document.getElementById("toast").textContent.includes("still read-only"),
    );
    assert.equal(
      await p.locator("#edit-project-name").getAttribute("readonly"),
      "",
    );
    team.file.capabilities.canEdit = true;
    await p.locator("#team-unlock").click();
    await p.waitForFunction(
      () => !document.getElementById("edit-project-name").readOnly,
    );
    assert.equal(
      await p.evaluate(() => (window.__pickerCalls || []).length),
      beforeAccessCheck,
    );
    await p.locator('[data-screen="players"]').click();
    await p.locator("#players .player-card").last().click();
    assert.equal(await p.locator("#player-name").getAttribute("readonly"), "");
    await p.locator("#player-unlock").click();
    await p.waitForFunction(() =>
      document.getElementById("toast").textContent.includes("still read-only"),
    );
    assert.equal(await p.locator("#player-name").getAttribute("readonly"), "");
    sources[1].file.capabilities.canEdit = true;
    const pickerCalls = await p.evaluate(
      () => (window.__pickerCalls || []).length,
    );
    await p.evaluate(() => window.dispatchEvent(new Event("focus")));
    await p.waitForFunction(
      () => !document.getElementById("player-name").readOnly,
    );
    assert.equal(
      await p.evaluate(() => (window.__pickerCalls || []).length),
      pickerCalls,
    );
    await p.waitForFunction(
      () =>
        document.getElementById("drive-save").disabled &&
        document.getElementById("drive-save").getAttribute("aria-busy") ===
          "false",
    );
    await p.locator("#player-name").fill("Admin cached edit");
    await p.locator("#player-form [type=submit]").click();
    await p.waitForFunction(
      () =>
        document.getElementById("player-title").textContent ===
        "Admin cached edit",
    );
    await p.waitForFunction(
      () =>
        document.getElementById("drive-save").disabled &&
        document.getElementById("drive-save").getAttribute("aria-busy") ===
          "false",
    );
    assert.equal(team.data.plan.keeps[1].name, "Admin cached edit");
    assert.equal(sources[1].data.profile.name, "Admin cached edit");
    sources[1].data.profile.name = "Concurrent player edit";
    sources[1].file.version = String(Number(sources[1].file.version) + 1);
    await p.evaluate(() => window.dispatchEvent(new Event("focus")));
    await p.waitForFunction(
      () =>
        document.getElementById("player-name").value ===
        "Concurrent player edit",
    );
    await p.waitForFunction(
      () =>
        document.getElementById("drive-save").disabled &&
        document.getElementById("drive-save").getAttribute("aria-busy") ===
          "false",
    );
    assert.equal(await p.locator("#player-sync-dialog").isVisible(), false);
    assert.equal(team.data.plan.keeps[1].name, "Concurrent player edit");
    // Background refresh cannot replace a dirty profile form; Discard clears it.
    await p.locator("#player-name").fill("Unsaved player draft");
    sources[1].data.profile.name = "Later source edit";
    sources[1].file.version = String(Number(sources[1].file.version) + 1);
    await p.evaluate(() => window.dispatchEvent(new Event("focus")));
    await p.waitForFunction(
      () =>
        document.getElementById("player-title").textContent ===
        "Later source edit",
    );
    assert.equal(
      await p.locator("#player-name").inputValue(),
      "Unsaved player draft",
    );
    await p.locator("#player-discard-draft").click();
    await p.waitForFunction(
      () =>
        document.getElementById("player-name").value === "Later source edit",
    );
    // A freshly signed-in user whose Drive/app grants already permit the file
    // gets editing automatically, without a local remembered grant or Picker.
    const automatic = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    try {
      team.file.capabilities.canEdit = false;
      await mockGoogleDrive(automatic, {
        files,
        grants: new Set([team.file.id, sources[0].file.id]),
      });
      const auto = await automatic.newPage();
      await auto.goto("http://127.0.0.1:4174");
      await auto.locator("#google-login:not([disabled])").click();
      await auto
        .locator("#project-url")
        .fill(`https://drive.google.com/file/d/${team.file.id}/view`);
      await auto.locator("[form=project-join]").click();
      await auto.locator("#planner").waitFor({ state: "visible" });
      await auto.locator('[data-screen="players"]').click();
      await auto.locator("#players .player-card").first().click();
      await auto.waitForFunction(
        () => !document.getElementById("player-name").readOnly,
      );
      assert.equal(await auto.locator("#player-unlock").isVisible(), false);
      assert.equal(
        await auto.evaluate(() => (window.__pickerCalls || []).length),
        0,
      );
    } finally {
      await automatic.close();
    }
  } finally {
    await member.close();
    await admin.close();
  }
}
