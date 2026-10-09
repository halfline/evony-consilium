import { canPlace } from "../domain/placement.js";
import { previewPlacementMove, movePlacements, removePlacements } from "../domain/placement-commands.js";

export function bindMapInteraction({
  canvas, renderer, getPlan, terrainFor = () => null,
  getPending, resetPending, canEdit = () => true,
  mutate, commit, toast, select = () => {}, openSubcity = () => {},
  openPlayer = () => {},
  getSelection = () => null,
  entities = () => [...getPlan().keeps, ...getPlan().structures, ...getPlan().obstacles],
  selected = () => entities().find((item) => item.id === getSelection()),
  undo = () => {},
  group = new Set(),
  groupChanged = () => {},
  coordinates = () => {},
}) {
  let drag = null;
  function cancel() {
    for (const state of [drag])
      if (state?.pointerId !== undefined && canvas.hasPointerCapture(state.pointerId))
        canvas.releasePointerCapture(state.pointerId);
    drag = null;
    renderer.preview = renderer.previews = renderer.selectionBox = null;
    if (canvas.style) canvas.style.cursor = "default";
  }
  function removeObjects(ids) {
    commit(removePlacements(getPlan(), ids));
    group.clear();
    select(null);
    groupChanged();
    resetPending?.();
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
    drag = null;
    renderer.preview = null;
    renderer.previews = null;
    resetPending();
    openPlayer(id);
  };
  canvas.onpointerdown = (event) => {
    if (event.button !== 0) return;
    canvas.focus?.();
    const pt = point(event);
    const cityId = renderer.hitSubcity?.(pt.x, pt.y);
    if (cityId && !getPending() && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      openSubcity(cityId);
      return;
    }
    if (getPending() && canEdit()) {
      const world = renderer.world(pt.x, pt.y);
      const x = Math.floor(world.x), y = Math.floor(world.y);
      const entity = entities()
        .find((item) => item.id === getPending());
      if (!entity || !canPlace(entity, x, y, getPlan(), [], terrainFor(getPlan().map))) {
        toast("Choose a free tile within the map.", true);
        return;
      }
      mutate((plan) => {
        const target = [...plan.keeps, ...plan.structures, ...plan.obstacles]
          .find((item) => item.id === entity.id);
        target.x = x;
        target.y = y;
      });
      resetPending();
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      const id = renderer.hit(pt.x, pt.y);
      const entity = entities()
        .find((item) => item.id === id);
      if (!entity || entity.locked || entity.x === null) return;
      if (!group.size && selected() && !selected().locked && selected().x !== null)
        group.add(selected().id);
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
      drag = { pt, pointerId: event.pointerId, band: true };
      canvas.setPointerCapture(event.pointerId);
      return;
    }
    if (!getPending()) {
      const id = renderer.hit(pt.x, pt.y);
      if (!group.has(id)) group.clear();
      select(id);
      if (id) {
        if (!canEdit()) {
          drag = { pt, camera: { ...renderer.camera }, pointerId: event.pointerId, pan: true };
          canvas.setPointerCapture(event.pointerId);
          return;
        }
        const entity = entities()
          .find((item) => item.id === id);
        if (canEdit() && entity?.locked) {
          drag = { pt, pointerId: event.pointerId, blocked: true, moved: false };
          canvas.setPointerCapture(event.pointerId);
          return;
        }
        if (canEdit() && entity && !entity.locked) {
          const members = group.has(id)
            ? entities()
              .filter((item) => group.has(item.id) && !item.locked && item.x !== null)
            : [entity];
          drag = {
            pt,
            id: entity.id,
            members: members.map((member) => ({ ...member })),
            pointerId: event.pointerId,
            moved: false,
          };
          canvas.setPointerCapture(event.pointerId);
        }
        return;
      }
      drag = { pt, camera: { ...renderer.camera }, pointerId: event.pointerId, pan: true };
      canvas.setPointerCapture(event.pointerId);
      return;
    }
  };
  canvas.onpointermove = (event) => {
    if (canvas.style) {
      const pt = point(event);
      canvas.style.cursor = getPending()
        ? "crosshair"
        : renderer.hit?.(pt.x, pt.y) ? "grab" : "default";
    }
    if (renderer.world) {
      const pt = point(event);
      const world = renderer.world(pt.x, pt.y);
      coordinates({ x: Math.floor(world.x), y: Math.floor(world.y) });
    }
    if (getPending() && canEdit()) {
      const entity = entities()
        .find((item) => item.id === getPending());
      if (entity) {
        const pt = point(event), world = renderer.world(pt.x, pt.y);
        const x = Math.floor(world.x), y = Math.floor(world.y);
        renderer.preview = { ...entity, x, y,
          valid: canPlace(entity, x, y, getPlan(), [], terrainFor(getPlan().map)) };
        renderer.draw();
      }
      return;
    }
    if (drag?.blocked) {
      const pt = point(event);
      drag.moved ||= Math.hypot(pt.x - drag.pt.x, pt.y - drag.pt.y) > 4;
      return;
    }
    if (drag?.band) {
      const pt = point(event);
      const box = {
        x: Math.min(pt.x, drag.pt.x), y: Math.min(pt.y, drag.pt.y),
        w: Math.abs(pt.x - drag.pt.x), h: Math.abs(pt.y - drag.pt.y),
      };
      renderer.selectionBox = box;
      group.clear();
      for (const entity of entities()) {
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
    if (drag && !drag.pan && !drag.blocked && !drag.band) {
      const pt = point(event);
      const start = renderer.world(drag.pt.x, drag.pt.y);
      const end = renderer.world(pt.x, pt.y);
      const dx = Math.round(end.x - start.x), dy = Math.round(end.y - start.y);
      drag.moved ||= Math.hypot(pt.x - drag.pt.x, pt.y - drag.pt.y) > 4;
      const preview = previewPlacementMove(
        getPlan(), drag.members, dx, dy, terrainFor(getPlan().map));
      renderer.previews = preview.positions.map((item) => ({ ...item, valid: preview.valid }));
      renderer.preview = renderer.previews.find((item) => item.id === drag.id);
      if (canvas.style) canvas.style.cursor = "grabbing";
      renderer.draw();
      return;
    }
    if (!drag?.pan) return;
    const pt = point(event);
    renderer.camera.x = drag.camera.x - (pt.x - drag.pt.x) / drag.camera.zoom;
    renderer.camera.y = drag.camera.y - (pt.y - drag.pt.y) / drag.camera.zoom;
    if (canvas.style) canvas.style.cursor = "grabbing";
    renderer.draw();
  };
  const endPan = (event, canceled = false) => {
    if (drag?.blocked) {
      if (!canceled && drag.moved)
        toast("Unlock this position before moving it.");
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      drag = null;
      if (canvas.style) canvas.style.cursor = "default";
      return;
    }
    if (drag?.band) {
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      drag = null;
      renderer.selectionBox = null;
      renderer.draw();
      return;
    }
    if (drag && !drag.pan && !drag.blocked && !drag.band) {
      const box = canvas.getBoundingClientRect();
      const pt = point(event);
      const width = box.width ?? box.right - box.left;
      const height = box.height ?? box.bottom - box.top;
      const outside = pt.x < 0 || pt.y < 0 || pt.x > width || pt.y > height;
      const preview = renderer.preview;
      const beyondMap = preview &&
        (preview.x + preview.w <= 0 || preview.y + preview.h <= 0 ||
          preview.x > getPlan().extent || preview.y > getPlan().extent);
      if (!canceled && drag.moved && (outside || beyondMap)) {
        removeObjects(new Set(drag.members.map((item) => item.id)));
      } else if (!canceled && drag.moved && renderer.preview?.valid) {
        try {
          commit(movePlacements(getPlan(), renderer.previews || [renderer.preview],
            terrainFor(getPlan().map)));
        } catch (error) {
          toast(error.message, true);
        }
      }
      else if (!canceled && drag.moved && renderer.preview)
        toast("Position blocked. The selection stayed at its original location.", true);
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      drag = null;
      renderer.preview = null;
      renderer.previews = null;
      if (canvas.style) canvas.style.cursor = "default";
      renderer.draw();
      return;
    }
    if (drag?.pan && drag.pointerId === event.pointerId && canvas.hasPointerCapture(event.pointerId))
      canvas.releasePointerCapture(event.pointerId);
    drag = null;
    if (canvas.style) canvas.style.cursor = "default";
  };
  canvas.onpointerup = (event) => endPan(event);
  canvas.onpointercancel = () => {
    group.clear();
    groupChanged();
    cancel();
    renderer.draw();
  };
  canvas.onwheel = (event) => {
    event.preventDefault();
    const pt = point(event);
    renderer.zoom(Math.exp(-event.deltaY * 0.001), pt.x, pt.y);
  };
  canvas.onkeydown = (event) => {
    if (!canEdit()) return;
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
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      renderer.zoom(1.2);
      return;
    }
    if (event.key === "-") {
      event.preventDefault();
      renderer.zoom(1 / 1.2);
      return;
    }
    const arrow = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0],
      ArrowUp: [0, -1], ArrowDown: [0, 1],
    }[event.key];
    if (arrow && canEdit() && selected()) {
      event.preventDefault();
      const entity = selected();
      if (!entity || entity.locked || entity.x === null) return;
      try {
        commit(movePlacements(getPlan(), [{ id: entity.id,
          x: entity.x + arrow[0], y: entity.y + arrow[1] }],
        terrainFor(getPlan().map)));
      } catch (error) { toast(error.message, true); }
      return;
    }
    if (!["Delete", "Backspace"].includes(event.key) || !canEdit() ||
        (!selected() && !group.size)) return;
    event.preventDefault();
    removeObjects(group.size ? group : new Set([selected().id]));
  };
  const documentKeydown = (event) => {
    if (!canEdit() || event.target === canvas ||
        event.target?.closest?.("input,select,textarea")) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undo();
    } else if (event.key === "Escape") {
      resetPending();
      group.clear();
      groupChanged();
      cancel();
    }
  };
  if (typeof document !== "undefined")
    document.addEventListener("keydown", documentKeydown);
  return {
    cancel,
    dispose() {
      cancel();
      if (typeof document !== "undefined")
        document.removeEventListener("keydown", documentKeydown);
      for (const name of ["ondblclick", "onpointerdown", "onpointermove", "onpointerup",
        "onpointercancel", "onwheel", "onkeydown"])
        canvas[name] = null;
    },
  };
}
