import test from "node:test";
import assert from "node:assert/strict";
import { TerrainCatalog } from "../web/src/domain/terrain.js";

test("terrain catalogs remain independent across resource loads", () => {
  const manifest = {
    maps: {
      tiny: {
        width: 1,
        height: 1,
        extent: 1,
        blockedOffset: 1,
        layers: [{ name: "surface", offset: 0 }],
        landmarks: [],
      },
    },
  };
  const first = new TerrainCatalog(
    manifest,
    new Map([["tiny", Uint8Array.of(2, 0).buffer]]),
  );
  const second = new TerrainCatalog(
    manifest,
    new Map([["tiny", Uint8Array.of(3, 1).buffer]]),
  );
  manifest.maps.tiny.extent = 7;
  assert.equal(first.get("tiny").layers[0].tiles[0], 2);
  assert.equal(second.get("tiny").layers[0].tiles[0], 3);
  assert.equal(first.get("tiny").extent, 1);
  assert.equal(first.get("tiny").blocked[0], 0);
  assert.equal(second.get("tiny").blocked[0], 1);
  assert.throws(() => new TerrainCatalog(manifest, new Map()), /Invalid terrain data/);
});
