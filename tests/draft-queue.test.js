import { test } from "node:test";
import assert from "node:assert/strict";
import { DraftQueue } from "../web/src/persistence/draft-queue.js";

test("flushing saves only the latest pending draft with its project key", async () => {
  const writes = [];
  const queue = new DraftQueue(
    async (data, key) => writes.push({ data, key }),
    { delay: 60000 },
  );
  queue.schedule({ revision: 1 }, "alice/team");
  queue.schedule({ revision: 2 }, "alice/team");
  await queue.flush();
  assert.deepEqual(writes, [{ data: { revision: 2 }, key: "alice/team" }]);
});

test("draft writes serialize even when a different project is queued", async () => {
  const writes = [];
  let release;
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  const queue = new DraftQueue(
    async (data, key) => {
      writes.push(key);
      if (key === "first") await blocked;
    },
    { delay: 60000 },
  );
  queue.schedule({}, "first");
  const first = queue.flush();
  await Promise.resolve();
  await Promise.resolve();
  queue.schedule({}, "second");
  const second = queue.flush();
  assert.deepEqual(writes, ["first"]);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(writes, ["first", "second"]);
});

test("flush reports failed storage and a subsequent draft can retry", async () => {
  const failure = new Error("Storage unavailable");
  const errors = [];
  let attempts = 0;
  const queue = new DraftQueue(
    async () => {
      if (++attempts === 1) throw failure;
    },
    { delay: 60000, onError: (error) => errors.push(error) },
  );
  queue.schedule({}, "team");
  await assert.rejects(queue.flush(), failure);
  assert.deepEqual(errors, [failure]);
  queue.schedule({}, "team");
  await queue.flush();
  assert.equal(attempts, 2);
});

test("save acknowledgement is serialized after pending edits and before later edits", async () => {
  const writes = [];
  const queue = new DraftQueue(
    async (data, key) => writes.push({ data, key }),
    { delay: 10000 },
  );
  queue.schedule({ plan: "before-save", baseVersion: "1" }, "old-team");
  const saved = queue.writeNow({ plan: "saved", baseVersion: "2" }, "old-team");
  queue.schedule({ plan: "after-save", baseVersion: "2" }, "old-team");
  await saved;
  await queue.flush();
  assert.deepEqual(
    writes.map((write) => write.data.plan),
    ["before-save", "saved", "after-save"],
  );
  assert.ok(writes.every((write) => write.key === "old-team"));
});
test("an immediate write for another team preserves the pending draft’s own key", async () => {
  const writes = [];
  const queue = new DraftQueue(
    async (data, key) => writes.push({ data, key }),
    { delay: 10000 },
  );
  queue.schedule("old edits", "alice/old");
  await queue.writeNow("new snapshot", "alice/new");
  assert.deepEqual(writes, [
    { data: "old edits", key: "alice/old" },
    { data: "new snapshot", key: "alice/new" },
  ]);
});
