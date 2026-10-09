import { view } from "./dom.js";
export function createTeamScreen({ root, getPlan, mutate, status }) {
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
  function render() {
    const plan = getPlan();
    $("edit-project-name").value = plan.title;
  }
  return { render };
}
