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
import { removePlayer as removePlayerFromPlan } from "../domain/players.js";
import { createMapPlan, removeMapPlan } from "../domain/map-plans.js";
import { setRallySetter } from "../domain/rally.js";
import { createPlacementInspector } from "./placement-inspector.js";
import { createFormationControls } from "./formation-controls.js";
import { bindShellControls } from "./shell-controls.js";
import { createDemoPlan } from "../domain/plan.js";

export function createPlanner(
  { catalog, avatarCatalog, terrainCatalog },
  { createWorkspace },
) {
  const store = new TeamStore(catalog);
  const toast = createNotifier($("toast"));
  const getPlan = () => store.plan;
  const terrainFor = (id) => terrainCatalog.get(id);
  let workspace,
    entry,
    players,
    playerSubcities,
    navigation,
    opening = false;
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
    selected: () => players?.draft() || selection.selected || null,
  });
  function showScreen(next) {
    if (
      ![
        "project",
        "players",
        "player",
        "subcities",
        "maps",
        "formation",
      ].includes(next)
    )
      return;
    screens.show(next);
  }
  const screens = createPlannerScreens($("planner"), () => {
    navigation?.changed();
    mapInteraction?.cancel();
    screen = screens.current();
    if (screens.isProject()) {
      placementView.reset();
      teamScreen.render();
      return;
    }
    if (screens.isSubcities()) {
      placementView.reset();
      subcities.render();
      return;
    }
    if (screens.isMaps()) {
      mapsScreen.enter();
      return;
    }
    placementView.reset();
    if (
      !store.readOnly &&
      screens.isPlayers() &&
      !screens.isPlayer() &&
      !getPlan().keeps.length
    )
      players.openAdd();
    if (
      screens.isPlayers() &&
      selection.selected &&
      !("level" in selection.selected)
    )
      selection.id = null;
    const entity = selection.selected;
    if (!screens.isPlayers() && entity?.x === null) placementView.place(entity);
    players?.renderProfile();
    playerSubcities?.render();
    placementInspector?.render();
    requestAnimationFrame(() => {
      renderer.resize();
      if (!screens.isPlayers()) {
        if (entity?.x != null) {
          renderer.camera.zoom = 1;
          renderer.center(entity.x + entity.w / 2, entity.y + entity.h / 2);
        } else renderer.fit();
      }
    });
  });
  const teamScreen = wireTeamScreen();
  function wireTeamScreen() {
    return createTeamScreen({
      root: $("project-screen"),
      getPlan,
      canEdit: () => !store.readOnly,
      unlock: () => workspace.unlockTeam(),
      mutate: (change) => store.mutate(change),
      context: () => workspace?.key(),
      navigate: showScreen,
      status: toast,
    });
  }
  function locateSubcity(city) {
    const map = getPlan().maps.find(
      (map) => map.type === "server" || map.layout?.map === "server",
    );
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
  const mapsScreen = wireMapsScreen();
  function wireMapsScreen() {
    return createMapsScreen({
      root: $("maps-screen"),
      dialog: $("add-map-dialog"),
      getPlan,
      canEdit: () => !store.readOnly,
      add: (type, name) => {
        selection.id = null;
        store.commit(createMapPlan(getPlan(), type, name, terrainFor(type)));
        mapsScreen.render();
        showScreen("formation");
      },
      open: (id) => {
        if (id !== getPlan().activeMapId) selection.id = null;
        store.openMap(id);
        placementView.reset();
        showScreen("formation");
      },
      remove: (id) => {
        selection.id = null;
        store.commit(removeMapPlan(getPlan(), id));
        mapsScreen.enter();
      },
      status: toast,
    });
  }
  let mapViewControls;
  const renderer = new MapRenderer($("map"), store.assets, getPlan, {
    subcityTypes: catalog.subcityTypes || [],
    terrainFor: (id) => terrainCatalog?.get(id),
    selection,
    onDraw: ({ zoom }) => {
      $("zoom-level").textContent = Math.round(zoom * 100) + "%";
    },
  });
  mapViewControls = bindMapViewControls({
    root: $("formation-screen"),
    toolbar: document.querySelector(".map-toolbar"),
    renderer,
    getPlan,
    mutate: (change) => store.mutate(change),
    selected: () =>
      [
        ...getPlan().keeps,
        ...getPlan().structures,
        ...getPlan().obstacles,
      ].find(({ id }) => id === selection.id),
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
    root: $("formation-screen"),
    assets: store.assets,
    getPlan,
    getSelection: () => selection.id,
    group: selection.ids,
    select: selectKeep,
    canEdit: () => !store.readOnly,
    setRally: (id) => store.commit(setRallySetter(getPlan(), id)),
    place: (keep) => placementView.place(keep),
    center: (keep) => renderer.center(keep.x + keep.w / 2, keep.y + keep.h / 2),
  });
  placementInspector = createPlacementInspector({
    root: $("inspector"),
    getPlan,
    catalog,
    assets: store.assets,
    browse: catalogBrowser.open,
    terrainFor: (id) => terrainCatalog?.get(id),
    canEdit: () => !store.readOnly,
    commit: (plan) => store.commit(plan),
    applied: () => placementView.reset(),
    status: toast,
    selected: () =>
      [
        ...getPlan().keeps,
        ...getPlan().structures,
        ...getPlan().obstacles,
      ].find(({ id }) => id === selection.id),
    close: () => selectKeep(null),
  });
  const formationControls = createFormationControls({
    root: $("formation-screen"),
    toolbar: document.querySelector(".map-toolbar"),
    assets: store.assets,
    getPlan,
    browse: catalogBrowser.open,
    terrainFor: (id) => terrainCatalog?.get(id),
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
    canvas: $("map"),
    renderer,
    getPlan,
    terrainFor: (id) => terrainCatalog?.get(id),
    getPending: () => selection.pending,
    resetPending: () => placementView.reset(),
    canEdit: () => !store.readOnly,
    mutate: (change) => store.mutate(change),
    commit: (plan) => store.commit(plan),
    toast,
    select: selectKeep,
    entities: () => selection.entities,
    selected: () => selection.selected,
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
    teamScreen.render();
    subcities.render();
    mapsScreen.render();
    mapViewControls.render();
    const activeMap = getPlan().maps.find(
      ({ id }) => id === getPlan().activeMapId,
    );
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
    if (kind === "replace") {
      selection.id = null;
      players?.resetTag();
    }
    selection.reconcile();
    if (["undo", "replace", "navigate"].includes(kind)) {
      mapInteraction?.cancel();
      if (kind !== "undo") selection.ids.clear();
      placementView.reset();
    }
    if (kind === "edit" || kind === "undo") workspace?.persist();
    render();
  });
  $("plan-title").onchange = () =>
    store.mutate((plan) => {
      plan.title = $("plan-title").value.trim() || "Alliance formation";
    });
  $("undo").onclick = () => store.undo();
  bindShellControls($("planner"));
  $("load-demo").onclick = () => {
    if (store.readOnly) return;
    selection.clear();
    placementView.reset();
    store.commit(validatePlan(createDemoPlan(catalog), catalog));
    renderer.fit();
    $("help-dialog").close();
  };
  $("project-screen").hidden = false;
  render();
  workspace = createWorkspace({
    getPlan,
    getPlayer: () =>
      screens.isPlayer()
        ? getPlan().keeps.find((player) => player.id === selection.id)
        : null,
    isEditingPlayer: () => $("player-form").contains(document.activeElement),
    commitPlan: (plan) => store.commit(plan),
    validatePlan: (plan) => validatePlan(plan, catalog),
    setReadOnly: (value) => {
      store.readOnly = value;
      render();
      if (value) {
        placementView.reset();
        mapInteraction?.cancel();
      }
    },
    openPlan: (plan) => {
      opening = true;
      store.replace(plan, { force: true });
      showScreen("project");
      requestAnimationFrame(() => {
        renderer.resize();
        renderer.fit();
      });
    },
    changed: createSaveControls({
      button: $("drive-save"),
      reload: $("project-reload"),
      status: $("team-save-status"),
    }),
    expired: () => entry.show("login"),
    canCheck: () => !entry?.busy && !$("planner").hidden && !document.hidden,
    status: toast,
    playersChanged: () => {
      teamScreen.render();
      players?.renderList();
      players?.renderProfile();
    },
  });
  function removePlayer(id) {
    if (selection.id === id) selection.id = null;
    selection.ids.delete(id);
    store.commit(removePlayerFromPlan(getPlan(), id));
    placementView.reset();
  }
  wirePlayersScreen();
  function wirePlayersScreen() {
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
      terrainFor: (id) => terrainCatalog?.get(id),
      assets: store.assets,
      catalog,
      browseCastle: catalogBrowser.open,
      getWorkspace: () => workspace,
      selection,
      select: selectKeep,
      remove: removePlayer,
      status: toast,
      navigate: showScreen,
      refreshAccess: () => access.render(),
    });
  }
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
  $("player-form").querySelector('[data-player-tab="subcities"]').hidden =
    false;
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
