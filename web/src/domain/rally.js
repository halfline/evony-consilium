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
