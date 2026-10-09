import { view } from "./dom.js";
// Players editing and formation planning share project data, but never share a screen.
export function createPlannerScreens(root, onChange) {
  const $ = view(root);
  let current = "project";
  function show(screen) {
    current = screen;
    $("maps-return-arrow").hidden = screen !== "formation";
    root
      .querySelector('[data-screen="maps"]')
      .setAttribute(
        "aria-label",
        screen === "formation" ? "Back to maps" : "Maps",
      );
    $("player-screen").hidden = screen !== "player";
    $("players-return-arrow").hidden = screen !== "player";
    root
      .querySelector('[data-screen="players"]')
      .setAttribute(
        "aria-label",
        screen === "player" ? "Back to players" : "Players",
      );
    $("project-screen").hidden = screen !== "project";
    $("players-screen").hidden = screen !== "players";
    $("players-search-control").hidden = screen !== "players";
    $("subcities-search-control").hidden = screen !== "subcities";
    $("formation-screen").hidden = screen !== "formation";
    $("maps-screen").hidden = screen !== "maps";
    $("subcities-screen").hidden = screen !== "subcities";
    for (const button of root.querySelectorAll("[data-screen]")) {
      const active =
        button.dataset.screen ===
        (screen === "formation"
          ? "maps"
          : screen === "player"
            ? "players"
            : screen);
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    for (const action of root.querySelectorAll("[data-map-action]"))
      action.hidden = screen !== "formation";
    onChange(screen);
  }
  for (const button of root.querySelectorAll("[data-screen]"))
    button.onclick = () => show(button.dataset.screen);
  return {
    show,
    current: () => current,
    isProject: () => current === "project",
    isPlayers: () => current === "players" || current === "player",
    isPlayer: () => current === "player",
    isMaps: () => current === "maps",
    isSubcities: () => current === "subcities",
  };
}
