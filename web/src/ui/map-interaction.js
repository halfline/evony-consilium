import { canPlace } from "../domain/placement.js";

export function bindMapInteraction({
  canvas, renderer, getPlan, terrainFor = () => null,
  getPending, resetPending, canEdit = () => true,
  mutate, toast,
}) {
  canvas.onpointerdown = (event) => {
    if (event.button !== 0 || !getPending() || !canEdit()) return;
    const box = canvas.getBoundingClientRect();
    const world = renderer.world(event.clientX - box.left, event.clientY - box.top);
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
}
