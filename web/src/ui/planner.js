import { TeamStore } from "../application/team-store.js";
import { TeamEntry } from "./team-entry.js";
import { createTeamScreen } from "./team-screen.js";
import { createReadOnlyView } from "./read-only-view.js";
import { createSaveControls } from "./save-controls.js";
import { createNotifier } from "./notifications.js";
import { validatePlan } from "../domain/validation.js";
import { $ } from "./dom.js";

export function createPlanner({ catalog }, { createWorkspace }) {
  const store = new TeamStore(catalog);
  const toast = createNotifier($("toast"));
  const getPlan = () => store.plan;
  let workspace, entry;
  const access = createReadOnlyView($("planner"), () => store.readOnly);
  const team = createTeamScreen({
    root: $("project-screen"),
    getPlan,
    canEdit: () => !store.readOnly,
    unlock: () => workspace.unlockTeam(),
    mutate: (change) => store.mutate(change),
    context: () => workspace?.key(),
    navigate: () => {
      toast("Screen unavailable.", true);
    },
    status: toast,
  });
  function render() {
    $("plan-title").value = getPlan().title;
    $("undo").disabled = !store.canUndo;
    team.render();
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
  $("project-screen").hidden = false;
  render();
  workspace = createWorkspace({
    getPlan,
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
  });
  entry = new TeamEntry({
    header: $("planner").querySelector(".topbar"),
    root: $("entry"),
    planner: $("planner"),
    toast: $("toast"),
    workspace,
    status: toast,
  });
  return { start: () => entry.start() };
}
