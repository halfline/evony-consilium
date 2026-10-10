import test from "node:test";
import assert from "node:assert/strict";
import { Drive } from "../web/src/services/google/drive.js";
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
test("two writers passing the same preflight cannot both overwrite a Drive revision", async () => {
  let version = "1",
    reads = 0,
    release;
  const barrier = new Promise((resolve) => {
    release = resolve;
  });
  const writes = [];
  const drive = new Drive(
    () => "token",
    async (url, options) => {
      if (options.method === "GET") {
        const captured = version;
        if (++reads === 2) release();
        await barrier;
        return json({
          id: "team",
          version: captured,
          etag: `"rev-${captured}"`,
          capabilities: { canEdit: true },
        });
      }
      assert.equal(options.method, "PUT");
      assert.match(url, /upload\/drive\/v2/);
      if (options.headers["If-Match"] !== `"rev-${version}"`)
        return json({ error: { message: "Precondition failed" } }, 412);
      const [, data] = options.body
        .split("\r\n")
        .filter((line) => line.startsWith("{"))
        .map(JSON.parse);
      writes.push(data.plan);
      version = "2";
      return json({
        id: "team",
        title: "Saved",
        version,
        capabilities: { canEdit: true },
      });
    },
  );
  const results = await Promise.allSettled([
    drive.save({ id: "team", version: "1" }, { title: "Alice" }),
    drive.save({ id: "team", version: "1" }, { title: "Bob" }),
  ]);
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    results.find((result) => result.status === "rejected").reason.status,
    412,
  );
  assert.equal(writes.length, 1);
});
test("missing or weak metadata ETags never fall back to an unconditional upload", async () => {
  for (const etag of [undefined, 'W/"revision"', "guessed-version"]) {
    const drive = new Drive(
      () => "token",
      async (url, options) => {
        assert.equal(options.method, "GET");
        return json({ version: "1", etag, capabilities: { canEdit: true } });
      },
    );
    await assert.rejects(
      drive.save({ id: "team", version: "1" }, { title: "Draft" }),
      { status: 503 },
    );
  }
});
