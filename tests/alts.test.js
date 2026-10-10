import test from "node:test";
import assert from "node:assert/strict";
import { assignPlayerOwner, removePlayer } from "../web/src/domain/players.js";
import {
  applyPlayerProfile,
  playerProfile,
} from "../web/src/domain/player-document.js";
import { createDemoPlan } from "../web/src/domain/plan.js";
import { validatePlan } from "../web/src/domain/validation.js";
import { TeamStore } from "../web/src/application/team-store.js";
import { catalog } from "./fixtures/catalog.js";

const plan = () => validatePlan(createDemoPlan(catalog), catalog);

test("assigning, reassigning and emancipating an alt preserve its player data and map layouts", () => {
  const before = plan();
  const [alt, owner, other] = before.keeps;
  const assigned = assignPlayerOwner(before, alt.id, owner.id);
  assert.deepEqual(assigned.keeps[0], { ...alt, ownerId: owner.id });
  assert.deepEqual(assigned.maps, before.maps);
  assert.equal(before.keeps[0].ownerId, undefined);
  const reassigned = assignPlayerOwner(assigned, alt.id, other.id);
  assert.equal(reassigned.keeps[0].ownerId, other.id);
  const freed = assignPlayerOwner(reassigned, alt.id, null);
  assert.deepEqual(freed.keeps[0], alt);
  assert.doesNotThrow(() => validatePlan(freed, catalog));
});

test("ownership rejects missing owners, self ownership and ownership by an alt", () => {
  const before = plan();
  const [alt, owner, other] = before.keeps;
  const assigned = assignPlayerOwner(before, alt.id, owner.id);
  for (const id of ["missing", other.id, alt.id])
    assert.throws(
      () => assignPlayerOwner(assigned, other.id, id),
      /regular player/,
    );
  assert.throws(
    () => assignPlayerOwner(before, "missing", owner.id),
    /not found/,
  );
  for (const ownerId of ["missing", alt.id, 123, ""]) {
    const invalid = structuredClone(before);
    invalid.keeps[0].ownerId = ownerId;
    assert.throws(() => validatePlan(invalid, catalog), /Alts must belong/);
  }
});

test("demoting an owner transfers its alts and removing the owner emancipates them", () => {
  const before = plan();
  const [alt, owner, other] = before.keeps;
  const assigned = assignPlayerOwner(before, alt.id, owner.id);
  const demoted = assignPlayerOwner(assigned, owner.id, other.id);
  assert.equal(demoted.keeps[0].ownerId, other.id);
  assert.equal(demoted.keeps[1].ownerId, other.id);
  assert.doesNotThrow(() => validatePlan(demoted, catalog));
  const removed = removePlayer(demoted, other.id);
  assert.ok(removed.keeps.every((player) => player.ownerId == null));
  assert.doesNotThrow(() => validatePlan(removed, catalog));
});

test("central profile refresh preserves team ownership without exporting it", () => {
  const before = plan();
  const [alt, owner] = before.keeps;
  const assigned = assignPlayerOwner(before, alt.id, owner.id).keeps[0];
  const profile = playerProfile(assigned);
  assert.equal(Object.hasOwn(profile, "ownerId"), false);
  const refreshed = applyPlayerProfile(assigned, {
    ...profile,
    name: "Updated alt",
  });
  assert.equal(refreshed.ownerId, owner.id);
  assert.equal(refreshed.name, "Updated alt");
});

test("ownership survives document reload and Undo restores the regular player", () => {
  const store = new TeamStore(catalog);
  store.replace(plan());
  const before = store.plan;
  const [alt, owner] = before.keeps;
  store.commit(assignPlayerOwner(before, alt.id, owner.id));
  const saved = JSON.parse(JSON.stringify(store.plan));
  assert.equal(validatePlan(saved, catalog).keeps[0].ownerId, owner.id);
  store.undo();
  assert.deepEqual(store.plan, before);
});
