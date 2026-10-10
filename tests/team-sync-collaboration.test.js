import test from "node:test";
import assert from "node:assert/strict";
import { ProjectSync } from "../web/src/services/project-sync.js";
import {
  teamFingerprint,
  mergeTeamPlans,
  applyProfileCaches,
} from "../web/src/domain/team-collaboration.js";
import { createDemoPlan } from "../web/src/domain/plan.js";
import { linkedPlayer } from "../web/src/domain/player-document.js";
import { validatePlan } from "../web/src/domain/validation.js";
import { catalog } from "./fixtures/catalog.js";
function fixture() {
  const base = validatePlan(createDemoPlan(catalog), catalog);
  base.keeps[0] = linkedPlayer(base.keeps[0], base.keeps[0], {
    id: "player",
    version: "1",
  });
  let local = structuredClone(base),
    shared = structuredClone(base),
    version = "1";
  const writes = [],
    uploads = [],
    resolutions = [];
  const drive = {
    metadata: async (file) => ({ ...file, version }),
    load: async (file) => ({
      file: { ...file, version },
      plan: structuredClone(shared),
    }),
    save: async (file, plan) => {
      if (file.version !== version)
        throw Object.assign(new Error("Race"), { status: 412 });
      uploads.push(structuredClone(plan));
      shared = structuredClone(plan);
      version = String(Number(version) + 1);
      return { ...file, version };
    },
  };
  const sync = new ProjectSync({
    drive,
    getPlan: () => local,
    flush: async () => {},
    writeDraft: async (draft) => writes.push(draft),
    key: () => "team",
    reload: async () => {},
    saved: () => {},
    changed: () => {},
    status: () => {},
    expired: () => {},
    canCheck: () => true,
    fingerprint: teamFingerprint,
    merge: mergeTeamPlans,
    applyPlan: (plan) => {
      local = plan;
    },
    validate: (plan) => validatePlan(plan, catalog),
    resolve: async (conflicts) => {
      resolutions.push(conflicts);
      return "remote";
    },
  });
  sync.opened({ id: "team", version, capabilities: { canEdit: true } }, base);
  return {
    sync,
    drive,
    base,
    writes,
    uploads,
    resolutions,
    local: () => local,
    shared: () => shared,
    edit: (fn) => {
      fn(local);
      sync.changed();
    },
    remote: (fn) => {
      fn(shared);
      version = String(Number(version) + 1);
    },
  };
}
test("Save merges an independent remote edit after a rejected conditional write", async () => {
  const f = fixture();
  f.edit((plan) => {
    plan.title = "Local title";
  });
  f.remote((plan) => {
    plan.discordUrl = "https://discord.gg/example";
  });
  await f.sync.save();
  assert.equal(f.shared().title, "Local title");
  assert.equal(f.shared().discordUrl, "https://discord.gg/example");
  assert.equal(f.sync.dirty, false);
  assert.deepEqual(f.resolutions, []);
  assert.equal(f.writes.at(-1).basePlan.title, "Local title");
});
test("background publication preserves unsaved formations and merges remote planning changes", async () => {
  const f = fixture();
  f.edit((plan) => {
    plan.title = "Unsaved team name";
    plan.keeps[0].x += 10;
  });
  f.remote((plan) => {
    plan.discordUrl = "https://discord.gg/example";
  });
  const update = linkedPlayer(
    f.base.keeps[0],
    { ...f.base.keeps[0], name: "New profile" },
    { id: "player", version: "2" },
  );
  await f.sync.publish((plan) => applyProfileCaches(plan, [update]));
  assert.equal(f.shared().title, f.base.title);
  assert.equal(f.shared().keeps[0].x, f.base.keeps[0].x);
  assert.equal(f.shared().keeps[0].name, "New profile");
  assert.equal(f.local().title, "Unsaved team name");
  assert.equal(f.local().keeps[0].x, f.base.keeps[0].x + 10);
  assert.equal(f.local().discordUrl, "https://discord.gg/example");
  assert.equal(f.sync.dirty, true);
});
test("remote changes update clean viewers and preserve independent local drafts", async () => {
  const f = fixture();
  f.edit((plan) => {
    plan.title = "Local title";
  });
  f.remote((plan) => {
    plan.discordUrl = "https://discord.gg/example";
  });
  await f.sync.checkRemote();
  assert.equal(f.local().title, "Local title");
  assert.equal(f.local().discordUrl, "https://discord.gg/example");
  assert.equal(f.sync.remoteChanged, false);
  assert.equal(f.sync.dirty, true);
  await f.sync.save();
  f.sync.file.capabilities.canEdit = false;
  f.remote((plan) => {
    plan.title = "Latest team title";
  });
  await f.sync.checkRemote();
  assert.equal(f.local().title, "Latest team title");
  assert.equal(f.sync.dirty, false);
  assert.equal(f.uploads.length, 1);
});
test("same-field conflicts are reviewed, with independent local changes retained", async () => {
  const f = fixture();
  f.edit((plan) => {
    plan.title = "My title";
    plan.projectLogo = "data:image/webp;base64,AAAA";
  });
  f.remote((plan) => {
    plan.title = "Shared title";
  });
  await f.sync.save();
  assert.equal(f.resolutions.length, 1);
  assert.equal(f.resolutions[0][0].path, "title");
  assert.equal(f.shared().title, "Shared title");
  assert.equal(f.shared().projectLogo, "data:image/webp;base64,AAAA");
});
test("cancelled conflict review retains the local draft and does not upload", async () => {
  const f = fixture();
  f.edit((plan) => {
    plan.title = "Local";
  });
  f.remote((plan) => {
    plan.title = "Remote";
  });
  f.sync.resolve = async () => null;
  await f.sync.save();
  assert.equal(f.uploads.length, 0);
  assert.equal(f.local().title, "Local");
  assert.equal(f.sync.dirty, true);
  assert.equal(f.sync.saving, false);
});
test("a cache publication cannot silently approve a conflicting local planning edit", async () => {
  const f = fixture();
  f.edit((plan) => {
    plan.title = "Local title";
  });
  f.remote((plan) => {
    plan.title = "Remote title";
  });
  const update = linkedPlayer(
    f.base.keeps[0],
    { ...f.base.keeps[0], name: "New profile" },
    { id: "player", version: "2" },
  );
  await f.sync.publish((plan) => applyProfileCaches(plan, [update]));
  assert.equal(f.shared().title, "Remote title");
  assert.equal(f.local().title, "Local title");
  assert.equal(f.sync.remoteChanged, true);
  assert.equal(f.sync.basePlan.title, f.base.title);
  await f.sync.save();
  assert.equal(f.resolutions.length, 1);
  assert.equal(f.shared().title, "Remote title");
});
