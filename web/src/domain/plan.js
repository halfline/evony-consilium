import { MAPS } from "./maps.js";

export function createEmptyPlan() {
  return {
    version: 1,
    title: "Alliance formation",
    projectLogo: "",
    discordUrl: "",
    maps: [],
    activeMapId: null,
    map: "blank",
    extent: 1200,
    center: { x: 600, y: 600 },
    spacing: 0,
    formation: "rings",
    grid: { ax: 48, ay: 24, bx: -48, by: 24 },
    structures: [],
    obstacles: [],
    rallyId: null,
    rallyManual: false,
    backgrounds: {},
    labels: true,
    showGrid: true,
    keeps: [],
    subcities: [],
    customAssets: [],
    mapPresets: MAPS.map((map) => ({ ...map, verified: map.id !== "blank" })),
  };
}
