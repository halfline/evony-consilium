import test from "node:test";
import assert from "node:assert/strict";
import { catalog } from "./fixtures/catalog.js";
import {
  castleForLevel,
  castlePickerEntries,
  updateKeepAppearances,
} from "../web/src/domain/castles.js";

test("culture growth selects the lower boundary and leaves manual appearances unchanged", () => {
  const variants = catalog.assets.filter(
    (asset) => asset.family === "culture-japan",
  );
  assert.equal(castleForLevel(variants, 5).tier, 1);
  assert.equal(castleForLevel(variants, 6).tier, 2);
  assert.equal(castleForLevel(variants, 34).tier, 5);
  assert.equal(castleForLevel(variants, 35).tier, 7);
  const manual = { id: "manual", family: "manual", tier: 1 };
  const keeps = [
    { skin: variants[0].id, level: 40 },
    { skin: manual.id, level: 50 },
  ];
  updateKeepAppearances(
    keeps,
    new Map([...variants, manual].map((asset) => [asset.id, asset])),
  );
  assert.equal(keeps[0].skin, variants.at(-1).id);
  assert.equal(keeps[1].skin, manual.id);
});

test("picker separates alternate designs and groups explicit upgrade chains", () => {
  const entries = castlePickerEntries([
    {
      id: "day",
      family: "example",
      name: "Example",
      variantName: "Day",
      tier: 1,
    },
    {
      id: "night",
      family: "example",
      name: "Example",
      variantName: "Night",
      tier: 1,
    },
    {
      id: "base",
      family: "upgrade",
      name: "Upgrade",
      variantName: "Standard",
      tier: 1,
      upgradeGroup: "chain",
    },
    {
      id: "grown",
      family: "upgrade",
      name: "Upgrade",
      variantName: "Grown",
      tier: 2,
      upgradeGroup: "chain",
    },
    ...catalog.assets.filter((asset) => asset.family === "culture-japan"),
  ]);
  assert.deepEqual(
    entries
      .filter((entry) => entry.family === "example")
      .map((entry) => entry.name),
    ["Example – Day", "Example – Night"],
  );
  assert.deepEqual(
    entries
      .find((entry) => entry.id === "chain")
      .variants.map((asset) => asset.id),
    ["base", "grown"],
  );
  assert.equal(
    entries.find((entry) => entry.id === "culture-japan").automatic,
    true,
  );
});
