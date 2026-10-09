import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { assetURL } from "./paths.js";
import test from "node:test";
import {
  castlePickerEntries,
  castleForLevel,
  updateKeepAppearances,
} from "../../web/src/domain/castles.js";

const catalog = JSON.parse(await readFile(assetURL("assets/catalog.json")));
const inventory = JSON.parse(
  await readFile(assetURL("assets/castle-inventory.json")),
);
const assets = new Map(catalog.assets.map((a) => [a.id, a]));
const visible = catalog.assets.filter((a) => !a.legacyOnly);
const entries = castlePickerEntries(visible);

test("the source inventory is represented, including explicitly unavailable historical variants", async () => {
  assert.equal(
    new Set(inventory.filter((r) => r.kind === "keep").map((r) => r.gameId))
      .size,
    220,
  );
  assert.equal(
    new Set(inventory.filter((r) => r.kind === "alliance").map((r) => r.gameId))
      .size,
    9,
  );
  assert.equal(assets.size, catalog.assets.length);
  for (const record of inventory) {
    const asset = assets.get(record.asset);
    assert.ok(asset, `${record.name}: missing catalog entry`);
    assert.ok(!asset.legacyOnly, `${record.name}: hidden current entry`);
    assert.ok(asset.gameIds.includes(record.gameId));
    assert.equal(!!asset.unavailable, record.status === "missing");
  }
  await Promise.all(visible.map((a) => access(assetURL(a.src))));
});

test("named upgrades and alternate designs share one family", () => {
  const expected = new Map([
    ["Thebes", ["Throne", "Imperium", "Divinity"]],
    ["Silver Wonder", ["Snowfall", "Blossom"]],
    ["Verona", ["Dawn", "Night"]],
    ["Arcanum Athenaeum", ["Standard", "Neophyte", "Mage", "Archmage"]],
    [
      "Shushan Peak",
      ["Standard", "Monster Queller", "Fiend Purger", "Celestials Vanquisher"],
    ],
    ["Atlantis", ["Standard", "Oracle"]],
    ["Rhodes", ["Standard", "Sacred Radiance"]],
  ]);
  for (const [name, names] of expected) {
    const matches = visible.filter((asset) => asset.name === name);
    assert.equal(new Set(matches.map((asset) => asset.family)).size, 1, name);
    assert.deepEqual(
      new Set(matches.map((a) => a.variantName)),
      new Set(names),
    );
    assert.ok(matches.every((a) => !a.unavailable));
  }
  assert.ok(entries.some((f) => f.name === "Desert Palace"));
  assert.ok(entries.some((f) => f.name === "Fortress Pyramid"));
  assert.deepEqual(
    entries.find((f) => f.name === "Thebes").variants.map((a) => a.tier),
    [1, 2, 3],
  );
});

test("castle filters use the client's categories and source assignments", () => {
  assert.deepEqual(
    catalog.keepCategories.map((c) => [c.gameCategory, c.name]),
    [
      [undefined, "Culture"],
      [1, "Activity"],
      [2, "Collection"],
      [3, "Excellent"],
      [4, "Champion"],
    ],
  );
  const categories = new Map(
    catalog.keepCategories.map((c) => [c.gameCategory, c.id]),
  );
  for (const record of inventory.filter((r) => r.kind === "keep")) {
    assert.ok(
      assets
        .get(record.asset)
        .categories.includes(categories.get(record.gameCategory)),
      record.name,
    );
  }
  for (const a of visible.filter((a) => a.kind === "keep"))
    assert.ok(a.categories.length, a.name);
  for (const family of entries.filter((f) => f.id.startsWith("culture-"))) {
    for (const asset of family.variants)
      assert.deepEqual(asset.categories, ["culture"]);
  }
  for (const [name, category] of [
    ["Golden Castle", "activity"],
    ["Thebes", "collection"],
    ["Verona", "excellent"],
    ["Silver Wonder", "excellent"],
    ["Shushan Peak", "champion"],
    ["Arcanum Athenaeum", "champion"],
  ]) {
    assert.ok(
      visible
        .filter((asset) => asset.name === name)
        .every((a) => a.categories.includes(category)),
      name,
    );
  }
});

test("all Chalons alliance glory skins are searchable and grouped", () => {
  const glory = visible.filter(
    (a) =>
      a.kind === "alliance" &&
      a.aliases?.includes("Chalons Alliance Glory Castle"),
  );
  assert.equal(glory.length, 9);
  assert.equal(new Set(glory.map((asset) => asset.family)).size, 7);
  assert.ok(
    visible.some((a) => a.kind === "alliance" && a.name === "Alliance Castle"),
  );
});

test("battlefield footprints come from the configured occupied grid size", () => {
  for (const [id, size] of [
    ["knighthall", 3],
    ["portal", 3],
    ["medicalhall", 3],
    ["blesstower", 3],
    ["tower", 3],
    ["assemblyhall", 3],
    ["crystal", 3],
    ["maincity", 5],
  ]) {
    const asset = assets.get("map-battlefield-" + id);
    assert.equal(asset.footprint, size, id);
    assert.equal(asset.footprintSource, "BattlefieldConfig.range");
  }
});

test("each culture follows keep-level boundaries without offering growth tiers", () => {
  const culture = entries.filter((f) => f.id.startsWith("culture-"));
  assert.equal(culture.length, 7);
  const boundaries = [
    [1, 1],
    [5, 1],
    [6, 2],
    [10, 2],
    [11, 3],
    [15, 3],
    [16, 4],
    [20, 4],
    [21, 5],
    [34, 5],
    [35, 7],
    [39, 7],
    [40, 8],
    [50, 8],
  ];
  for (const family of culture) {
    assert.equal(family.automatic, true);
    assert.ok(family.variants.every((a) => a.tier !== 6));
    for (const [level, tier] of boundaries)
      assert.equal(
        castleForLevel(family.variants, level).tier,
        tier,
        `${family.name} K${level}`,
      );
  }
  const keeps = [
    { skin: castleForLevel(culture[0].variants, 1).id, level: 40 },
    {
      skin: entries.find((f) => f.name === "Thebes").variants[2].id,
      level: 1,
    },
  ];
  const manual = keeps[1].skin;
  updateKeepAppearances(keeps, assets);
  assert.equal(assets.get(keeps[0].skin).tier, 8);
  assert.equal(keeps[1].skin, manual);
});

test("server landmarks include the Throne, towers, catapults, temples and altar variants", async () => {
  const server = catalog.assets.filter((a) => a.mapContext === "server");
  assert.equal(server.length, 21);
  assert.equal(catalog.serverAudit.missingRecords, 0);
  for (const a of server) {
    assert.equal(a.unavailable, undefined);
    await access(assetURL(a.src));
  }
  assert.equal(server.find((a) => a.id === "map-kingdom").footprint, 5);
  for (const id of [
    "samuraitower",
    "wizardtower",
    "mangonelleft",
    "mangonelright",
    "fireshrin",
    "harvestshrin",
    "huntingshrin",
  ])
    assert.equal(
      server.find((a) => a.id === "map-worldbuilding-" + id).footprint,
      4,
    );
  assert.equal(
    server.filter((asset) => asset.name === "Throne Tower").length,
    2,
  );
  assert.equal(
    server.filter((asset) => asset.name === "Prosperous City").length,
    4,
  );
  assert.equal(
    server.filter((asset) => asset.name === "Gladiator School").length,
    4,
  );
});

test("picker entries separate designs and group only explicit upgrade chains", () => {
  for (const [family, names] of [
    ["keep-verona", ["Verona – Dawn", "Verona – Night"]],
    [
      "keep-silver-wonder",
      ["Silver Wonder – Blossom", "Silver Wonder – Snowfall"],
    ],
  ]) {
    const matches = entries.filter((entry) => entry.family === family);
    assert.deepEqual(
      matches.map((entry) => entry.name),
      names,
    );
    assert.ok(matches.every((entry) => entry.variants.length === 1));
  }
  assert.equal(
    entries.find((entry) => entry.name === "Thebes").variants.length,
    3,
  );
  const athenaeum = entries.filter(
    (entry) => entry.family === "keep-arcanum-athenaeum",
  );
  assert.equal(athenaeum.length, 2);
  assert.equal(
    athenaeum.find((entry) => entry.name === "Arcanum Athenaeum").variants
      .length,
    1,
  );
  assert.equal(
    athenaeum.find((entry) => entry.name === "Arcanum Athenaeum – Neophyte")
      .variants.length,
    3,
  );
  assert.equal(
    entries.filter((entry) => entry.family === "objective-prosperous-city")
      .length,
    4,
  );
  assert.ok(
    entries
      .filter((entry) => entry.variants.length > 1 && !entry.automatic)
      .every((entry) =>
        entry.variants.every((asset) => asset.upgradeGroup === entry.id),
      ),
  );
});

test("assembled server graphics retain native prefab anchors", () => {
  for (const id of [
    "map-kingdom",
    "map-triumph",
    "map-worldbuilding-wizardtower",
    "map-worldbuilding-mangonelleft",
    "map-worldbuilding-mangonelright",
  ]) {
    const asset = catalog.assets.find((asset) => asset.id === id);
    assert.ok(asset.mapAnchor.pixelScale > 0, id);
    assert.ok(Number.isFinite(asset.mapAnchor.pivotX), id);
    assert.ok(Number.isFinite(asset.mapAnchor.pivotY), id);
  }
});

test("alliance castles use their client footprint rather than the generic building fallback", () => {
  const ordinary = assets.get("map-world_castle_guild");
  assert.equal(ordinary.footprint, 2);
  assert.equal(ordinary.footprintSource, "GuildCastleObject.edgeGridCount");
  for (const record of inventory.filter((r) => r.kind === "alliance")) {
    const asset = assets.get(record.asset);
    assert.equal(asset.footprint, record.footprint);
    assert.equal(asset.footprintSource, "GuildCastleSkinConfig.size");
  }
});
