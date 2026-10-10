import { view } from "./dom.js";
export function createTeamDashboard({ root, getPlan, navigate }) {
  const $ = view(root);
  for (const screen of ["players", "alts", "subcities", "maps"])
    $("team-" + screen).onclick = () => navigate(screen);
  function render() {
    const plan = getPlan();
    for (const [screen, value] of [
      ["player", plan.keeps.filter((player) => player.ownerId == null).length],
      ["alt", plan.keeps.filter((player) => player.ownerId != null).length],
      ["subcity", plan.subcities?.length || 0],
      ["map", plan.maps?.length || 0],
    ])
      $("team-" + screen + "-count").textContent = value;
  }
  return { render };
}
