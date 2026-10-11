import assert from "node:assert/strict";
import { mockGoogleDrive } from "../drive-mock.js";
import { syncTeam } from "../../apps-script/sync.js";

// Change real source documents with all app sessions closed, then open a
// reader who has only the team-file Picker grant, never source grants.
export async function unattendedSync({
  browser,
  base = "http://127.0.0.1:4174",
}) {
  const editor = await browser.newContext(),
    reader = await browser.newContext();
  const errors = [];
  try {
    const files = await mockGoogleDrive(editor, {
      account: { sub: "admin", email: "admin@example.test" },
    });
    const a = await editor.newPage();
    a.on("pageerror", (error) => errors.push(error.message));
    await a.goto(base);
    await a.locator("#google-login:not([disabled])").click();
    await a.locator("#project-tab-create").click();
    await a.locator("#project-name").fill("Unattended team");
    await a.locator("[form=project-create]").click();
    await a.locator("#planner").waitFor({ state: "visible" });
    await a.locator('[data-screen="players"]').click();
    await a.locator("#add-player").click();
    await a.locator("#new-player-name").fill("Before background sync");
    await a.locator("#new-player-form [type=submit]").click();
    await a.locator("#add-player-dialog").waitFor({ state: "hidden" });
    await a.waitForFunction(
      () =>
        document.getElementById("drive-save").disabled &&
        document.getElementById("drive-save").getAttribute("aria-busy") ===
          "false",
    );
    await a.locator('[data-player-tab="notes"]').click();
    await a.locator("#note-new").click();
    await a.locator("#note-title").fill("Shared plan");
    await a.locator("#note-body").fill("Before unattended publication");
    await a.locator("#note-audience").selectOption("team");
    await a.locator("#note-save").click();
    await a.waitForFunction(() =>
      document
        .getElementById("note-save-status")
        .textContent.includes("Team copy refreshed"),
    );
    const team = [...files.values()].find(
        (row) => row.data?.format === "evony-consilium-team",
      ),
      profile = [...files.values()].find(
        (row) => row.data?.format === "evony-consilium-player",
      ),
      note = [...files.values()].find(
        (row) => row.data?.format === "evony-consilium-note",
      );
    await editor.close();
    profile.data.profile.name = "After background sync";
    profile.file.version = String(BigInt(profile.file.version) + 1n);
    note.data.note.body = "Updated while every app session was closed";
    note.file.version = String(BigInt(note.file.version) + 1n);
    const folderId = team.file.parents[0];
    const drive = {
      metadata: ({ id }) => structuredClone(files.get(id).file),
      children: () =>
        [...files.values()].map((row) => structuredClone(row.file)),
      load: ({ id }) => ({
        file: structuredClone(files.get(id).file),
        document: structuredClone(files.get(id).data),
      }),
      save: (file, document) => {
        assert.equal(file.version, team.file.version);
        team.data = structuredClone(document);
        team.file.version = String(BigInt(team.file.version) + 1n);
      },
    };
    const report = syncTeam({
      drive,
      config: { teamFileId: team.file.id, folderId },
    });
    assert.equal(report.players, 1);
    assert.equal(report.notes, 1);
    assert.equal(report.written, true);
    const grants = new Set([team.file.id]);
    await mockGoogleDrive(reader, {
      files,
      grants,
      account: { sub: "reader", email: "reader@example.test" },
      access: new Map([[team.file.id, { canEdit: false }]]),
    });
    const b = await reader.newPage();
    b.on("pageerror", (error) => errors.push(error.message));
    await b.goto(
      `${base}/#team=${team.file.id}&screen=player&player=${team.data.plan.keeps[0].id}&section=overview`,
    );
    await b.locator("#google-login:not([disabled])").click();
    await b.locator("#planner").waitFor({ state: "visible" });
    assert.equal(
      await b.locator("#player-name").inputValue(),
      "After background sync",
    );
    assert.equal(await b.locator("#player-name").getAttribute("readonly"), "");
    await b.locator('[data-player-tab="notes"]').click();
    await b.locator(`[data-note-id="${note.file.id}"]`).click();
    assert.equal(
      await b.locator("#note-body").inputValue(),
      "Updated while every app session was closed",
    );
    assert.equal(await b.locator("#note-body").getAttribute("readonly"), "");
    assert.equal(grants.has(profile.file.id), false);
    assert.equal(grants.has(note.file.id), false);
    assert.equal(
      await b.evaluate(() => (window.__pickerCalls || []).length),
      0,
    );
    assert.deepEqual(errors, []);
  } finally {
    await editor.close();
    await reader.close();
  }
}
