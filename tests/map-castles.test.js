import test from "node:test";
import assert from "node:assert/strict";
import { catalog } from "./fixtures/catalog.js";
import { TeamStore } from "../web/src/application/team-store.js";
import { createEmptyPlan } from "../web/src/domain/plan.js";
import { captureLayout } from "../web/src/domain/layout.js";
import {
  createMapPlan,
  projectFingerprint,
} from "../web/src/domain/map-plans.js";
import {
  changeAppearance,
  changeMapCastle,
  useProfileCastle,
} from "../web/src/domain/appearance-commands.js";
import {
  applyProfileCaches,
  mergeTeamPlans,
  teamFingerprint,
} from "../web/src/domain/team-collaboration.js";
import {
  playerDocument,
  linkedPlayer,
} from "../web/src/domain/player-document.js";
import { teamChanges } from "../web/src/domain/team-activity.js";
import { validatePlan } from "../web/src/domain/validation.js";

const large = {
  id: "large-castle",
  name: "Large castle",
  family: "large",
  kind: "keep",
  footprint: 3,
};
const assets = { ...catalog, assets: [...catalog.assets, large] };
function fixture() {
  const plan = createEmptyPlan();
  plan.keeps = [
    {
      id: "player",
      name: "Player",
      accountId: "",
      allianceTag: "",
      level: 1,
      skin: catalog.assets[0].id,
      x: 20,
      y: 20,
      w: 2,
      h: 2,
      locked: false,
    },
  ];
  plan.maps = [
    {
      id: "first",
      name: "First tactic",
      type: "server",
      layout: captureLayout(plan),
    },
  ];
  plan.activeMapId = "first";
  const store = new TeamStore(assets);
  store.replace(plan);
  return store;
}

test("maps independently override castle art and its game size without changing the profile", () => {
  const store = fixture();
  const profile = playerDocument(store.plan.keeps[0]);
  store.commit(createMapPlan(store.plan, "blank", "Second tactic"));
  const second = store.plan.activeMapId;
  store.commit(changeMapCastle(store.plan, "player", large));
  assert.equal(store.plan.keeps[0].castleOverride, large.id);
  assert.equal(store.plan.keeps[0].w, 3);
  assert.deepEqual(playerDocument(store.plan.keeps[0]), profile);
  // An unplaced override is still a saved map setting.
  const fingerprint = projectFingerprint(store.plan);
  assert.equal(
    JSON.parse(fingerprint).maps[1].layout.positions[0].castleOverride,
    large.id,
  );
  store.openMap("first");
  assert.equal(store.plan.keeps[0].castleOverride, undefined);
  assert.equal(store.plan.keeps[0].w, 2);
  assert.equal(store.plan.keeps[0].x, 20);
  assert.equal(projectFingerprint(store.plan), fingerprint);
  store.openMap(second);
  assert.equal(store.plan.keeps[0].castleOverride, large.id);
  assert.equal(store.plan.keeps[0].w, 3);
  const restored = new TeamStore(assets);
  restored.replace(JSON.parse(JSON.stringify(store.plan)));
  restored.openMap("first");
  assert.equal(restored.plan.keeps[0].w, 2);
  restored.openMap(second);
  assert.equal(restored.plan.keeps[0].w, 3);
});

test("map castle choices are undoable and can return to the profile default", () => {
  const store = fixture();
  store.commit(changeMapCastle(store.plan, "player", large));
  assert.equal(store.plan.keeps[0].x, 20);
  store.undo();
  assert.equal(store.plan.keeps[0].castleOverride, undefined);
  assert.equal(store.plan.keeps[0].w, 2);
  store.commit(changeMapCastle(store.plan, "player", large));
  store.commit(useProfileCastle(store.plan, "player", catalog.assets[0]));
  assert.equal(store.plan.keeps[0].castleOverride, undefined);
  assert.equal(
    store.plan.maps[0].layout.positions[0].castleOverride,
    undefined,
  );
  assert.equal(store.plan.keeps[0].w, 2);
});

test("an explicit 2×2 map choice survives a profile change to a 3×3 castle", () => {
  const store = fixture();
  const small = catalog.assets[0];
  store.commit(changeMapCastle(store.plan, "player", small));
  store.commit(changeAppearance(store.plan, "player", large));
  assert.equal(store.plan.keeps[0].skin, large.id);
  assert.equal(store.plan.keeps[0].castleOverride, small.id);
  assert.equal(store.plan.keeps[0].w, 2);
  store.commit(createMapPlan(store.plan, "blank", "Uses profile"));
  assert.equal(store.plan.keeps[0].castleOverride, undefined);
  assert.equal(store.plan.keeps[0].w, 3);
  store.openMap("first");
  assert.equal(store.plan.keeps[0].w, 2);
});

test("larger map castles reject collisions, map edges, and terrain without mutating the plan", () => {
  const store = fixture();
  const plan = structuredClone(store.plan);
  plan.obstacles.push({
    id: "block",
    name: "Blocked",
    x: 22,
    y: 20,
    w: 1,
    h: 1,
    locked: false,
  });
  const original = structuredClone(plan);
  assert.throws(() => changeMapCastle(plan, "player", large), /overlaps/);
  assert.deepEqual(plan, original);
  plan.obstacles = [];
  plan.keeps[0].x = plan.extent - 2;
  assert.throws(() => changeMapCastle(plan, "player", large), /map edge/);
  plan.keeps[0].x = 20;
  const terrain = {
    extent: 1200,
    width: 1200,
    blocked: new Uint8Array(1200 * 1200),
    landmarks: [],
  };
  terrain.blocked[20 * 1200 + 22] = 1;
  assert.throws(
    () => changeMapCastle(plan, "player", large, terrain),
    /overlaps/,
  );
});

test("imports reject unavailable castle overrides in active and inactive maps", () => {
  const store = fixture();
  const plan = structuredClone(store.plan);
  plan.keeps[0].castleOverride = "missing";
  assert.throws(() => validatePlan(plan, assets), /valid castle/);
  delete plan.keeps[0].castleOverride;
  plan.maps[0].layout.positions[0].castleOverride = "missing";
  assert.throws(() => validatePlan(plan, assets), /valid castle/);
  plan.maps[0].layout.positions[0].castleOverride = null;
  assert.throws(() => validatePlan(plan, assets), /map castle/);
});

test("map overrides merge with source refreshes and produce map activity", () => {
  const store = fixture();
  const base = structuredClone(store.plan);
  base.keeps[0] = linkedPlayer(base.keeps[0], base.keeps[0], {
    id: "source",
    version: "1",
  });
  store.replace(base);
  const before = structuredClone(store.plan);
  store.commit(changeMapCastle(store.plan, "player", large));
  const local = structuredClone(store.plan);
  const refreshed = linkedPlayer(
    before.keeps[0],
    { ...before.keeps[0], name: "Refreshed player" },
    { id: "source", version: "2" },
  );
  const remote = applyProfileCaches(before, [refreshed]);
  const result = mergeTeamPlans(before, local, remote);
  assert.deepEqual(result.conflicts, []);
  const restored = new TeamStore(assets);
  restored.replace(result.plan);
  assert.equal(restored.plan.keeps[0].name, "Refreshed player");
  assert.equal(restored.plan.keeps[0].castleOverride, large.id);
  assert.equal(restored.plan.keeps[0].w, 3);
  assert.notEqual(teamFingerprint(before), teamFingerprint(local));
  assert.deepEqual(teamChanges(before, local), ["Updated map First tactic"]);
});

test("source castle refreshes retain an explicitly pinned smaller map castle", () => {
  const store = fixture();
  const plan = structuredClone(store.plan);
  plan.keeps[0] = linkedPlayer(plan.keeps[0], plan.keeps[0], {
    id: "source",
    version: "1",
  });
  store.replace(plan);
  store.commit(changeMapCastle(store.plan, "player", catalog.assets[0]));
  const current = store.plan.keeps[0];
  const updated = linkedPlayer(
    current,
    { ...current, skin: large.id },
    { id: "source", version: "2" },
  );
  store.refresh(applyProfileCaches(store.plan, [updated]));
  assert.equal(store.plan.keeps[0].skin, large.id);
  assert.equal(store.plan.keeps[0].castleOverride, catalog.assets[0].id);
  assert.equal(store.plan.keeps[0].w, 2);
  assert.equal(store.plan.maps[0].layout.positions[0].w, 2);
});
