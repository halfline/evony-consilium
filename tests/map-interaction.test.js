import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyPlan } from "../web/src/domain/plan.js";
import { bindMapInteraction } from "../web/src/ui/map-interaction.js";

test("pending keep placement commits only a free tile", () => {
  const plan = createEmptyPlan();
  plan.keeps.push({ id: "keep", x: null, y: null, w: 2, h: 2 });
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0 }) };
  let pending = "keep", message = "", at = { x: 1200, y: 0 };
  bindMapInteraction({
    canvas, renderer: { world: () => at }, getPlan: () => plan,
    getPending: () => pending, resetPending: () => { pending = null; },
    mutate: (change) => change(plan), toast: (text) => { message = text; },
  });
  canvas.onpointerdown({ button: 0, clientX: 0, clientY: 0 });
  assert.match(message, /free tile/);
  assert.equal(plan.keeps[0].x, null);
  at = { x: 600, y: 600 };
  canvas.onpointerdown({ button: 0, clientX: 0, clientY: 0 });
  assert.deepEqual([plan.keeps[0].x, plan.keeps[0].y], [600, 600]);
  assert.equal(pending, null);
});
