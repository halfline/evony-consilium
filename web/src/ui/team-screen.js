import { createTeamDashboard } from "./team-dashboard.js";
import { view } from "./dom.js";
export function createTeamScreen({ root, getPlan, mutate, status, navigate, canEdit = () => true, unlock = async () => {} }) {
  const $ = view(root);
  $("edit-project-name").onchange = () => {
    const title = $("edit-project-name").value.trim();
    if (!title) {
      status("Enter a team name.", true);
      render();
      return;
    }
    mutate((plan) => {
      plan.title = title;
    });
  };
  $("team-unlock").onclick = async () => {
    $("team-unlock").disabled = true;
    try {
      await unlock();
      status("Team administration unlocked.");
    } catch (error) {
      status(error.message, true);
    } finally {
      $("team-unlock").disabled = false;
      render();
    }
  };
  const dashboard = createTeamDashboard({
    root,
    getPlan,
    navigate,
  });
  function render() {
    const plan = getPlan();
    $("team-unlock").hidden = canEdit();
    $("edit-project-name").value = plan.title;
    dashboard.render();
  }
  return { render };
}
