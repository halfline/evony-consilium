import { canPlace } from "../domain/placement.js";
import {
  previewPlacementMove,
  movePlacements,
  removePlacements,
} from "../domain/placement-commands.js";

export function bindMapInteraction({
  canvas,
  renderer,
  getPlan,
  terrainFor = () => null,
  getPending,
  resetPending,
  canEdit = () => true,
  mutate,
  commit,
  toast,
  select,
  openSubcity = () => {},
  openPlayer,
  entities,
  selected,
  undo,
  group,
  groupChanged = () => {},
  coordinates = () => {},
}) {
  let drag = null;
  function cancel() {
    if (
      drag?.pointerId !== undefined &&
      canvas.hasPointerCapture(drag.pointerId)
    )
      canvas.releasePointerCapture(drag.pointerId);
    drag = null;
    renderer.selectionBox = null;
    renderer.preview = null;
    renderer.previews = null;
    canvas.style.cursor = "default";
  }
  function removeObjects(ids) {
    commit(removePlacements(getPlan(), ids));
    group.clear();
    select(null);
    resetPending();
  }
  const point = (ev) => {
    const r = canvas.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };
  canvas.ondblclick = (ev) => {
    if (getPending() || ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
    const pt = point(ev);
    const id = renderer.hit(pt.x, pt.y);
    if (!getPlan().keeps.some((keep) => keep.id === id)) return;
    drag = null;
    renderer.preview = null;
    renderer.previews = null;
    resetPending();
    openPlayer(id);
  };
  canvas.onpointerdown = (ev) => {
    if (ev.button !== 0) return;
    canvas.focus();
    const pt = point(ev);
    const cityId = renderer.hitSubcity?.(pt.x, pt.y);
    if (cityId && !getPending() && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey) {
      openSubcity(cityId);
      return;
    }
    if (getPending() && canEdit()) {
      const e = entities().find((e) => e.id === getPending());
      const w = renderer.world(pt.x, pt.y);
      const x = Math.floor(w.x),
        y = Math.floor(w.y);
      if (e && canPlace(e, x, y, getPlan(), [], terrainFor(getPlan().map))) {
        mutate((p) => {
          const target = [...p.keeps, ...p.structures, ...p.obstacles].find(
            (k) => k.id === getPending(),
          );
          target.x = x;
          target.y = y;
        });
        resetPending();
      } else toast("Choose a free tile within the map.", true);
      return;
    }
    if (ev.ctrlKey || ev.metaKey) {
      const id = renderer.hit(pt.x, pt.y);
      const target = entities().find((e) => e.id === id);
      if (!target || target.locked || target.x === null) return;
      if (!group.size) {
        const current = selected();
        if (current && !current.locked && current.x !== null)
          group.add(current.id);
      }
      if (group.has(id)) group.delete(id);
      else group.add(id);
      select(null);
      renderer.draw();
      return;
    }
    if (ev.shiftKey) {
      group.clear();
      select(null);
      drag = { pt, band: true, pointerId: ev.pointerId };
      canvas.setPointerCapture(ev.pointerId);
      return;
    }
    const id = renderer.hit(pt.x, pt.y);
    if (!group.has(id)) group.clear();
    if (id) select(id);
    const e = entities().find((e) => e.id === id);
    drag = {
      pt,
      last: pt,
      pointerId: ev.pointerId,
      id: canEdit() && e && !e.locked ? id : null,
      blocked: canEdit() && Boolean(e?.locked),
      origin: e ? { x: e.x, y: e.y } : null,
      members: entities()
        .filter(
          (target) =>
            !target.locked &&
            target.x !== null &&
            (group.has(id) ? group.has(target.id) : target.id === id),
        )
        .map((target) => ({ ...target })),
      camera: { ...renderer.camera },
      moved: false,
    };
    canvas.setPointerCapture(ev.pointerId);
  };
  canvas.onpointermove = (event) => {
    if (canvas.style) {
      const pt = point(event);
      canvas.style.cursor = getPending()
        ? "crosshair"
        : renderer.hit(pt.x, pt.y)
          ? "grab"
          : "default";
    }
    if (renderer.world) {
      const pt = point(event);
      const world = renderer.world(pt.x, pt.y);
      coordinates({ x: Math.floor(world.x), y: Math.floor(world.y) });
    }
    if (getPending() && canEdit()) {
      const entity = entities().find((item) => item.id === getPending());
      if (entity) {
        const pt = point(event),
          world = renderer.world(pt.x, pt.y);
        const x = Math.floor(world.x),
          y = Math.floor(world.y);
        renderer.preview = {
          ...entity,
          x,
          y,
          valid: canPlace(
            entity,
            x,
            y,
            getPlan(),
            [],
            terrainFor(getPlan().map),
          ),
        };
        renderer.draw();
      }
      return;
    }
    if (drag?.band) {
      const pt = point(event);
      const box = {
        x: Math.min(pt.x, drag.pt.x),
        y: Math.min(pt.y, drag.pt.y),
        w: Math.abs(pt.x - drag.pt.x),
        h: Math.abs(pt.y - drag.pt.y),
      };
      renderer.selectionBox = box;
      group.clear();
      for (const entity of entities()) {
        if (entity.x === null || entity.locked) continue;
        const center = renderer.screen(
          entity.x + entity.w / 2,
          entity.y + entity.h / 2,
        );
        if (
          center.x >= box.x &&
          center.x <= box.x + box.w &&
          center.y >= box.y &&
          center.y <= box.y + box.h
        )
          group.add(entity.id);
      }
      groupChanged();
      renderer.draw();
      return;
    }
    if (!drag) return;
    const pt = point(event);
    drag.moved ||= Math.hypot(pt.x - drag.pt.x, pt.y - drag.pt.y) > 4;
    if (drag?.id) {
      const start = renderer.world(drag.pt.x, drag.pt.y);
      const end = renderer.world(pt.x, pt.y);
      const dx = Math.round(end.x - start.x),
        dy = Math.round(end.y - start.y);
      const preview = previewPlacementMove(
        getPlan(),
        drag.members,
        dx,
        dy,
        terrainFor(getPlan().map),
      );
      renderer.previews = preview.positions.map((item) => ({
        ...item,
        valid: preview.valid,
      }));
      renderer.preview = renderer.previews.find((item) => item.id === drag.id);
      canvas.style.cursor = "grabbing";
      renderer.draw();
      return;
    }
    if (drag.blocked) return;
    renderer.camera.x = drag.camera.x - (pt.x - drag.pt.x) / drag.camera.zoom;
    renderer.camera.y = drag.camera.y - (pt.y - drag.pt.y) / drag.camera.zoom;
    canvas.style.cursor = "grabbing";
    renderer.draw();
  };
  canvas.onpointerup = (event) => {
    if (!drag) return;
    if (drag?.band) {
      if (canvas.hasPointerCapture(event.pointerId))
        canvas.releasePointerCapture(event.pointerId);
      drag = null;
      renderer.selectionBox = null;
      renderer.draw();
      return;
    }
    if (drag?.id) {
      const box = canvas.getBoundingClientRect();
      const pt = point(event);
      const width = box.width ?? box.right - box.left;
      const height = box.height ?? box.bottom - box.top;
      const outside = pt.x < 0 || pt.y < 0 || pt.x > width || pt.y > height;
      const preview = renderer.preview;
      const beyondMap =
        preview &&
        (preview.x + preview.w <= 0 ||
          preview.y + preview.h <= 0 ||
          preview.x > getPlan().extent ||
          preview.y > getPlan().extent);
      if (drag.moved && (outside || beyondMap)) {
        removeObjects(new Set(drag.members.map((item) => item.id)));
      } else if (drag.moved && renderer.preview?.valid) {
        try {
          commit(
            movePlacements(
              getPlan(),
              renderer.previews || [renderer.preview],
              terrainFor(getPlan().map),
            ),
          );
        } catch (error) {
          toast(error.message, true);
        }
      } else if (drag.moved && renderer.preview)
        toast(
          "Position blocked. The selection stayed at its original location.",
          true,
        );
    }
    if (drag?.blocked && drag.moved)
      toast("Unlock this position before moving it.");
    if (
      drag.pointerId === event.pointerId &&
      canvas.hasPointerCapture(event.pointerId)
    )
      canvas.releasePointerCapture(event.pointerId);
    drag = null;
    renderer.preview = null;
    renderer.previews = null;
    canvas.style.cursor = "default";
    renderer.draw();
  };
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
  const keydown = (ev) => {
    if (!canEdit()) return;
    if (ev.target.closest("input,select,textarea")) return;
    if (ev.key === "Escape") {
      resetPending();
      group.clear();
      cancel();
      renderer.draw();
      return;
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") {
      ev.preventDefault();
      undo();
      return;
    }
    if (ev.target !== canvas) return;
    if (ev.key === "Delete" || ev.key === "Backspace") {
      ev.preventDefault();
      removeObjects(group.size ? group : new Set([selected()?.id]));
      return;
    }
    if (["+", "="].includes(ev.key)) {
      ev.preventDefault();
      renderer.zoom(1.2);
    } else if (ev.key === "-") {
      ev.preventDefault();
      renderer.zoom(1 / 1.2);
    } else if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(ev.key)
    ) {
      ev.preventDefault();
      const e = selected();
      if (!e || e.locked || e.x === null) return;
      const x =
          e.x + (ev.key === "ArrowRight" ? 1 : ev.key === "ArrowLeft" ? -1 : 0),
        y = e.y + (ev.key === "ArrowDown" ? 1 : ev.key === "ArrowUp" ? -1 : 0);
      if (canPlace(e, x, y, getPlan(), [], terrainFor(getPlan().map)))
        mutate((p) => {
          const t = [...p.keeps, ...p.structures, ...p.obstacles].find(
            (k) => k.id === e.id,
          );
          t.x = x;
          t.y = y;
        });
      else toast("That tile is occupied or outside the map.", true);
    }
  };
  document.addEventListener("keydown", keydown);
  return {
    cancel,
    dispose() {
      cancel();
      document.removeEventListener("keydown", keydown);
      for (const event of [
        "ondblclick",
        "onpointerdown",
        "onpointermove",
        "onpointerup",
        "onpointercancel",
        "onwheel",
      ])
        canvas[event] = null;
    },
  };
}
