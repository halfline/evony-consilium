const SCREENS = new Set([
  "project",
  "players",
  "alts",
  "player",
  "subcities",
  "maps",
  "formation",
]);
export function parseRoute(hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const screen = params.get("screen") || "project";
  return {
    team: params.get("team"),
    ...(params.get("resourceKey")
      ? { resourceKey: params.get("resourceKey") }
      : {}),
    screen: SCREENS.has(screen) ? screen : "project",
    player: params.get("player"),
    map: params.get("map"),
  };
}
export function routeHash(route) {
  const params = new URLSearchParams();
  for (const field of ["team", "resourceKey", "screen", "player", "map"])
    if (route[field]) params.set(field, route[field]);
  return "#" + params;
}
export function createNavigation({
  getRoute,
  applyRoute,
  ready,
  host = window,
}) {
  let applying = false;
  const pending = parseRoute(host.location.hash);
  function apply(route) {
    if (!ready()) return;
    applying = true;
    try {
      applyRoute(route);
    } finally {
      applying = false;
    }
  }
  host.addEventListener("popstate", () =>
    apply(parseRoute(host.location.hash)),
  );
  return {
    changed() {
      if (applying || !ready()) return;
      const hash = routeHash(getRoute());
      if (host.location.hash !== hash) host.history.pushState(null, "", hash);
    },
    opened() {
      const current = getRoute();
      const route = parseRoute(host.location.hash);
      if (route.team === current.team) apply(route);
      host.history.replaceState(null, "", routeHash(getRoute()));
    },
    pending,
  };
}
