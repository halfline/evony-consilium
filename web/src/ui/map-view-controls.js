import { view } from "./dom.js";

export function bindMapViewControls({ root, toolbar, renderer, getPlan, selected, mutate }) {
  const $ = view(root, toolbar);
  $("zoom-in").onclick = () => renderer.zoom(1.2);
  $("zoom-out").onclick = () => renderer.zoom(1 / 1.2);
  $("reset-view").onclick = () => {
    const plan = getPlan();
    const entity = selected() || plan.keeps.find(({ id }) => id === plan.rallyId);
    renderer.camera.zoom = 1;
    renderer.center(entity?.x ?? plan.center.x, entity?.y ?? plan.center.y);
  };
  $("fit-map").onclick = () => renderer.fit();
  $("overview-map").onclick = () => renderer.fit(true);
  $("show-grid").onchange = () =>
    mutate((plan) => { plan.showGrid = $("show-grid").checked; });
  $("show-labels").onchange = () =>
    mutate((plan) => { plan.labels = $("show-labels").checked; });
  return {
    render({ zoom }) {
      $("zoom-level").textContent = Math.round(zoom * 100) + "%";
      const plan = getPlan();
      $("show-grid").checked = plan.showGrid;
      $("show-labels").checked = plan.labels;
      const map = plan.mapPresets.find((preset) => preset.id === plan.map);
      $("map-kicker").textContent = map?.subtitle || "";
      $("map-name").textContent = map?.name || "";
    },
  };
}
