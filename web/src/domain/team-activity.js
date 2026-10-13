import { teamFingerprint } from "./team-collaboration.js";
import { profileFingerprint } from "./player-document.js";
import { recordActivity, mergeActivityLogs } from "./activity.js";

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

export function teamCreationActivity(account, sessionId = null) {
  return recordActivity([], account, sessionId, ["Created team"])[0];
}

export function teamLoginActivity(account, sessionId = null) {
  return recordActivity([], account, sessionId, ["Logged in"])[0];
}

export function mirrorPlayerActivity(plan, snapshots) {
  const next = structuredClone(plan);
  const entries = [];
  for (const { fileId, version, activityLog } of snapshots) {
    const player = next.keeps.find(
      (item) => item.playerSource?.fileId === fileId,
    );
    if (!player) continue;
    if (
      version !== undefined &&
      BigInt(version) <= BigInt(player.playerSource.version) &&
      BigInt(version) > BigInt(player.playerSource.activityVersion || "0")
    )
      player.playerSource.activityVersion = version;
    for (const entry of activityLog) {
      const source = { kind: "player", fileId, name: player.name };
      if (version !== undefined) source.version = version;
      entries.push({ ...entry, source });
    }
  }
  return {
    ...next,
    activityLog: mergeActivityLogs(plan.activityLog, entries),
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
  { sync = false, sessionId = null } = {},
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
    activityLog: recordActivity(
      after.activityLog || [],
      account,
      sessionId,
      changes,
    ),
  };
}
