import test from "node:test";
import assert from "node:assert/strict";
import { loadResources } from "../web/src/services/resources.js";

test("player resources load both catalogs without requesting terrain", async () => {
  const original = globalThis.fetch;
  const paths = [];
  globalThis.fetch = async (path) => {
    paths.push(path);
    return { ok: true, json: async () => ({ path }) };
  };
  try {
    const resources = await loadResources();
    assert.deepEqual(paths, ["assets/catalog.json", "assets/avatar-catalog.json"]);
    assert.equal(resources.catalog.path, "assets/catalog.json");
    assert.equal(resources.avatarCatalog.path, "assets/avatar-catalog.json");
  } finally {
    globalThis.fetch = original;
  }
});
