// The alliance territory is centered on the castle footprint, not its tile origin.
export function hiveBoundaries(plan, assets) {
  const size = plan.hiveSize ?? 18;
  return plan.structures
    .filter(
      (structure) =>
        structure.x !== null && assets.get(structure.skin)?.kind === "alliance",
    )
    .map((structure) => ({
      x: structure.x + (structure.w - size) / 2,
      y: structure.y + (structure.h - size) / 2,
      w: size,
      h: size,
    }));
}
