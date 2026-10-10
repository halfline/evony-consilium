import { test } from "node:test";
import assert from "node:assert/strict";
import { DrivePicker } from "../web/src/services/google/picker.js";

test("folder browsing includes ordinary Drive and a separate Shared drives view", async () => {
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
    setMimeTypes() {
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
    setCallback(callback) {
      this.callback = callback;
      return this;
    }
    build() {
      return {
        dispose() {},
        setVisible: () =>
          this.callback({ action: "picked", docs: [{ id: "team" }] }),
      };
    }
  }
  const oldGoogle = globalThis.google;
  const oldLocation = globalThis.location;
  globalThis.google = {
    picker: {
      DocsView: View,
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
    views.length = 0;
    await picker.files({ id: "shared-folder" });
    assert.equal(views.length, 1);
    assert.equal(views[0].parent, "shared-folder");
    assert.equal(views[0].sharedOnly, undefined);
    views.length = 0;
    await picker.files(null, { id: "shared-file" });
    assert.equal(views.length, 1);
    assert.equal(views[0].ids, "shared-file");
  } finally {
    if (oldGoogle === undefined) delete globalThis.google;
    else globalThis.google = oldGoogle;
    if (oldLocation === undefined) delete globalThis.location;
    else globalThis.location = oldLocation;
  }
});
