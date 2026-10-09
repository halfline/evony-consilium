import { view } from "./dom.js";

export function bindMapViewControls({ root, renderer, getPlan, selected }) {
  const $ = view(root);
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
  $("map-zoom-controls").hidden = false;
  return {
    render({ zoom }) {
      $("zoom-level").textContent = Math.round(zoom * 100) + "%";
    },
  };
}
