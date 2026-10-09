import test from "node:test";
import assert from "node:assert/strict";
import {
  playerProfile,
  validateProfile,
  playerDocument,
  readPlayerDocument,
  linkedPlayer,
  mergePlayerProfiles,
} from "../web/src/domain/player-document.js";
import { createDemoPlan } from "../web/src/domain/plan.js";
import { validatePlan } from "../web/src/domain/validation.js";
import { catalog } from "./fixtures/catalog.js";
const player = () => ({
  ...createDemoPlan(catalog).keeps[0],
  details: { rallyCapacity: 100 },
});
const file = { id: "player-file", version: "1" };

test("player documents contain profiles without roster identity or map data", () => {
  const input = {
    ...player(),
    playerSource: { fileId: "untrusted" },
    maps: ["bad"],
    locked: true,
  };
  const document = playerDocument(input);
  assert.deepEqual(readPlayerDocument(document), validateProfile(input));
  for (const field of [
    "id",
    "x",
    "y",
    "w",
    "h",
    "locked",
    "maps",
    "playerSource",
  ])
    assert.equal(Object.hasOwn(document.profile, field), false);
  assert.throws(
    () => readPlayerDocument({ format: "evony-consilium-team", schema: 1 }),
    /not.*player/,
  );
  assert.throws(() => playerDocument({ ...input, level: 0 }), /keep level/);
});
