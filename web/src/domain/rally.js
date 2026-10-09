export function defaultRallySetter(plan) {
  return (
    [...plan.keeps].sort(
      (a, b) => b.level - a.level || a.name.localeCompare(b.name),
    )[0]?.id || null
  );
}
export function ensureRallySetter(plan) {
  if (
    !plan.rallyManual ||
    !plan.keeps.some((player) => player.id === plan.rallyId)
  ) {
    plan.rallyId = defaultRallySetter(plan);
    plan.rallyManual = false;
  }
  return plan;
}
export function setRallySetter(plan, id) {
  if (!plan.keeps.some((player) => player.id === id))
    throw new Error("Choose a player on this team.");
  const next = structuredClone(plan);
  next.rallyId = id;
  next.rallyManual = true;
  return next;
}

export function ensureMapRallySetters(plan) {
  ensureRallySetter(plan);
  for (const map of plan.maps || []) {
    const layout = {
      keeps: plan.keeps,
      rallyId: map.layout.rallyId,
      rallyManual: map.layout.rallyManual,
    };
    ensureRallySetter(layout);
    map.layout.rallyId = layout.rallyId;
    map.layout.rallyManual = layout.rallyManual;
  }
  return plan;
}
