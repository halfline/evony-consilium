import { canPlace } from "./placement.js";

export function autoFormation(plan, terrain = null) {
  const next = structuredClone(plan);
  const leader = next.keeps.find((k) => k.id === next.rallyId);
  if (!leader) throw new Error("Choose a rally setter first.");
  next.formation = "rings";
  next.spacing = 0;
  const cx = leader.x ?? Math.floor(next.extent / 2),
    cy = leader.y ?? Math.floor(next.extent / 2);
  const movable = next.keeps.filter((k) => !k.locked);
  const ignore = movable.map((k) => k.id);
  if (leader.x === null && !leader.locked) {
    let origin = { x: cx, y: cy };
    if (!canPlace(leader, cx, cy, next, ignore, terrain)) {
      const candidates = [];
      for (let dx = -100; dx <= 100; dx++)
        for (let dy = -100; dy <= 100; dy++)
          candidates.push({
            x: cx + dx,
            y: cy + dy,
            distance: dx * dx + dy * dy,
          });
      candidates.sort((a, b) => a.distance - b.distance);
      origin = candidates.find((slot) =>
        canPlace(leader, slot.x, slot.y, next, ignore, terrain),
      );
      if (!origin)
        throw new Error(
          "No free position near the map midpoint. Place the rally setter on a free tile first.",
        );
    }
    leader.x = origin.x;
    leader.y = origin.y;
  }
  if (leader.x === null)
    throw new Error("The locked rally setter must be placed first.");
  const others = movable
    .filter((k) => k.id !== leader.id)
    .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
  for (const k of others) {
    k.x = null;
    k.y = null;
  }
  const slots = [];
  // Euclidean distance gives stronger keeps the nearest available positions,
  // including when locked keeps, alliance buildings, or blocked tiles intervene.
  const radius = Math.min(
    100,
    Math.ceil(Math.sqrt(next.keeps.length)) *
      Math.max(2, ...next.keeps.map((k) => Math.max(k.w, k.h))) +
      10,
  );
  for (let dx = -radius; dx <= radius; dx++)
    for (let dy = -radius; dy <= radius; dy++) {
      if (!dx && !dy) continue;
      slots.push({
        x: leader.x + dx,
        y: leader.y + dy,
        distance: dx * dx + dy * dy,
        angle: Math.atan2(dy, dx),
      });
    }
  slots.sort((a, b) => a.distance - b.distance || a.angle - b.angle);
  for (const k of others) {
    const slot = slots.find((s) => canPlace(k, s.x, s.y, next, [], terrain));
    if (!slot)
      throw new Error(
        "There is not enough free space for every keep. Move the rally setter to a less crowded location.",
      );
    k.x = slot.x;
    k.y = slot.y;
  }
  return next;
}
