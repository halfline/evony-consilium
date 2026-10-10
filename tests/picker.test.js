import { test } from "node:test";
import assert from "node:assert/strict";
import { DrivePicker } from "../web/src/services/google/picker.js";
import { TEAM_MIME, PLAYER_MIME } from "../web/src/domain/drive-documents.js";

test("picker combines file formats in each location while preserving target filters", async () => {
  const views = [];
  class View {
    setIncludeFolders(value) {
      this.includeFolders = value;
      return this;
    }
    setSelectFolderEnabled(value) {
      this.selectFolders = value;
      return this;
    }
    setLabel(value) {
      this.label = value;
      return this;
    }
    setOwnedByMe(value) {
      this.owned = value;
      return this;
    }
    setParent(value) {
      this.parent = value;
      return this;
    }
    setMimeTypes(value) {
      this.mime = value;
      return this;
    }
    setMode(value) {
      this.mode = value;
      return this;
    }
    setQuery(value) {
      this.query = value;
      return this;
    }
    setEnableDrives(value) {
      this.sharedOnly = value;
      return this;
    }
    setFileIds(value) {
      this.ids = value;
      return this;
    }
  }
  class Builder {
    addView(view) {
      views.push(view);
      return this;
    }
    setOAuthToken() {
      return this;
    }
    setDeveloperKey() {
      return this;
    }
    setAppId() {
      return this;
    }
    setOrigin() {
      return this;
    }
    setTitle() {
      return this;
    }
    setSelectableMimeTypes() {
      return this;
    }
    setMaxItems() {
      return this;
    }
    setCallback(callback) {
      this.callback = callback;
      return this;
    }
    build() {
      return {
        dispose() {},
        setVisible: () =>
          this.callback({
            action: "picked",
            docs: [{ id: views[0].ids || "team" }],
          }),
      };
    }
  }
  const oldGoogle = globalThis.google;
  const oldLocation = globalThis.location;
  globalThis.google = {
    picker: {
      DocsView: View,
      DocsViewMode: { LIST: "list" },
      PickerBuilder: Builder,
      ViewId: { DOCS: "docs" },
      Action: { PICKED: "picked", CANCEL: "cancel" },
    },
  };
  globalThis.location = { origin: "https://example.test" };
  try {
    const picker = new DrivePicker(
      { apiKey: "test", appId: "123" },
      () => "token",
    );
    await picker.folder();
    assert.equal(views.length, 3);
    assert.notEqual(views[0].sharedOnly, true);
    assert.equal(views[1].owned, false);
    assert.equal(views[1].selectFolders, true);
    assert.equal(views[2].sharedOnly, true);
    views.length = 0;
    await picker.folder({ id: "team" });
    assert.equal(views.length, 4);
    assert.equal(views[1].label, "My Drive");
    assert.equal(views[2].owned, false);
    assert.equal(views[3].sharedOnly, true);
    assert.equal(views[0].ids, "team");
    assert.notEqual(views[0].sharedOnly, true);
    views.length = 0;
    await picker.files(null);
    assert.equal(views.length, 3);
    assert.equal(views[1].label, "Shared with me");
    assert.equal(views[1].owned, false);
    assert.equal(views[2].sharedOnly, true);
    assert.ok(
      views.every((view) => view.includeFolders && !view.selectFolders),
    );
    assert.ok(
      views.every(
        (view) =>
          view.mime === `${TEAM_MIME},application/json` &&
          view.query === "team.consilium.json",
      ),
    );
    views.length = 0;
    await picker.files({ id: "shared-folder" });
    assert.equal(views.length, 1);
    assert.equal(views[0].parent, "shared-folder");
    assert.equal(views[0].sharedOnly, undefined);
    views.length = 0;
    await picker.files(null, { id: "shared-file" });
    assert.equal(views.length, 1);
    assert.equal(views[0].ids, "shared-file");
    assert.equal(views[0].query, undefined);
    views.length = 0;
    await picker.player(null, { id: "shared-folder" });
    assert.equal(views.length, 1);
    assert.equal(views[0].label, "Player files");
    assert.equal(views[0].parent, "shared-folder");
    const files = [
      { name: "Existing.player.consilium.json", mimeType: "application/json" },
      { name: "Player - New.player.consilium.json", mimeType: PLAYER_MIME },
      { name: "team.consilium.json", mimeType: "application/json" },
      { name: "settings.json", mimeType: "application/json" },
      { name: "Team - New.team.consilium.json", mimeType: TEAM_MIME },
    ];
    const visible = (view) =>
      files.filter(
        (file) =>
          view.mime.split(",").includes(file.mimeType) &&
          file.name.includes(view.query),
      );
    assert.deepEqual(visible(views[0]), files.slice(0, 2));
    views.length = 0;
    await picker.player();
    assert.equal(views.length, 3);
    for (const view of views)
      assert.deepEqual(visible(view), files.slice(0, 2));
    views.length = 0;
    await picker.files(null);
    for (const view of views)
      assert.deepEqual(visible(view), [files[2], files[4]]);
    views.length = 0;
    await picker.player({ id: "renamed-player" });
    assert.equal(views.length, 1);
    assert.equal(views[0].ids, "renamed-player");
    assert.equal(views[0].mime, `${PLAYER_MIME},application/json`);
    assert.equal(views[0].query, undefined);
  } finally {
    if (oldGoogle === undefined) delete globalThis.google;
    else globalThis.google = oldGoogle;
    if (oldLocation === undefined) delete globalThis.location;
    else globalThis.location = oldLocation;
  }
});
