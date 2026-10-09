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
import { bindMapViewControls } from "./map-view-controls.js";
import { bindMapInteraction } from "./map-interaction.js";
import { createFormationList } from "./formation-list.js";
import { PlacementSelection } from "../application/placement-selection.js";
import { createPlacementView } from "./placement-view.js";
import { createPlannerScreens } from "./planner-screens.js";
import { createNavigation } from "./navigation.js";
import { createPlayerSubcities } from "./player-subcities.js";
import { removePlayer } from "../domain/players.js";
import { createMapPlan, removeMapPlan } from "../domain/map-plans.js";
import { setRallySetter } from "../domain/rally.js";
import { createPlacementInspector } from "./placement-inspector.js";
import { createFormationControls } from "./formation-controls.js";
import { createDemoPlan } from "../domain/plan.js";

export function createPlanner({ catalog, avatarCatalog, terrain }, { createWorkspace }) {
  const store = new TeamStore(catalog);
  const toast = createNotifier($("toast"));
  const getPlan = () => store.plan;
  let workspace, entry, players, playerSubcities, navigation, opening = false;
  const selection = new PlacementSelection(getPlan);
  let mapInteraction, placementInspector, placementView;
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
    screens.show(next);
  }
  const screens = createPlannerScreens($("planner"), (next) => {
    navigation?.changed();
    if (next !== "formation") {
      mapInteraction?.cancel();
      selection.ids.clear();
      placementView.reset();
      formationList.render();
      placementInspector?.render();
    }
    screen = next;
    if (screen === "players") players.renderList();
    if (screen === "player") players.renderProfile();
    if (screen === "player") playerSubcities?.render();
    if (screen === "subcities") subcities.render();
    if (screen === "maps") mapsScreen.enter();
    if (screen === "formation") requestAnimationFrame(() => {
      renderer.resize();
      renderer.fit();
    });
  });
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
  function locateSubcity(city) {
    const map = getPlan().maps.find((map) => map.layout?.map === "server");
    if (!map) {
      toast("Add a Server map to locate subcities.", true);
      return;
    }
    selection.clear();
    placementView.reset();
    store.openMap(map.id);
    showScreen("formation");
    requestAnimationFrame(() => {
      renderer.resize();
      renderer.camera.zoom = 1;
      renderer.center(city.x, city.y);
    });
  }
  const subcities = createSubcitiesScreen({
    root: $("subcities-screen"),
    search: $("subcities-search"),
    dialog: $("subcity-dialog"),
    browser: $("subcity-browser-dialog"),
    ownerBrowser: $("subcity-owner-dialog"),
    getAvatars: () => avatarCatalog,
    getPlan,
    getCatalog: () => catalog,
    locate: locateSubcity,
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
  let mapViewControls;
  const renderer = new MapRenderer($("map"), getPlan, {
    assets: store.assets,
    subcityTypes: catalog.subcityTypes || [],
    terrainFor: (id) => terrain?.get(id),
    selection,
    onDraw: (state) => mapViewControls?.render(state),
  });
  mapViewControls = bindMapViewControls({
    root: $("formation-screen"), toolbar: document.querySelector(".map-toolbar"), renderer, getPlan,
    mutate: (change) => store.mutate(change),
    selected: () => [...getPlan().keeps, ...getPlan().structures, ...getPlan().obstacles]
      .find(({ id }) => id === selection.id),
  });
  placementView = createPlacementView({
    root: $("formation-screen"),
    selection,
    renderer,
    refresh: () => {
      formationList.render();
      placementInspector?.render();
    },
  });
  function selectKeep(id) {
    placementView.select(id);
  }
  const formationList = createFormationList({
    root: $("formation-screen"), getPlan,
    getSelection: () => selection.id, group: selection.ids, select: selectKeep,
    canEdit: () => !store.readOnly,
    setRally: (id) => store.commit(setRallySetter(getPlan(), id)),
    place: (keep) => placementView.place(keep),
    center: (keep) => renderer.center(keep.x + keep.w / 2, keep.y + keep.h / 2),
  });
  placementInspector = createPlacementInspector({
    root: $("inspector"),
    getPlan, catalog, assets: store.assets, browse: catalogBrowser.open,
    terrainFor: (id) => terrain?.get(id),
    canEdit: () => !store.readOnly,
    commit: (plan) => store.commit(plan),
    status: toast,
    selected: () => [...getPlan().keeps, ...getPlan().structures, ...getPlan().obstacles]
      .find(({ id }) => id === selection.id),
    close: () => selectKeep(null),
  });
  const formationControls = createFormationControls({
    root: $("formation-screen"), toolbar: document.querySelector(".map-toolbar"), getPlan,
    browse: catalogBrowser.open,
    terrainFor: (id) => terrain?.get(id),
    fit: () => renderer.fit(),
    resetPlacement: () => placementView.reset(),
    status: toast,
    canEdit: () => !store.readOnly,
    commit: (plan) => store.commit(plan),
    place: (entity, message) => {
      selectKeep(entity.id);
      placementView.place(entity, message);
    },
  });
  mapInteraction = bindMapInteraction({
    canvas: $("map"), renderer, getPlan,
    terrainFor: (id) => terrain?.get(id),
    getPending: () => selection.pending,
    resetPending: () => placementView.reset(),
    canEdit: () => !store.readOnly,
    mutate: (change) => store.mutate(change),
    commit: (plan) => store.commit(plan), toast,
    select: selectKeep,
    getSelection: () => selection.id,
    group: selection.ids,
    groupChanged: () => formationList.render(),
    undo: () => store.undo(),
    openSubcity: (id) => subcities.open(id),
    openPlayer: (id) => players.open(id),
    coordinates: ({ x, y }) => {
      $("map-coordinates").textContent = `X: ${x} · Y: ${y}`;
    },
  });
  function render() {
    $("plan-title").value = getPlan().title;
    $("undo").disabled = !store.canUndo;
    team.render();
    subcities.render();
    mapsScreen.render();
    mapViewControls.render({ zoom: renderer.camera.zoom });
    const activeMap = getPlan().maps.find(({ id }) => id === getPlan().activeMapId);
    $("formation-name").textContent = activeMap?.name || "";
    renderer.draw();
    formationList.render();
    placementInspector.render();
    formationControls.render();
    $("load-demo").disabled = store.readOnly;
    players?.renderList();
    if (screen === "player") players?.renderProfile();
    if (screen === "player") playerSubcities?.render();
    access.render();
  }
  store.subscribe(({ kind }) => {
    if (["undo", "replace", "navigate"].includes(kind)) {
      mapInteraction?.cancel();
      if (kind === "replace") selection.clear();
      else selection.reconcile();
    }
    if (kind === "edit" || kind === "undo") workspace?.persist();
    render();
  });
  $("plan-title").onchange = () =>
    store.mutate((plan) => {
      plan.title = $("plan-title").value.trim() || "Alliance formation";
    });
  $("undo").onclick = () => store.undo();
  $("help").onclick = () => $("help-dialog").showModal();
  $("load-demo").onclick = () => {
    if (store.readOnly) return;
    selection.clear();
    placementView.reset();
    store.commit(validatePlan(createDemoPlan(catalog), catalog));
    renderer.fit();
    $("help-dialog").close();
  };
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
    openPlan: (plan) => {
      opening = true;
      store.replace(plan, { force: true });
      showScreen("project");
    },
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
    terrainFor: (id) => terrain?.get(id),
    assets: store.assets,
    catalog,
    browseCastle: catalogBrowser.open,
    getWorkspace: () => workspace,
    selection,
    select: selectKeep,
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
  navigation = createNavigation({
    getRoute: () => ({
      team: workspace.sync.file?.id,
      resourceKey: workspace.sync.file?.resourceKey || null,
      screen: screens.current(),
      player: screens.isPlayer() ? selection.id : null,
      map: screens.current() === "formation" ? getPlan().activeMapId : null,
    }),
    ready: () => !opening && !!workspace.sync.file && !$("planner").hidden,
    applyRoute: (route) => {
      if (route.team !== workspace.sync.file?.id) return;
      if (route.map && getPlan().maps?.some((map) => map.id === route.map))
        store.openMap(route.map);
      if (route.screen === "player") {
        if (!getPlan().keeps.some((player) => player.id === route.player)) {
          showScreen("players");
          return;
        }
        selection.id = route.player;
      }
      showScreen(route.screen);
    },
  });
  entry = new TeamEntry({
    header: $("planner").querySelector(".topbar"),
    root: $("entry"),
    planner: $("planner"),
    toast: $("toast"),
    workspace,
    status: toast,
    opened: () => {
      opening = false;
      navigation.opened();
      render();
    },
    initialTeam: navigation.pending.team
      ? {
          id: navigation.pending.team,
          resourceKey: navigation.pending.resourceKey || "",
          kind: "file",
        }
      : null,
  });
  return { start: () => entry.start() };
}
