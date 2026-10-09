import { canPlace } from "../domain/placement.js";
import { previewPlacementMove, movePlacements, removePlacements } from "../domain/placement-commands.js";

export function bindMapInteraction({
  canvas, renderer, getPlan, terrainFor = () => null,
  getPending, resetPending, canEdit = () => true,
  mutate, commit, toast, select = () => {}, openSubcity = () => {},
  openPlayer = () => {},
  getSelection = () => null,
  undo = () => {},
}) {
  let pan = null;
  let drag = null;
  const point = (event) => {
    const box = canvas.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };
  canvas.ondblclick = (event) => {
    if (getPending() || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const pt = point(event);
    const id = renderer.hit(pt.x, pt.y);
    if (!getPlan().keeps.some((keep) => keep.id === id)) return;
    resetPending();
    openPlayer(id);
  };
  canvas.onpointerdown = (event) => {
    if (event.button !== 0) return;
    canvas.focus?.();
    const pt = point(event);
    const cityId = renderer.hitSubcity?.(pt.x, pt.y);
    if (cityId && !getPending()) {
      openSubcity(cityId);
      return;
    }
    if (!getPending()) {
      const id = renderer.hit(pt.x, pt.y);
      select(id);
      if (id) {
        const entity = [...getPlan().keeps, ...getPlan().structures, ...getPlan().obstacles]
          .find((item) => item.id === id);
        if (canEdit() && entity && !entity.locked) {
          drag = { pt, entity, pointerId: event.pointerId, moved: false };
          canvas.setPointerCapture(event.pointerId);
        }
        return;
      }
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
    if (drag) {
      const pt = point(event);
      const start = renderer.world(drag.pt.x, drag.pt.y);
      const end = renderer.world(pt.x, pt.y);
      const dx = Math.round(end.x - start.x), dy = Math.round(end.y - start.y);
      drag.moved = drag.moved || dx !== 0 || dy !== 0;
      const preview = previewPlacementMove(
        getPlan(), [drag.entity], dx, dy, terrainFor(getPlan().map));
      renderer.preview = { ...preview.positions[0], valid: preview.valid };
      renderer.draw();
      return;
    }
    if (!pan) return;
    const pt = point(event);
    renderer.camera.x = pan.camera.x - (pt.x - pan.pt.x) / pan.camera.zoom;
    renderer.camera.y = pan.camera.y - (pt.y - pan.pt.y) / pan.camera.zoom;
    renderer.draw();
  };
  const endPan = (event, canceled = false) => {
    if (drag) {
      const box = canvas.getBoundingClientRect();
      const outside = event.clientX < box.left || event.clientX > box.right ||
        event.clientY < box.top || event.clientY > box.bottom;
      if (!canceled && drag.moved && outside) {
        commit(removePlacements(getPlan(), new Set([drag.entity.id])));
        select(null);
      } else if (!canceled && drag.moved && renderer.preview?.valid)
        commit(movePlacements(getPlan(), [renderer.preview], terrainFor(getPlan().map)));
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      drag = null;
      renderer.preview = null;
      renderer.draw();
      return;
    }
    if (pan?.pointerId === event.pointerId && canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId);
    pan = null;
  };
  canvas.onpointerup = (event) => endPan(event);
  canvas.onpointercancel = (event) => endPan(event, true);
  canvas.onwheel = (event) => {
    event.preventDefault();
    const pt = point(event);
    renderer.zoom(Math.exp(-event.deltaY * 0.001), pt.x, pt.y);
  };
  canvas.onkeydown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undo();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      resetPending();
      select(null);
      renderer.preview = null;
      renderer.draw();
      return;
    }
    if (event.key !== "Delete" || !canEdit() || !getSelection()) return;
    event.preventDefault();
    commit(removePlacements(getPlan(), new Set([getSelection()])));
    select(null);
  };
}
