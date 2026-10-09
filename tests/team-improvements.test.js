import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyPlan } from "../web/src/domain/plan.js";
import { migratePlan } from "../web/src/domain/document-migrations.js";
import {
  createNavigation,
  parseRoute,
  routeHash,
} from "../web/src/ui/navigation.js";
test("legacy plan migration is immutable, idempotent, and rejects unknown versions", () => {
  const old = createEmptyPlan();
  delete old.subcities;
  const migrated = migratePlan(old);
  assert.deepEqual(migrated.subcities, []);
  assert.equal(old.subcities, undefined);
  assert.deepEqual(migratePlan(migrated), migrated);
  assert.throws(() => migratePlan({ version: 2 }), /supported/);
});
test("routes preserve identifiers, reject unknown screens, and honor Back without adding entries", () => {
  const route = {
    team: "team-a",
    screen: "player",
    player: "player one",
    map: null,
  };
  assert.deepEqual(parseRoute(routeHash(route)), route);
  assert.equal(parseRoute("#screen=bogus").screen, "project");
  const entries = [],
    handlers = {};
  const host = {
    location: { hash: routeHash(route) },
    addEventListener: (name, callback) => (handlers[name] = callback),
    history: {
      pushState: (_a, _b, hash) => {
        entries.push(hash);
        host.location.hash = hash;
      },
      replaceState: (_a, _b, hash) => (host.location.hash = hash),
    },
  };
  let current = { team: "team-a", screen: "project" };
  const nav = createNavigation({
    host,
    ready: () => true,
    getRoute: () => current,
    applyRoute: (route) => {
      current = route;
      nav.changed();
    },
  });
  nav.opened();
  assert.equal(current.player, "player one");
  assert.equal(entries.length, 0);
  current = { team: "team-a", screen: "subcities" };
  nav.changed();
  assert.equal(entries.length, 1);
  host.location.hash = routeHash(route);
  handlers.popstate();
  assert.equal(current.screen, "player");
  assert.equal(entries.length, 1);
});
