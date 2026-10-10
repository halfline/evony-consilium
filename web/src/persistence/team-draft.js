// Storage keys and stale-draft decisions are shared by loading and saving.
export const teamDraftKey = (account, folder, file) =>
  `${account}:${folder}:${file}`;
export function resolveTeamDraft({
  sharedPlan,
  file,
  cached,
  discardDraft = false,
}) {
  const restored = !discardDraft && !!cached?.dirty;
  return {
    plan: restored ? cached.plan : sharedPlan,
    file: { ...file, version: restored ? cached.baseVersion : file.version },
    restored,
    stale: restored && cached.baseVersion !== file.version,
    basePlan: restored
      ? cached.basePlan ||
        (cached.baseVersion === file.version ? sharedPlan : null)
      : sharedPlan,
  };
}
