import test from "node:test";
import assert from "node:assert/strict";
import {
  matchesPlayerSearch,
} from "../web/src/ui/player-search.js";

test("player search matches alternate epsilon letters and plain text", () => {
  const player = { name: "PɛssiMystic_", accountId: "319822845" };
  for (const query of [
    "Pɛssi",
    "Pεssi",
    "Pessi",
    "PƐSSI",
    "Mystic",
    "319822845",
  ])
    assert.equal(matchesPlayerSearch(player, query), true, query);
  assert.equal(matchesPlayerSearch(player, "Mattie"), false);
  assert.equal(player.name, "PɛssiMystic_");
});

test("player search ignores accents and decorative Unicode lettering", () => {
  assert.equal(matchesPlayerSearch({ name: "halvenrāythe" }, "raythe"), true);
  assert.equal(matchesPlayerSearch({ name: "𝓟𝓮𝓼𝓼𝓲" }, "pessi"), true);
  assert.equal(
    matchesPlayerSearch({ name: "Alt" }, "raythe", "halvenrāythe"),
    true,
  );
});
