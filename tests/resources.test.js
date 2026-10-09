import test from "node:test";
import assert from "node:assert/strict";
import { loadResources } from "../web/src/services/resources.js";

test("planner resources load player catalogs and decoded map terrain", async () => {
  const original = globalThis.fetch;
  const paths = [];
  globalThis.fetch = async (path) => {
    paths.push(path);
    if (path === "assets/terrain/manifest.json")
      return { ok: true, json: async () => ({ maps: {
        tiny: {
          src: "assets/terrain/tiny.bin", width: 1, height: 1,
          extent: 1, blockedOffset: 1,
          layers: [{ name: "surface", offset: 0 }], landmarks: [],
        },
      } }) };
    if (path === "assets/terrain/tiny.bin")
      return { ok: true, arrayBuffer: async () => Uint8Array.of(7, 0).buffer };
    return { ok: true, json: async () => ({ path }) };
  };
  try {
    const resources = await loadResources();
    assert.deepEqual(paths, [
      "assets/catalog.json", "assets/avatar-catalog.json",
      "assets/terrain/manifest.json", "assets/terrain/tiny.bin",
    ]);
    assert.equal(resources.catalog.path, "assets/catalog.json");
    assert.equal(resources.avatarCatalog.path, "assets/avatar-catalog.json");
    assert.equal(resources.terrain.get("tiny").layers[0].tiles[0], 7);
  } finally {
    globalThis.fetch = original;
  }
});
