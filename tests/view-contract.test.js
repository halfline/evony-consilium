import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const html = readFileSync("web/index.html", "utf8");
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);

test("the application shell has unambiguous control identifiers", () => {
  assert.equal(new Set(ids).size, ids.length, "Duplicate shell control IDs");
});

test("literal controller lookups refer to controls declared by the shell", () => {
  const declared = new Set(ids);
  for (const file of readdirSync("web/src/ui").filter((file) =>
    file.endsWith(".js"),
  )) {
    const source = readFileSync("web/src/ui/" + file, "utf8");
    for (const [, id] of source.matchAll(/\$\("([^"]+)"\)/g))
      assert.ok(
        declared.has(id),
        `${file} looks up an undeclared shell control: ${id}`,
      );
  }
});
