// Team files carry stable layout defaults before the map editor is introduced.
// These fields are inert while only the team screen is available.
const INITIAL_MAP_PRESETS = [
  { id: "blank", name: "Blank", subtitle: "Formation", color: "#26362b" },
  {
    id: "server",
    name: "Server map",
    subtitle: "Alliance hive",
    color: "#647947",
  },
  {
    id: "boc",
    name: "Battle of Constantinople",
    subtitle: "BoC",
    color: "#727956",
  },
  { id: "bog", name: "Battle of Gaugamela", subtitle: "BoG", color: "#8f8354" },
  {
    id: "chalons",
    name: "Battle of Chalons",
    subtitle: "Chalons",
    color: "#65794a",
  },
  {
    id: "allstars",
    name: "All-Star Battlefield",
    subtitle: "All-Stars",
    color: "#60775c",
  },
  {
    id: "civilization",
    name: "Civilization Battlefield",
    subtitle: "Civilization",
    color: "#65795a",
  },
  {
    id: "toulon",
    name: "Battle of Toulon",
    subtitle: "Toulon",
    color: "#7a8992",
  },
];

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
    mapPresets: structuredClone(INITIAL_MAP_PRESETS),
  };
}
