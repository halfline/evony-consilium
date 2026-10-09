import { canPlace } from "../domain/placement.js";
import { previewPlacementMove, movePlacements, removePlacements } from "../domain/placement-commands.js";

export function bindMapInteraction({
  canvas, renderer, getPlan, terrainFor = () => null,
  getPending, resetPending, canEdit = () => true,
  mutate, commit, toast, select = () => {}, openSubcity = () => {},
  openPlayer = () => {},
  getSelection = () => null,
  undo = () => {},
  group = new Set(),
  groupChanged = () => {},
}) {
  let pan = null;
  let drag = null;
  let band = null;
  function cancel() {
    for (const state of [pan, drag, band])
      if (state?.pointerId !== undefined && canvas.hasPointerCapture(state.pointerId))
        canvas.releasePointerCapture(state.pointerId);
    pan = drag = band = null;
    renderer.preview = renderer.previews = renderer.selectionBox = null;
    renderer.draw();
  }
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
    if ((event.ctrlKey || event.metaKey) && !getPending()) {
      const id = renderer.hit(pt.x, pt.y);
      const entity = [...getPlan().keeps, ...getPlan().structures, ...getPlan().obstacles]
        .find((item) => item.id === id);
      if (!entity || entity.locked || entity.x === null) return;
      if (!group.size && getSelection() && getSelection() !== id)
        group.add(getSelection());
      if (group.has(id)) group.delete(id);
      else group.add(id);
      select(null);
      groupChanged();
      renderer.draw();
      return;
    }
    if (event.shiftKey && !getPending()) {
      group.clear();
      select(null);
      band = { pt, pointerId: event.pointerId };
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    const cityId = renderer.hitSubcity?.(pt.x, pt.y);
    if (cityId && !getPending()) {
      openSubcity(cityId);
      return;
    }
    if (!getPending()) {
      const id = renderer.hit(pt.x, pt.y);
      if (!group.has(id)) group.clear();
      select(id);
      if (id) {
        const entity = [...getPlan().keeps, ...getPlan().structures, ...getPlan().obstacles]
          .find((item) => item.id === id);
        if (canEdit() && entity && !entity.locked) {
          const members = group.has(id)
            ? [...getPlan().keeps, ...getPlan().structures, ...getPlan().obstacles]
              .filter((item) => group.has(item.id) && !item.locked && item.x !== null)
            : [entity];
          drag = { pt, entity, members, pointerId: event.pointerId, moved: false };
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
    if (band) {
      const pt = point(event);
      const box = {
        x: Math.min(pt.x, band.pt.x), y: Math.min(pt.y, band.pt.y),
        w: Math.abs(pt.x - band.pt.x), h: Math.abs(pt.y - band.pt.y),
      };
      renderer.selectionBox = box;
      group.clear();
      for (const entity of [...getPlan().keeps, ...getPlan().structures, ...getPlan().obstacles]) {
        if (entity.x === null || entity.locked) continue;
        const center = renderer.screen(entity.x + entity.w / 2, entity.y + entity.h / 2);
        if (center.x >= box.x && center.x <= box.x + box.w &&
          center.y >= box.y && center.y <= box.y + box.h)
          group.add(entity.id);
      }
      groupChanged();
      renderer.draw();
      return;
    }
    if (drag) {
      const pt = point(event);
      const start = renderer.world(drag.pt.x, drag.pt.y);
      const end = renderer.world(pt.x, pt.y);
      const dx = Math.round(end.x - start.x), dy = Math.round(end.y - start.y);
      drag.moved = drag.moved || dx !== 0 || dy !== 0;
      const preview = previewPlacementMove(
        getPlan(), drag.members, dx, dy, terrainFor(getPlan().map));
      renderer.previews = preview.positions.map((item) => ({ ...item, valid: preview.valid }));
      renderer.preview = renderer.previews.find((item) => item.id === drag.entity.id);
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
    if (band) {
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      band = null;
      renderer.selectionBox = null;
      renderer.draw();
      return;
    }
    if (drag) {
      const box = canvas.getBoundingClientRect();
      const outside = event.clientX < box.left || event.clientX > box.right ||
        event.clientY < box.top || event.clientY > box.bottom;
      if (!canceled && drag.moved && outside) {
        commit(removePlacements(getPlan(), new Set(drag.members.map((item) => item.id))));
        group.clear();
        groupChanged();
        select(null);
      } else if (!canceled && drag.moved && renderer.preview?.valid)
        commit(movePlacements(getPlan(), renderer.previews || [renderer.preview],
          terrainFor(getPlan().map)));
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      drag = null;
      renderer.preview = null;
      renderer.previews = null;
      renderer.draw();
      return;
    }
    if (pan?.pointerId === event.pointerId && canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId);
    pan = null;
  };
  canvas.onpointerup = (event) => endPan(event);
  canvas.onpointercancel = () => cancel();
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
    const arrow = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0],
      ArrowUp: [0, -1], ArrowDown: [0, 1],
    }[event.key];
    if (arrow && canEdit() && getSelection()) {
      event.preventDefault();
      const entity = [...getPlan().keeps, ...getPlan().structures, ...getPlan().obstacles]
        .find((item) => item.id === getSelection());
      if (!entity || entity.locked || entity.x === null) return;
      try {
        commit(movePlacements(getPlan(), [{ id: entity.id,
          x: entity.x + arrow[0], y: entity.y + arrow[1] }],
        terrainFor(getPlan().map)));
      } catch (error) { toast(error.message, true); }
      return;
    }
    if (event.key !== "Delete" || !canEdit() || (!getSelection() && !group.size)) return;
    event.preventDefault();
    commit(removePlacements(getPlan(), group.size ? group : new Set([getSelection()])));
    group.clear();
    select(null);
    groupChanged();
  };
  return {
    cancel,
    dispose() {
      cancel();
      for (const name of ["ondblclick", "onpointerdown", "onpointermove", "onpointerup",
        "onpointercancel", "onwheel", "onkeydown"])
        canvas[name] = null;
    },
  };
}
