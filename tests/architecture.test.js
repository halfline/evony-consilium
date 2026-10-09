import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

const root = resolve("web/src");
const modules = readdirSync(root, { recursive: true }).filter((file) =>
  file.endsWith(".js"),
);
const edges = new Map();
for (const module of modules) {
  const source = readFileSync(resolve(root, module), "utf8");
  const imports = [
    ...source.matchAll(
      /\b(?:import|export)\s+(?:[^;"']*?\s+from\s+)?["']([^"']+)["']/g,
    ),
  ].map((match) => match[1]);
  edges.set(
    module,
    imports.map((path) => relative(root, resolve(root, dirname(module), path))),
  );
}
const allowed = {
  domain: ["domain"],
  application: ["application", "domain"],
  rendering: ["rendering", "domain"],
  persistence: ["persistence", "domain"],
  io: ["io", "domain"],
  services: ["services", "domain", "persistence"],
  ui: ["ui", "domain", "application", "rendering", "io", "services"],
};
test("runtime imports resolve and every layer respects its dependency boundary", () => {
  for (const [module, imports] of edges) {
    const layer = module.split("/")[0];
    assert.ok(allowed[layer], `Unclassified runtime layer: ${module}`);
    for (const target of imports) {
      assert.ok(
        existsSync(resolve(root, target)),
        `${module} imports missing ${target}`,
      );
      if (layer === "ui")
        assert.ok(
          !target.startsWith("services/google/"),
          `${module} depends directly on a transport client`,
        );
      if (allowed[layer])
        assert.ok(
          allowed[layer].includes(target.split("/")[0]),
          `${module} crosses its boundary into ${target}`,
        );
    }
  }
});
test("screen controllers own their views instead of querying the global shell", () => {
  for (const module of modules.filter((file) => file.startsWith("ui/"))) {
    if (["ui/planner.js", "ui/dom.js"].includes(module)) continue;
    const source = readFileSync(resolve(root, module), "utf8");
    assert.doesNotMatch(
      source,
      /import\s*\{[^}]*\$[^}]*\}\s*from\s*["']\.\/dom\.js["']/,
      `${module} imports the global shell lookup`,
    );
    assert.doesNotMatch(
      source,
      /document\.(?:querySelector|getElementById)/,
      `${module} searches outside its view roots`,
    );
  }
});

test("runtime module dependencies have no cycles", () => {
  const completed = new Set();
  function visit(module, path = []) {
    assert.ok(
      !path.includes(module),
      `Module cycle: ${[...path, module].join(" -> ")}`,
    );
    if (completed.has(module)) return;
    for (const target of edges.get(module) || [])
      visit(target, [...path, module]);
    completed.add(module);
  }
  for (const module of edges.keys()) visit(module);
});

test("runtime modules can be imported without a DOM or network side effects", async () => {
  const fetch = globalThis.fetch;
  globalThis.fetch = () =>
    assert.fail("A module made a network request during import.");
  try {
    for (const module of modules)
      await import(new URL("../web/src/" + module, import.meta.url));
  } finally {
    globalThis.fetch = fetch;
  }
});
