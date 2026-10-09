import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { assetURL } from "./paths.js";
const portraits = JSON.parse(
  readFileSync(assetURL("assets/avatar-catalog.json")),
);
test("avatar catalog has unique IDs, valid categories, a default, and available images", () => {
  const ids = new Set(portraits.avatars.map((avatar) => avatar.id));
  assert.equal(ids.size, portraits.avatars.length);
  assert.ok(ids.has(portraits.defaultId));
  for (const avatar of portraits.avatars) {
    assert.ok(avatar.name || avatar.culture);
    assert.ok(
      portraits.categories.some((category) => category.id === avatar.category),
    );
    assert.ok(existsSync(assetURL(avatar.src)));
  }
});
test("portrait categories follow client general_type, with unlabeled culture portraits", () => {
  assert.deepEqual(
    portraits.categories.map((category) => category.name),
    [
      "Europe",
      "China",
      "Japan",
      "Korea",
      "America",
      "Russia",
      "Arabia",
      "Collection",
      "General",
    ],
  );
  for (const avatar of portraits.avatars) {
    if (avatar.source === "AvatarConfigure")
      assert.equal(avatar.category, "collection");
    else if (avatar.generalType === 0) {
      assert.ok(avatar.category.startsWith("culture-"));
      assert.equal(avatar.name, "");
      assert.ok(avatar.culture);
    } else
      assert.equal(
        avatar.category,
        avatar.generalType === 2 ? "general" : "collection",
      );
  }
  const martinus = portraits.avatars.find(
    (avatar) => avatar.name === "Dragon God - Martinus",
  );
  assert.equal(martinus.category, "general");
});
