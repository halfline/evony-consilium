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
import { removePlayer } from "../domain/players.js";

export function createPlanner({ catalog, avatarCatalog }, { createWorkspace }) {
  const store = new TeamStore(catalog);
  const toast = createNotifier($("toast"));
  const getPlan = () => store.plan;
  let workspace, entry, players;
  let screen = "project";
  const access = createReadOnlyView($("planner"), () => store.readOnly);
  const catalogBrowser = createCatalogBrowser({
    root: $("catalog-dialog"),
    variantDialog: $("variant-dialog"),
    assets: store.assets,
    getCatalog: () => catalog,
    selected: () => players?.selected() || null,
  });
  function showScreen(next) {
    if (!["project", "players"].includes(next)) return;
    screen = next;
    for (const name of ["project", "players"]) {
      const active = name === screen;
      $(name + "-screen").hidden = !active;
      const tab = document.querySelector(`[data-screen="${name}"]`);
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-pressed", String(active));
    }
    $("players-search-control").hidden = screen !== "players";
    if (screen === "players") players.renderList();
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
  function render() {
    $("plan-title").value = getPlan().title;
    $("undo").disabled = !store.canUndo;
    team.render();
    players?.renderList();
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
  $("team-players").hidden = false;
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
      add: $("add-player-dialog"),
      avatars: $("avatar-dialog"),
    },
    search: $("players-search"),
    getPlan,
    getAvatars: () => avatarCatalog,
    assets: store.assets,
    browseCastle: catalogBrowser.open,
    getWorkspace: () => workspace,
    remove: (id) => store.commit(removePlayer(getPlan(), id)),
    status: toast,
  });
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
