import { view } from "./dom.js";
// Players editing and formation planning share project data, but never share a screen.
export function createPlannerScreens(
  root,
  onChange,
  playerList = () => "players",
) {
  const $ = view(root);
  let current = "project";
  function show(screen, notify = true) {
    current = screen;
    $("maps-return-arrow").hidden = screen !== "formation";
    root
      .querySelector('[data-screen="maps"]')
      .setAttribute(
        "aria-label",
        screen === "formation" ? "Back to maps" : "Maps",
      );
    $("player-screen").hidden = screen !== "player";
    $("players-return-arrow").hidden =
      screen !== "player" || playerList() !== "players";
    $("alts-return-arrow").hidden =
      screen !== "player" || playerList() !== "alts";
    root
      .querySelector('[data-screen="alts"]')
      .setAttribute(
        "aria-label",
        screen === "player" && playerList() === "alts"
          ? "Back to alts"
          : "Alts",
      );
    root
      .querySelector('[data-screen="players"]')
      .setAttribute(
        "aria-label",
        screen === "player" && playerList() === "players"
          ? "Back to players"
          : "Players",
      );
    $("project-screen").hidden = screen !== "project";
    $("alts-screen").hidden = screen !== "alts";
    $("alts-search-control").hidden = screen !== "alts";
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
            ? playerList()
            : screen);
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    for (const action of root.querySelectorAll("[data-map-action]"))
      action.hidden = screen !== "formation";
    if (notify) onChange(screen);
  }
  for (const button of root.querySelectorAll("[data-screen]"))
    button.onclick = () => show(button.dataset.screen);
  return {
    show,
    refresh: () => show(current, false),
    current: () => current,
    isProject: () => current === "project",
    isPlayers: () =>
      current === "players" || current === "alts" || current === "player",
    isPlayer: () => current === "player",
    isMaps: () => current === "maps",
    isSubcities: () => current === "subcities",
  };
}
