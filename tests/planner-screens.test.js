import test from "node:test";
import assert from "node:assert/strict";
import { createPlannerScreens } from "../web/src/ui/planner-screens.js";

test("planner screens expose only the active route and its controls", () => {
  const ids = [
    "maps-return-arrow", "player-screen", "players-return-arrow",
    "project-screen", "players-screen", "players-search-control",
    "subcities-search-control", "formation-screen", "maps-screen",
    "subcities-screen",
  ];
  const nodes = ids.map((id) => ({ id, hidden: true }));
  const buttons = ["project", "players", "subcities", "maps"].map((screen) => ({
    dataset: { screen },
    attributes: {},
    classList: { toggle() {} },
    setAttribute(name, value) { this.attributes[name] = value; },
  }));
  const toolbar = { hidden: true };
  const root = {
    id: "planner",
    contains: (node) => nodes.includes(node),
    querySelectorAll(selector) {
      if (selector === "[id]") return nodes;
      if (selector === "[data-screen]") return buttons;
      if (selector === "[data-map-action]") return [toolbar];
      return [];
    },
    querySelector(selector) {
      const screen = selector.match(/data-screen="([^"]+)"/)?.[1];
      return buttons.find((button) => button.dataset.screen === screen);
    },
  };
  const seen = [];
  const screens = createPlannerScreens(root, (screen) => seen.push(screen));
  screens.show("formation");
  assert.equal(nodes.find(({ id }) => id === "formation-screen").hidden, false);
  assert.equal(nodes.find(({ id }) => id === "maps-screen").hidden, true);
  assert.equal(nodes.find(({ id }) => id === "maps-return-arrow").hidden, false);
  assert.equal(toolbar.hidden, false);
  assert.equal(buttons.find(({ dataset }) => dataset.screen === "maps").attributes["aria-label"], "Back to maps");
  screens.show("player");
  assert.equal(nodes.find(({ id }) => id === "player-screen").hidden, false);
  assert.equal(toolbar.hidden, true);
  assert.deepEqual(seen, ["formation", "player"]);
});
