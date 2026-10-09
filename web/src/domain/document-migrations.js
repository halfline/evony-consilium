// Normalize historical records before current-schema validation. Never mutate input.
export function migratePlan(input) {
  if (!input || input.version !== 1)
    throw new Error("This is not a supported formation plan (version 1).");
  const plan = structuredClone(input);
  plan.rallyManual ??= !!plan.rallyId;
  for (const map of plan.maps || [])
    if (map?.layout) map.layout.rallyManual ??= !!map.layout.rallyId;
  if (plan.subcities === undefined) plan.subcities = [];
  if (Array.isArray(plan.subcities))
    for (const city of plan.subcities)
      if (city && typeof city === "object" && city.ownerId === undefined)
        city.ownerId = null;
  return plan;
}
export function readTeamDocument(input) {
  if (
    input?.format !== "evony-consilium-team" ||
    input.schema !== 1 ||
    !input.plan
  )
    throw new Error("This is not a supported Consilium team file.");
  return structuredClone(input.plan);
}
