import { canPlace } from "../domain/placement.js";

export function bindMapInteraction({
  canvas, renderer, getPlan, terrainFor = () => null,
  getPending, resetPending, canEdit = () => true,
  mutate, toast, select = () => {},
}) {
  let pan = null;
  const point = (event) => {
    const box = canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };
  canvas.onpointerdown = (event) => {
    if (event.button !== 0) return;
    const pt = point(event);
    if (!getPending()) {
      const id = renderer.hit(pt.x, pt.y);
      select(id);
      if (id) return;
      pan = { pt, camera: { ...renderer.camera }, pointerId: event.pointerId };
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    if (!canEdit()) return;
    const world = renderer.world(pt.x, pt.y);
    const x = Math.floor(world.x), y = Math.floor(world.y);
    const entity = getPlan().keeps.find((keep) => keep.id === getPending());
    if (!entity || !canPlace(entity, x, y, getPlan(), [], terrainFor(getPlan().map))) {
      toast("Choose a free tile within the map.", true);
      return;
    }
    mutate((plan) => {
      const keep = plan.keeps.find((item) => item.id === entity.id);
      keep.x = x;
      keep.y = y;
    });
    resetPending();
  };
  canvas.onpointermove = (event) => {
    if (!pan) return;
    const pt = point(event);
    renderer.camera.x = pan.camera.x - (pt.x - pan.pt.x) / pan.camera.zoom;
    renderer.camera.y = pan.camera.y - (pt.y - pan.pt.y) / pan.camera.zoom;
    renderer.draw();
  };
  const endPan = (event) => {
    if (pan?.pointerId === event.pointerId && canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId);
    pan = null;
  };
  canvas.onpointerup = endPan;
  canvas.onpointercancel = endPan;
  canvas.onwheel = (event) => {
    event.preventDefault();
    const pt = point(event);
    renderer.zoom(Math.exp(-event.deltaY * 0.001), pt.x, pt.y);
  };
}
