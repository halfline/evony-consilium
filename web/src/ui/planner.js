import { TeamStore } from "../application/team-store.js";
import { TeamEntry } from "./team-entry.js";
import { createTeamScreen } from "./team-screen.js";
import { createReadOnlyView } from "./read-only-view.js";
import { createSaveControls } from "./save-controls.js";
import { createNotifier } from "./notifications.js";
import { validatePlan } from "../domain/validation.js";
import { $ } from "./dom.js";
import { createCatalogBrowser } from "./catalog-browser.js";
import { createPlayerWorkflow } from "./player-workflow.js";
import { createSubcitiesScreen } from "./subcities-screen.js";
import { createMapsScreen } from "./maps-screen.js";
import { MapRenderer } from "../rendering/map-renderer.js";
import { createPlayerSubcities } from "./player-subcities.js";
import { removePlayer } from "../domain/players.js";
import { createMapPlan, removeMapPlan } from "../domain/map-plans.js";

export function createPlanner({ catalog, avatarCatalog }, { createWorkspace }) {
  const store = new TeamStore(catalog);
  const toast = createNotifier($("toast"));
  const getPlan = () => store.plan;
  let workspace, entry, players, playerSubcities;
  let screen = "project";
  const access = createReadOnlyView(
    $("planner"),
    () => store.readOnly,
    () => !!players?.canEditPlayer(),
  );
  const catalogBrowser = createCatalogBrowser({
    root: $("catalog-dialog"),
    variantDialog: $("variant-dialog"),
    assets: store.assets,
    getCatalog: () => catalog,
    selected: () => players?.selected() || null,
  });
  function showScreen(next) {
    if (!["project", "players", "player", "subcities", "maps", "formation"].includes(next)) return;
    screen = next;
    for (const name of ["project", "players", "subcities", "maps"]) {
      const active = name === screen || (name === "players" && screen === "player") || (name === "maps" && screen === "formation");
      $(name + "-screen").hidden = name !== screen;
      const tab = document.querySelector(`[data-screen="${name}"]`);
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-pressed", String(active));
    }
    if (screen === "player") $("players-screen").hidden = true;
    $("player-screen").hidden = screen !== "player";
    $("formation-screen").hidden = screen !== "formation";
    $("players-return-arrow").hidden = screen !== "player";
    $("players-search-control").hidden = screen !== "players";
    $("subcities-search-control").hidden = screen !== "subcities";
    if (screen === "players") players.renderList();
    if (screen === "player") players.renderProfile();
    if (screen === "player") playerSubcities?.render();
    if (screen === "subcities") subcities.render();
    if (screen === "maps") mapsScreen.enter();
    if (screen === "formation") requestAnimationFrame(() => {
      renderer.resize();
      renderer.fit();
    });
  }
  const team = createTeamScreen({
    root: $("project-screen"),
    getPlan,
    canEdit: () => !store.readOnly,
    unlock: () => workspace.unlockTeam(),
    mutate: (change) => store.mutate(change),
    context: () => workspace?.key(),
    navigate: showScreen,
    status: toast,
  });
  const subcities = createSubcitiesScreen({
    root: $("subcities-screen"),
    search: $("subcities-search"),
    dialog: $("subcity-dialog"),
    browser: $("subcity-browser-dialog"),
    ownerBrowser: $("subcity-owner-dialog"),
    getAvatars: () => avatarCatalog,
    getPlan,
    getCatalog: () => catalog,
    locate: () => toast("Add a Server map to locate subcities.", true),
    canEdit: () => !store.readOnly,
    commit: (plan) => store.commit(plan),
    context: () => workspace?.key(),
    status: toast,
  });
  const mapsScreen = createMapsScreen({
    root: $("maps-screen"),
    dialog: $("add-map-dialog"),
    getPlan,
    canEdit: () => !store.readOnly,
    add: (type, name) => {
      store.commit(createMapPlan(getPlan(), type, name));
      showScreen("formation");
    },
    open: (id) => {
      store.openMap(id);
      showScreen("formation");
    },
    remove: (id) => store.commit(removeMapPlan(getPlan(), id)),
    status: toast,
  });
  const renderer = new MapRenderer($("map"), getPlan);
  function render() {
    $("plan-title").value = getPlan().title;
    $("undo").disabled = !store.canUndo;
    team.render();
    subcities.render();
    mapsScreen.render();
    const activeMap = getPlan().maps.find(({ id }) => id === getPlan().activeMapId);
    $("map-name").textContent = activeMap?.name || "";
    renderer.draw();
    players?.renderList();
    if (screen === "player") players?.renderProfile();
    if (screen === "player") playerSubcities?.render();
    access.render();
  }
  store.subscribe(({ kind }) => {
    if (kind === "edit" || kind === "undo") workspace?.persist();
    render();
  });
  $("plan-title").onchange = () =>
    store.mutate((plan) => {
      plan.title = $("plan-title").value.trim() || "Alliance formation";
    });
  $("undo").onclick = () => store.undo();
  document.querySelector('[data-screen="project"]').onclick = () => showScreen("project");
  const playersTab = document.querySelector('[data-screen="players"]');
  playersTab.hidden = false;
  playersTab.onclick = () => showScreen("players");
  const subcitiesTab = document.querySelector('[data-screen="subcities"]');
  subcitiesTab.hidden = false;
  subcitiesTab.onclick = () => showScreen("subcities");
  const mapsTab = document.querySelector('[data-screen="maps"]');
  mapsTab.hidden = false;
  mapsTab.onclick = () => showScreen("maps");
  $("team-players").hidden = false;
  $("team-subcities").hidden = false;
  $("team-maps").hidden = false;
  for (const button of document.querySelectorAll("[data-close]"))
    button.onclick = () => $(button.dataset.close).close();
  $("project-screen").hidden = false;
  render();
  workspace = createWorkspace({
    getPlan,
    getPlayer: () => players?.selected(),
    commitPlan: (plan) => store.commit(plan),
    validatePlan: (plan) => validatePlan(plan, catalog),
    setReadOnly: (value) => {
      store.readOnly = value;
      render();
    },
    openPlan: (plan) => store.replace(plan, { force: true }),
    changed: createSaveControls({
      button: $("drive-save"),
      reload: $("project-reload"),
      status: $("team-save-status"),
    }),
    expired: () => entry.show("login"),
    canCheck: () => !entry?.busy && !$("planner").hidden && !document.hidden,
    status: toast,
    playersChanged: () => players?.renderList(),
  });
  players = createPlayerWorkflow({
    roots: {
      list: $("players-screen"),
      profile: $("player-screen"),
      add: $("add-player-dialog"),
      avatars: $("avatar-dialog"),
      sync: $("player-sync-dialog"),
    },
    search: $("players-search"),
    getPlan,
    getAvatars: () => avatarCatalog,
    assets: store.assets,
    catalog,
    browseCastle: catalogBrowser.open,
    getWorkspace: () => workspace,
    remove: (id) => store.commit(removePlayer(getPlan(), id)),
    status: toast,
    navigate: showScreen,
    refreshAccess: () => access.render(),
  });
  playerSubcities = createPlayerSubcities({
    root: $("player-screen"),
    dialog: $("assign-subcity-dialog"),
    getPlan,
    getPlayerId: () => players.selected()?.id,
    types: () => catalog.subcityTypes || [],
    canEdit: () => !store.readOnly,
    commit: (plan) => store.commit(plan),
    openSubcity: subcities.open,
    addSubcity: subcities.add,
    context: () => workspace?.key(),
    status: toast,
  });
  $("player-form").querySelector('[data-player-tab="subcities"]').hidden = false;
  entry = new TeamEntry({
    header: $("planner").querySelector(".topbar"),
    root: $("entry"),
    planner: $("planner"),
    toast: $("toast"),
    workspace,
    status: toast,
    opened: () => {
      showScreen("project");
      render();
    },
  });
  return { start: () => entry.start() };
}
