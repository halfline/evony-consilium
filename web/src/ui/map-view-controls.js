import { view } from "./dom.js";

export function bindMapViewControls({ root, renderer }) {
  const $ = view(root);
  $("zoom-in").onclick = () => renderer.zoom(1.2);
  $("zoom-out").onclick = () => renderer.zoom(1 / 1.2);
  $("map-zoom-controls").hidden = false;
  return {
    render({ zoom }) {
      $("zoom-level").textContent = Math.round(zoom * 100) + "%";
    },
  };
}
