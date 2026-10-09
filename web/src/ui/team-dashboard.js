import { view } from "./dom.js";
export function createTeamDashboard({ root, getPlan, navigate }) {
  const $ = view(root);
  for (const screen of ["players", "subcities", "maps"])
    $("team-" + screen).onclick = () => navigate(screen);
  function render() {
    const plan = getPlan();
    for (const [screen, value] of [
      ["player", plan.keeps.length],
      ["subcity", plan.subcities?.length || 0],
      ["map", plan.maps?.length || 0],
    ])
      $("team-" + screen + "-count").textContent = value;
  }
  return { render };
}
