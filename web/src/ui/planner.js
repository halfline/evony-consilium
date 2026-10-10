import { setRallySetter } from "../domain/rally.js";
import { createNavigation } from "./navigation.js";
import { createPlayerSubcities } from "./player-subcities.js";
import { createSubcitiesScreen } from "./subcities-screen.js";
import { createPlacementView } from "./placement-view.js";
import { bindMapViewControls } from "./map-view-controls.js";
import { bindShellControls } from "./shell-controls.js";
import { createSaveControls } from "./save-controls.js";
import { createFormationControls } from "./formation-controls.js";
import { createFormationList } from "./formation-list.js";
import { createPlacementInspector } from "./placement-inspector.js";
import { removePlayer as removePlayerFromPlan } from "../domain/players.js";
import { createPlayerWorkflow } from "./player-workflow.js";
import { PlacementSelection } from "../application/placement-selection.js";
import { TeamStore } from "../application/team-store.js";
import { createTeamScreen } from "./team-screen.js";
import { createMapsScreen } from "./maps-screen.js";
import { createMapPlan, removeMapPlan } from "../domain/map-plans.js";
import { createPlannerScreens } from "./planner-screens.js";
import { $ } from "./dom.js";
import { createNotifier } from "./notifications.js";
import { createCatalogBrowser } from "./catalog-browser.js";
import { bindMapInteraction } from "./map-interaction.js";
import { createDemoPlan } from "../domain/plan.js";
import { validatePlan } from "../domain/validation.js";
import { MapRenderer } from "../rendering/map-renderer.js";
import { createReadOnlyView } from "./read-only-view.js";
import { TeamEntry } from "./team-entry.js";
import { mergeTeamPlans } from "../domain/team-collaboration.js";
import { createTeamConflictControls } from "./team-conflict-controls.js";
export function createPlanner(
  { catalog, avatarCatalog, terrainCatalog },
  { createWorkspace },
) {
  const store = new TeamStore(catalog);
  const assets = store.assets;
  const terrainFor = (id) => terrainCatalog.get(id);
  const readOnlyView = createReadOnlyView(
    $("planner"),
    () => store.readOnly,
    () => !!players?.canEditPlayer(),
  );
  const getPlan = () => store.plan;
  const placement = new PlacementSelection(getPlan);
  let workspace,
    projects,
    renderer,
    placementInspector,
    players,
    formationList,
    formationControls,
    mapViewControls,
    mapInteraction,
    placementView,
    navigation,
    opening = false;
  const playerList = () => (selected()?.ownerId != null ? "alts" : "players");
  const screens = createPlannerScreens(
    $("planner"),
    () => {
      navigation?.changed();
      if (!renderer) return;
      mapInteraction?.cancel();
      if (screens.isProject()) {
        resetPending();
        teamScreen.render();
        return;
      }
      if (screens.isSubcities()) {
        resetPending();
        subcitiesScreen.render();
        return;
      }
      if (screens.isMaps()) {
        mapsScreen.enter();
        return;
      }
      resetPending();
      if (screens.isPlayers() && selected() && !("level" in selected()))
        placement.id = null;
      const entity = selected();
      if (!screens.isPlayers() && entity?.x === null) {
        placementView.place(entity);
      }
      renderInspector();
      requestAnimationFrame(() => {
        renderer.resize();
        if (!screens.isPlayers()) {
          if (entity?.x != null) {
            renderer.camera.zoom = 1;
            renderer.center(entity.x + entity.w / 2, entity.y + entity.h / 2);
          } else renderer.fit();
        }
      });
    },
    playerList,
  );
  const subcitiesScreen = createSubcitiesScreen({
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
    commit,
    context: () => workspace?.key(),
    status: (...args) => toast(...args),
  });
  function locateSubcity(city) {
    const map = getPlan().maps?.find(
      (map) => map.type === "server" || map.layout?.map === "server",
    );
    if (!map) {
      toast("Add a Server map to locate subcities.", true);
      return;
    }
    store.openMap(map.id);
    placement.id = null;
    screens.show("formation");
    requestAnimationFrame(() => {
      renderer.resize();
      renderer.camera.zoom = 1;
      renderer.center(city.x, city.y);
    });
  }
  const playerSubcities = createPlayerSubcities({
    root: $("player-screen"),
    dialog: $("assign-subcity-dialog"),
    getPlan,
    getPlayerId: () => placement.id,
    types: () => catalog.subcityTypes || [],
    canEdit: () => !store.readOnly,
    commit,
    openSubcity: subcitiesScreen.open,
    addSubcity: subcitiesScreen.add,
    context: () => workspace?.key(),
    status: (...args) => toast(...args),
  });
  const mapsScreen = wireMapsScreen();
  function wireMapsScreen() {
    return createMapsScreen({
      dialog: $("add-map-dialog"),
      root: $("maps-screen"),
      getPlan,
      canEdit: () => !store.readOnly,
      add: (type, name) => {
        placement.id = null;
        commit(createMapPlan(getPlan(), type, name, terrainFor(type)));
        mapsScreen.render();
        screens.show("formation");
      },
      open: (id) => {
        if (id !== getPlan().activeMapId) placement.id = null;
        store.openMap(id);
        resetPending();
        screens.show("formation");
      },
      remove: (id) => {
        placement.id = null;
        commit(removeMapPlan(getPlan(), id));
        mapsScreen.enter();
      },
      status: (...args) => toast(...args),
    });
  }
  const teamScreen = wireTeamScreen();
  function wireTeamScreen() {
    return createTeamScreen({
      root: $("project-screen"),
      canEdit: () => !store.readOnly,
      unlock: () => workspace.unlockTeam(),
      getPlan,
      mutate,
      context: () => workspace?.key(),
      getWorkspace: () => workspace,
      navigate: (screen) => screens.show(screen),
      status: (...args) => toast(...args),
    });
  }
  const toast = createNotifier($("toast"));
  const catalogBrowser = createCatalogBrowser({
    variantDialog: $("variant-dialog"),
    root: $("catalog-dialog"),
    assets,
    getCatalog: () => catalog,
    selected: () => players?.draft() || selected(),
  });
  function persist() {
    workspace?.persist();
  }
  function commit(next) {
    return store.commit(next);
  }
  function mutate(change) {
    return store.mutate(change);
  }
  function entities() {
    return placement.entities;
  }
  function selected() {
    return placement.selected;
  }
  function select(id) {
    placementView.select(id);
  }
  function render() {
    const plan = getPlan();
    if (document.activeElement !== $("plan-title"))
      $("plan-title").value = plan.title;
    teamScreen.render();
    formationControls.render();
    mapViewControls.render();
    const activeMap = plan.maps?.find((map) => map.id === plan.activeMapId);
    $("formation-name").textContent = activeMap?.name || "";
    mapsScreen.render();
    subcitiesScreen.render();
    $("undo").disabled = !store.canUndo;
    renderPlayers();
    renderInspector();
    renderer.draw();
  }
  function removePlayer(id) {
    if (placement.id === id) placement.id = null;
    placement.ids.delete(id);
    commit(removePlayerFromPlan(getPlan(), id));
    resetPending();
  }
  function renderPlayers() {
    players.renderList();
    formationList.render();
  }
  function renderInspector() {
    if (
      screens.isPlayer() &&
      !getPlan().keeps.some((player) => player.id === placement.id)
    ) {
      screens.show(playerList());
      return;
    }
    screens.refresh();
    players.renderProfile();
    playerSubcities.render();
    placementInspector.render();
  }
  function resetPending() {
    placementView.reset();
  }
  function bind() {
    bindShellControls($("planner"));
    mapViewControls = bindMapViewControls({
      root: $("formation-screen"),
      toolbar: document.querySelector(".map-toolbar"),
      renderer,
      getPlan,
      selected,
      mutate,
    });
    $("plan-title").onchange = () =>
      mutate(
        (p) => (p.title = $("plan-title").value.trim() || "Alliance formation"),
      );
    $("undo").onclick = () => store.undo();
    $("load-demo").onclick = () => {
      placement.id = null;
      commit(validatePlan(createDemoPlan(catalog), catalog));
      resetPending();
      renderer.fit();
      $("help-dialog").close();
    };
    mapInteraction = bindMapInteraction({
      canvas: $("map"),
      canEdit: () => !store.readOnly,
      renderer,
      group: placement.ids,
      getPlan,
      terrainFor,
      getPending: () => placement.pending,
      entities,
      selected,
      select,
      openSubcity: subcitiesScreen.open,
      openPlayer: (id) => {
        select(id);
        screens.show("player");
      },
      mutate,
      commit,
      resetPending,
      toast,
      undo: () => store.undo(),
      coordinates: ({ x, y }) => {
        $("map-coordinates").textContent = `X: ${x}   Y: ${y}`;
      },
    });
  }

  store.subscribe(({ kind }) => {
    if (kind === "replace") {
      placement.id = null;
      players.resetTag();
    }
    placement.reconcile();
    if (["undo", "replace", "navigate", "refresh"].includes(kind)) {
      mapInteraction?.cancel();
      if (kind === "replace" || kind === "navigate") placement.ids.clear();
      resetPending();
    }
    if (kind === "edit" || kind === "undo") persist();
    render();
  });
  renderer = new MapRenderer($("map"), assets, getPlan, {
    terrainFor,
    subcityTypes: catalog.subcityTypes || [],
    selection: placement,
    onDraw: ({ zoom }) => {
      $("zoom-level").textContent = Math.round(zoom * 100) + "%";
    },
  });
  placementView = createPlacementView({
    root: $("formation-screen"),
    selection: placement,
    renderer,
    refresh: () => {
      renderPlayers();
      renderInspector();
    },
  });
  wirePlayersScreen();
  function wirePlayersScreen() {
    players = createPlayerWorkflow({
      roots: {
        list: $("players-screen"),
        alts: $("alts-screen"),
        profile: $("player-screen"),
        add: $("add-player-dialog"),
        avatars: $("avatar-dialog"),
        sync: $("player-sync-dialog"),
      },
      search: $("players-search"),
      altSearch: $("alts-search"),
      canEditTeam: () => !store.readOnly,
      commitTeam: commit,
      getWorkspace: () => workspace,
      refreshAccess: () => readOnlyView.render(),
      getPlan,
      getAvatars: () => avatarCatalog,
      assets,
      catalog,
      terrainFor,
      selection: placement,
      select,
      remove: removePlayer,
      browseCastle: catalogBrowser.open,
      navigate: (screen) => screens.show(screen),
      status: toast,
    });
  }
  wireFormationScreen();
  function wireFormationScreen() {
    formationList = createFormationList({
      canEdit: () => !store.readOnly,
      setRally: (id) => commit(setRallySetter(getPlan(), id)),
      root: $("formation-screen"),
      getPlan,
      assets,
      getSelection: () => placement.id,
      select,
      place: (entity) => {
        placementView.place(entity);
      },
      center: (entity) =>
        renderer.center(entity.x + entity.w / 2, entity.y + entity.h / 2),
    });
    placementInspector = createPlacementInspector({
      root: $("inspector"),
      canEdit: () => !store.readOnly,
      getPlan,
      terrainFor,
      selected,
      assets,
      catalog,
      browse: catalogBrowser.open,
      commit,
      status: toast,
      applied: resetPending,
      close: () => select(null),
    });
    formationControls = createFormationControls({
      root: $("formation-screen"),
      toolbar: document.querySelector(".map-toolbar"),
      canEdit: () => !store.readOnly,
      assets,
      getPlan,
      terrainFor,
      commit,
      browse: catalogBrowser.open,
      place: (entity, message) => {
        select(entity.id);
        placementView.place(
          entity,
          message || "Click a free tile to place " + entity.name,
        );
      },
      fit: () => renderer.fit(),
      resetPlacement: resetPending,
      status: toast,
    });
  }
  bind();
  render();
  renderer.resize();
  renderer.fit();
  $("loading").hidden = true;
  screens.show("project");
  const teamConflicts = createTeamConflictControls(
    $("team-conflict-dialog"),
    getPlan,
  );
  workspace = createWorkspace({
    getPlan,
    commitPlan: commit,
    refreshPlan: (plan, rebaseHistory) => store.refresh(plan, rebaseHistory),
    applyPlan: (plan, { base, remote }) =>
      store.refresh(
        plan,
        (snapshot) =>
          mergeTeamPlans(base, snapshot, remote, { resolution: "remote" }).plan,
      ),
    resolveTeamConflicts: teamConflicts.resolve,
    validatePlan: (plan) => validatePlan(plan, catalog),
    isEditingPlayer: () => $("add-player-dialog").open,
    playersChanged: () => {
      teamScreen.render();
      players.renderList();
      players.renderProfile();
    },
    getPlayer: () =>
      screens.isPlayer()
        ? getPlan().keeps.find((player) => player.id === placement.id)
        : null,
    setReadOnly: (value) => {
      store.readOnly = value;
      readOnlyView.render();
      teamScreen.render();
      subcitiesScreen.render();
      players.renderProfile();
      playerSubcities.render();
      placementInspector.render();
      formationControls.render();
      formationList.render();
      if (value) {
        resetPending();
        mapInteraction?.cancel();
      }
    },
    openPlan: (data, { preserveView = false } = {}) => {
      teamConflicts.cancel();
      const previousScreen = screens.current();
      const previousPlayer = screens.isPlayer() ? placement.id : null;
      opening = true;
      store.replace(data, { force: true });
      if (preserveView && previousScreen === "player") {
        if (data.keeps.some((player) => player.id === previousPlayer)) {
          placement.id = previousPlayer;
          screens.show("player");
        } else screens.show("players");
      } else screens.show(preserveView ? previousScreen : "project");
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
    expired: () => projects.show("login"),
    canCheck: () => !projects?.busy && !$("planner").hidden && !document.hidden,
    status: toast,
  });
  navigation = createNavigation({
    getRoute: () => ({
      team: workspace.sync.file?.id,
      resourceKey: workspace.sync.file?.resourceKey || null,
      screen: screens.current(),
      player: screens.isPlayer() ? placement.id : null,
      map: screens.current() === "formation" ? getPlan().activeMapId : null,
    }),
    ready: () => !opening && !!workspace.sync.file && !$("planner").hidden,
    applyRoute: (route) => {
      if (route.team !== workspace.sync.file?.id) return;
      if (route.map && getPlan().maps?.some((map) => map.id === route.map))
        store.openMap(route.map);
      if (route.screen === "player") {
        if (!getPlan().keeps.some((player) => player.id === route.player)) {
          screens.show("players");
          return;
        }
        placement.id = route.player;
      }
      screens.show(route.screen);
    },
  });
  projects = new TeamEntry({
    capturePending: () => {
      if (!store.readOnly && document.activeElement === $("plan-title")) {
        const title = $("plan-title").value.trim();
        if (title && title !== getPlan().title)
          mutate((plan) => {
            plan.title = title;
          });
      }
      teamScreen.capturePending();
    },
    header: $("planner").querySelector(".topbar"),
    root: $("entry"),
    planner: $("planner"),
    toast: $("toast"),
    workspace,
    autosave: () => workspace.autosave(),
    opened: () => {
      opening = false;
      navigation.opened();
    },
    initialTeam: navigation.pending.team
      ? {
          id: navigation.pending.team,
          resourceKey: navigation.pending.resourceKey || "",
          kind: "file",
        }
      : null,
    status: toast,
  });
  return { start: () => projects.start() };
}
