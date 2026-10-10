import test from "node:test";
import assert from "node:assert/strict";
import {
  teamFingerprint,
  mergeTeamPlans,
  applyProfileCaches,
} from "../web/src/domain/team-collaboration.js";
import { createDemoPlan } from "../web/src/domain/plan.js";
import { linkedPlayer } from "../web/src/domain/player-document.js";
import { selectMapPlan, createMapPlan } from "../web/src/domain/map-plans.js";
import { removePlayer } from "../web/src/domain/players.js";
import { TeamStore } from "../web/src/application/team-store.js";
import { validatePlan } from "../web/src/domain/validation.js";
import { catalog } from "./fixtures/catalog.js";
const clone = structuredClone;
function fixture() {
  const plan = validatePlan(createDemoPlan(catalog), catalog);
  plan.keeps[0] = linkedPlayer(plan.keeps[0], plan.keeps[0], {
    id: "profile",
    version: "1",
  });
  return plan;
}
test("independent team edits merge, preserving navigation and the newest profile cache", () => {
  const base = fixture(),
    local = clone(base),
    remote = clone(base);
  local.title = "Local title";
  remote.discordUrl = "https://discord.gg/example";
  remote.keeps[0] = linkedPlayer(
    remote.keeps[0],
    { ...remote.keeps[0], name: "Updated player" },
    { id: "profile", version: "2" },
  );
  const result = mergeTeamPlans(base, local, remote);
  assert.deepEqual(result.conflicts, []);
  validatePlan(result.plan, catalog);
  assert.equal(result.plan.title, "Local title");
  assert.equal(result.plan.discordUrl, remote.discordUrl);
  assert.equal(result.plan.keeps[0].name, "Updated player");
  assert.equal(
    teamFingerprint(remote),
    teamFingerprint({ ...base, discordUrl: remote.discordUrl }),
  );
});
test("a newly added unplaced player keeps its footprint during a team merge", () => {
  const base = fixture(),
    remote = clone(base);
  remote.keeps.push({
    ...clone(base.keeps[1]),
    id: "new-alt",
    name: "New alt",
    ownerId: base.keeps[0].id,
    x: null,
    y: null,
    w: 4,
    h: 4,
    locked: false,
  });
  validatePlan(remote, catalog);
  const result = mergeTeamPlans(base, clone(base), remote);
  assert.deepEqual(result.conflicts, []);
  assert.equal(
    result.plan.keeps.find((player) => player.id === "new-alt").w,
    4,
  );
  validatePlan(result.plan, catalog);
});
test("two moves of the same player are one conflict; resolving preserves independent edits", () => {
  const base = fixture(),
    local = clone(base),
    remote = clone(base);
  local.keeps[0].x = 50;
  local.keeps[0].y = 50;
  remote.keeps[0].x = 60;
  remote.keeps[0].y = 60;
  local.title = "My title";
  remote.discordUrl = "https://discord.gg/example";
  const result = mergeTeamPlans(base, local, remote, { resolution: "remote" });
  assert.equal(result.conflicts.length, 1);
  assert.match(result.conflicts[0].path, /positions\[/);
  assert.equal(result.plan.keeps[0].x, remote.keeps[0].x);
  assert.equal(result.plan.keeps[0].y, remote.keeps[0].y);
  assert.equal(result.plan.title, local.title);
  assert.equal(result.plan.discordUrl, remote.discordUrl);
});
test("removing a player wins over cache refresh, but conflicts with an ownership edit", () => {
  const base = fixture(),
    local = removePlayer(base, base.keeps[0].id),
    remote = clone(base);
  remote.keeps[0] = linkedPlayer(
    remote.keeps[0],
    { ...remote.keeps[0], name: "Refreshed" },
    { id: "profile", version: "2" },
  );
  const result = mergeTeamPlans(base, local, remote);
  assert.deepEqual(result.conflicts, []);
  assert.ok(
    !result.plan.keeps.some((player) => player.id === base.keeps[0].id),
  );
  remote.keeps[0].ownerId = base.keeps[1].id;
  assert.ok(mergeTeamPlans(base, local, remote).conflicts.length);
});
test("fresh source data is visible to viewers and survives Undo without adding an Undo entry", () => {
  const base = fixture(),
    store = new TeamStore(catalog);
  store.replace(base);
  const savedFingerprint = teamFingerprint(store.plan);
  store.mutate((plan) => {
    plan.title = "Draft title";
  });
  const update = linkedPlayer(
    base.keeps[0],
    { ...base.keeps[0], name: "Saved source" },
    { id: "profile", version: "9" },
  );
  store.readOnly = true;
  store.refresh(applyProfileCaches(store.plan, [update]), (snapshot) =>
    applyProfileCaches(snapshot, [update]),
  );
  assert.equal(store.plan.keeps[0].name, "Saved source");
  store.readOnly = false;
  store.undo();
  assert.equal(store.plan.title, base.title);
  assert.equal(store.plan.keeps[0].name, "Saved source");
  assert.equal(store.canUndo, false);
  assert.equal(teamFingerprint(store.plan), savedFingerprint);
  const stale = applyProfileCaches(store.plan, [base.keeps[0]]);
  assert.equal(stale.keeps[0].name, "Saved source");
});
test("a remote update cannot change the selected map or make navigation dirty", () => {
  const base = fixture(),
    remote = clone(base);
  remote.title = "Shared title";
  // Even the single-map plan's active navigation is reconstructed from local state.
  const local = selectMapPlan(base, base.maps[0].id);
  const result = mergeTeamPlans(base, local, remote);
  assert.equal(result.plan.activeMapId, local.activeMapId);
  assert.equal(teamFingerprint(result.plan), teamFingerprint(remote));
});
test("source level changes that change the automatic rally setter are not planning edits", () => {
  const base = fixture(),
    update = linkedPlayer(
      base.keeps[0],
      { ...base.keeps[0], level: 1 },
      { id: "profile", version: "2" },
    );
  const refreshed = applyProfileCaches(base, [update]);
  assert.equal(teamFingerprint(refreshed), teamFingerprint(base));
  assert.deepEqual(mergeTeamPlans(base, base, refreshed).conflicts, []);
});
test("independent edits to separate maps merge while keeping the local map selected", () => {
  const base = createMapPlan(fixture(), "blank", "Second map"),
    local = selectMapPlan(base, base.maps[0].id),
    remote = structuredClone(base);
  local.keeps[0].x += 20;
  remote.keeps[1].x = 50;
  remote.keeps[1].y = 50;
  const result = mergeTeamPlans(base, local, remote);
  assert.deepEqual(result.conflicts, []);
  validatePlan(result.plan, catalog);
  assert.equal(result.plan.activeMapId, local.activeMapId);
  assert.equal(result.plan.keeps[0].x, local.keeps[0].x);
  assert.equal(
    result.plan.maps[1].layout.positions.find(
      (position) => position.id === remote.keeps[1].id,
    ).x,
    50,
  );
});
test("different players moving onto the same tile require formation conflict review", () => {
  const base = fixture(),
    local = structuredClone(base),
    remote = structuredClone(base);
  local.keeps[0].x = 50;
  local.keeps[0].y = 50;
  remote.keeps[1].x = 50;
  remote.keeps[1].y = 50;
  validatePlan(local, catalog);
  validatePlan(remote, catalog);
  const result = mergeTeamPlans(base, local, remote, { resolution: "remote" });
  assert.equal(result.conflicts.length, 1);
  assert.match(result.conflicts[0].path, /overlapping/);
  validatePlan(result.plan, catalog);
  assert.equal(result.plan.keeps[0].x, base.keeps[0].x);
  assert.equal(result.plan.keeps[1].x, 50);
});
