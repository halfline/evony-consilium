import { teamFingerprint } from "./team-collaboration.js";
import { profileFingerprint } from "./player-document.js";

const byId = (items = []) => new Map(items.map((item) => [item.id, item]));
const changed = (a, b) => JSON.stringify(a) !== JSON.stringify(b);
const playerContent = (player) => {
  const { playerSource, x, y, w, h, locked, castleOverride, ...content } =
    player;
  return playerSource
    ? { ...content, playerFileId: playerSource.fileId }
    : content;
};
const playerChanged = (a, b) =>
  profileFingerprint(playerContent(a)) !== profileFingerprint(playerContent(b));

export function teamCreationActivity(account) {
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    account: account?.email || account?.sub || "Unknown Google account",
    changes: ["Created team"],
  };
}

export function teamChanges(before, after) {
  const changes = [];
  if (before.title !== after.title)
    changes.push(`Renamed team to ${after.title}`);
  for (const [key, description] of [
    ["projectLogo", "Updated team logo"],
    ["discordUrl", "Updated team Discord link"],
    ["customAssets", "Updated custom assets"],
    ["mapPresets", "Updated map presets"],
  ])
    if (changed(before[key], after[key])) changes.push(description);
  for (const [label, key] of [
    ["player", "keeps"],
    ["subcity", "subcities"],
    ["map", "maps"],
  ]) {
    const old = byId(before[key]);
    const next = byId(after[key]);
    for (const [id, item] of next) {
      const previous = old.get(id);
      if (!previous) changes.push(`Added ${label} ${item.name}`);
      else if (
        label === "player"
          ? playerChanged(previous, item)
          : changed(previous, item)
      )
        changes.push(`Updated ${label} ${item.name}`);
    }
    for (const [id, item] of old)
      if (!next.has(id)) changes.push(`Removed ${label} ${item.name}`);
  }
  if (!changes.length && teamFingerprint(before) !== teamFingerprint(after))
    changes.push("Updated team settings or formation");
  return changes;
}

export function appendTeamActivity(
  before,
  after,
  account,
  { sync = false } = {},
) {
  const changes = sync
    ? [
        JSON.stringify(before.teamNotes) !== JSON.stringify(after.teamNotes)
          ? "Updated published team notes"
          : "Synced player files into the team",
      ]
    : teamChanges(before, after);
  if (!changes.length) return after;
  return {
    ...after,
    activityLog: [
      ...(after.activityLog || []),
      {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        account: account?.email || account?.sub || "Unknown Google account",
        changes,
      },
    ],
  };
}
