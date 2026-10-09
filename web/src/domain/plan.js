import { MAPS } from "./maps.js";
import { autoFormation } from "./formation.js";
import { createLayout } from "./layout.js";

export function createDemoPlan(catalog) {
  const assets = catalog.assets.filter((a) => a.kind === "keep");
  const names = [
    "Rally One", "Iron Crown", "Nightwatch", "North Star", "Red Keep",
    "Silver Oak", "Stormhold", "Citadel", "Oakheart", "Moonrise",
    "Vanguard", "Ember",
  ];
  const keeps = names.map((name, i) => ({
    id: crypto.randomUUID(), name, accountId: "", level: Math.max(25, 45 - i),
    skin: (assets.find((a) => a.family === [
      "culture-europe", "culture-china", "culture-japan", "culture-korea",
      "culture-america", "culture-russia", "culture-arabia",
    ][i % 7] && a.tier === 7) || assets[0]).id,
    w: 2, h: 2, x: null, y: null, locked: false,
  }));
  const plan = autoFormation({ ...createEmptyPlan(), keeps, rallyId: keeps[0].id });
  delete plan.maps;
  delete plan.activeMapId;
  return plan;
}

export function createEmptyPlan() {
  const { positions, ...layout } = createLayout();
  return {
    version: 1,
    title: "Alliance formation",
    maps: [],
    activeMapId: null,
    ...layout,
    keeps: [],
    subcities: [],
    customAssets: [],
    mapPresets: MAPS.map((map) => ({ ...map, verified: map.id !== "blank" })),
  };
}
