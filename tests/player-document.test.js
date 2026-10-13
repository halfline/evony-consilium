import test from "node:test";
import assert from "node:assert/strict";
import {
  playerProfile,
  validateProfile,
  playerDocument,
  readPlayerDocument,
  readPlayerActivity,
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
  assert.deepEqual(readPlayerActivity(document), []);
  assert.deepEqual(
    readPlayerActivity({ ...document, activityLog: undefined }),
    [],
  );
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

test("malformed player audit entries are rejected before saving or syncing", () => {
  const document = playerDocument(player());
  for (const activityLog of [
    null,
    {},
    [null],
    [{ id: "bad", at: "yesterday", account: "a", changes: "text" }],
  ])
    assert.throws(
      () => readPlayerActivity({ ...document, activityLog }),
      /Invalid activity/,
    );
});
test("linking keeps placements and caches the entire profile with a baseline", () => {
  const input = player();
  const profile = {
    ...playerProfile(input),
    name: "Linked",
    details: { rallyCapacity: 200 },
  };
  const linked = linkedPlayer(input, profile, file);
  assert.equal(linked.id, input.id);
  assert.equal(linked.x, input.x);
  assert.equal(linked.locked, input.locked);
  assert.deepEqual(linked.details, profile.details);
  assert.deepEqual(linked.playerSource.baseline, validateProfile(profile));
  assert.equal(linked.playerSource.fileId, file.id);
  const plan = createDemoPlan(catalog);
  plan.keeps[0] = linkedPlayer(plan.keeps[0], profile, file);
  assert.doesNotThrow(() => validatePlan(plan, catalog));
  plan.keeps[0].playerSource.fileId = "../bad";
  assert.throws(() => validatePlan(plan, catalog), /player file link/);
});
test("synchronization merges independent edits and removes deleted profile fields", () => {
  const base = playerProfile(player());
  const local = { ...base, name: "Team edit" };
  const remote = { ...base, details: { rallyCapacity: 200 } };
  assert.deepEqual(mergePlayerProfiles(base, local, remote), {
    profile: { ...local, details: remote.details },
    conflicts: [],
  });
  delete remote.details;
  const result = mergePlayerProfiles(base, base, remote);
  assert.equal(
    Object.hasOwn(linkedPlayer(player(), result.profile, file), "details"),
    false,
  );
});
test("conflicts are explicit and resolution preserves unrelated edits", () => {
  const base = playerProfile(player());
  const local = { ...base, name: "Team", level: 50 };
  const remote = { ...base, name: "Player", accountId: "00123" };
  const unresolved = mergePlayerProfiles(base, local, remote);
  assert.deepEqual(unresolved.conflicts, ["name"]);
  assert.deepEqual(mergePlayerProfiles(base, local, remote, "player").profile, {
    ...remote,
    level: 50,
  });
});
