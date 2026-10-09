import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { verifyAssets } from "../scripts/verify-assets.js";
import { MAP_ICONS } from "../web/src/domain/maps.js";

async function outputFixture(run) {
  const directory = await mkdtemp(join(tmpdir(), "consilium-assets-"));
  const references = [
    ...Object.values(MAP_ICONS),
    ...["ground", "ranged", "mounted", "siege"].map(
      (type) => `assets/troop-icons/${type}.webp`,
    ),
    "assets/example.webp",
  ];
  try {
    for (const src of references) {
      const path = join(directory, src.slice("assets/".length));
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, "authored fixture");
    }
    for (const file of [
      "catalog.json",
      "castle-inventory.json",
      "avatar-catalog.json",
      "terrain/manifest.json",
      "map-icons/manifest.json",
      "troop-icons/manifest.json",
    ]) {
      const path = join(directory, file);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(
        path,
        JSON.stringify({ assets: [{ src: "assets/example.webp" }] }),
      );
    }
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("generated output must contain every referenced image", async () => {
  await outputFixture(async (directory) => {
    await verifyAssets(directory);
    await rm(join(directory, "example.webp"));
    await assert.rejects(
      verifyAssets(directory),
      /Missing generated asset: assets\/example.webp/,
    );
  });
});

test("generated catalogs cannot reference paths outside their output", async () => {
  await outputFixture(async (directory) => {
    await writeFile(
      join(directory, "catalog.json"),
      JSON.stringify({ src: "assets/../../outside.webp" }),
    );
    await assert.rejects(
      verifyAssets(directory),
      /Invalid generated asset reference/,
    );
  });
});
