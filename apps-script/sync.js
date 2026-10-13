import { readTeamDocument } from "../web/src/domain/document-migrations.js";
import {
  applyPlayerProfile,
  readPlayerDocument,
  readPlayerActivity,
  validatePlayerSource,
} from "../web/src/domain/player-document.js";
import { applyProfileCaches } from "../web/src/domain/team-collaboration.js";
import { mirrorPlayerActivity } from "../web/src/domain/team-activity.js";
import {
  applyNoteCaches,
  fileId,
  noteMatchesPlayer,
  readNoteDocument,
  validateTeamNotes,
} from "../web/src/domain/note-document.js";
import { MAX_ENTITIES } from "../web/src/domain/entities.js";

const revision = (value) => {
  if (typeof value !== "string" || !/^\d{1,100}$/.test(value))
    throw new Error("Drive did not provide a valid file revision.");
  return value;
};
const inside = (file, folderId) =>
  !file.trashed && file.parents?.includes(folderId);

function teamPlan(loaded, config) {
  if (
    loaded.file.id !== config.teamFileId ||
    !inside(loaded.file, config.folderId) ||
    !loaded.file.capabilities?.canEdit
  )
    throw new Error(
      "The configured team must be writable and in its configured folder.",
    );
  revision(loaded.file.version);
  const plan = readTeamDocument(loaded.document);
  if (
    plan.version !== 1 ||
    !Array.isArray(plan.keeps) ||
    plan.keeps.length > MAX_ENTITIES
  )
    throw new Error("Invalid team roster.");
  const ids = new Set();
  for (const player of plan.keeps) {
    fileId(player.id);
    if (ids.has(player.id)) throw new Error("Duplicate player ID.");
    ids.add(player.id);
    if (player.playerSource) {
      validatePlayerSource(structuredClone(player.playerSource));
      revision(player.playerSource.version);
    }
  }
  validateTeamNotes(plan.teamNotes);
  return plan;
}

export function validateConfig(input) {
  if (
    [input?.teamFileId, input?.folderId].some(
      (id) => typeof id === "string" && id.startsWith("PASTE_"),
    )
  )
    throw new Error(
      "Replace the placeholder team and folder IDs in Config.gs.",
    );
  const config = {
    teamFileId: fileId(input?.teamFileId),
    folderId: fileId(input?.folderId),
    teamResourceKey: input.teamResourceKey || "",
    folderResourceKey: input.folderResourceKey || "",
    intervalMinutes: input.intervalMinutes ?? 5,
    maxSourcesPerRun: input.maxSourcesPerRun ?? 100,
  };
  if (config.teamFileId === config.folderId)
    throw new Error("Use separate IDs for the team document and its folder.");
  for (const key of ["teamResourceKey", "folderResourceKey"])
    if (typeof config[key] !== "string" || !/^[\w-]{0,200}$/.test(config[key]))
      throw new Error("Invalid Drive resource key.");
  if (![1, 5, 10, 15, 30].includes(config.intervalMinutes))
    throw new Error("Choose a 1, 5, 10, 15, or 30 minute interval.");
  if (
    !Number.isInteger(config.maxSourcesPerRun) ||
    config.maxSourcesPerRun < 1 ||
    config.maxSourcesPerRun > 500
  )
    throw new Error("Choose between 1 and 500 sources per run.");
  return config;
}

// Read only explicitly linked profiles and already-published notes. Folder
// listing supplies inexpensive revision checks, never automatic attachment.
export function syncTeam({
  drive,
  config: input,
  cursor = 0,
  dryRun = false,
  now = Date.now,
  deadline = Infinity,
}) {
  const config = validateConfig(input),
    team = { id: config.teamFileId, resourceKey: config.teamResourceKey },
    folder = { id: config.folderId, resourceKey: config.folderResourceKey };
  const report = {
    dryRun,
    inspected: 0,
    players: 0,
    notes: 0,
    activity: 0,
    written: false,
    deferred: false,
    warnings: [],
  };
  const warn = (kind, id, reason) => report.warnings.push({ kind, id, reason });
  const folderMeta = drive.metadata(folder);
  if (
    folderMeta.trashed ||
    folderMeta.mimeType !== "application/vnd.google-apps.folder"
  )
    throw new Error(
      "The configured folder is unavailable or is not a Drive folder.",
    );
  let loaded = drive.load(team),
    plan = teamPlan(loaded, config);
  const children = new Map(
    drive.children(folder).map((file) => [file.id, file]),
  );
  const sources = [
    ...plan.keeps
      .filter((player) => player.playerSource)
      .map((player) => ({
        kind: "player",
        id: player.playerSource.fileId,
        player,
      })),
    ...(plan.teamNotes || []).map((note) => ({
      kind: "note",
      id: note.id,
      record: note,
    })),
  ];
  const players = [],
    notes = [],
    activity = [];
  const start =
    Number.isSafeInteger(cursor) && cursor >= 0 && sources.length
      ? cursor % sources.length
      : 0;
  const count = Math.min(sources.length, config.maxSourcesPerRun);
  // Leave time to publish a partial batch instead of repeatedly discarding
  // collected updates on teams whose whole roster cannot fit in one pass.
  const collectionDeadline = Number.isFinite(deadline)
    ? deadline - Math.min(20000, Math.max(0, (deadline - now()) / 4))
    : Infinity;
  for (let i = 0; i < count; i++) {
    if (now() >= collectionDeadline) {
      report.deferred = true;
      break;
    }
    const source = sources[(start + i) % sources.length],
      file = children.get(source.id),
      cached =
        source.kind === "player"
          ? source.player.playerSource
          : source.record.noteCache;
    report.inspected++;
    if (!file || !inside(file, config.folderId)) {
      warn(
        source.kind,
        source.id,
        "Source unavailable in the team folder; cached copy retained.",
      );
      continue;
    }
    try {
      revision(file.version);
      if (
        BigInt(file.version) < BigInt(cached.version) ||
        (file.version === cached.version &&
          (source.kind !== "player" || cached.activityVersion === file.version))
      )
        continue;
      const resource = {
        id: file.id,
        resourceKey:
          file.resourceKey ||
          (source.kind === "player"
            ? cached.resourceKey
            : source.record.resourceKey) ||
          "",
      };
      const current = drive.load(resource);
      revision(current.file.version);
      if (
        current.file.id !== source.id ||
        !inside(current.file, config.folderId)
      )
        throw new Error(
          "Source moved out of the team folder; cached copy retained.",
        );
      if (
        BigInt(current.file.version) < BigInt(cached.version) ||
        (current.file.version === cached.version &&
          (source.kind !== "player" ||
            cached.activityVersion === current.file.version))
      )
        continue;
      const syncedAt = new Date(now()).toISOString();
      if (source.kind === "player") {
        const profile = readPlayerDocument(current.document),
          player = applyPlayerProfile(source.player, profile);
        const activityLog = readPlayerActivity(current.document);
        player.playerSource = {
          fileId: file.id,
          resourceKey: resource.resourceKey,
          version: current.file.version,
          baseline: profile,
          syncedAt,
        };
        players.push(player);
        activity.push({
          fileId: file.id,
          version: current.file.version,
          activityLog,
        });
      } else {
        const note = readNoteDocument(current.document),
          player = plan.keeps.find((row) => row.id === source.record.playerId);
        if (
          !player ||
          note.scope !== "team" ||
          note.teamFileId !== team.id ||
          note.id !== cached.note.id ||
          !noteMatchesPlayer(note.subject, player, team.id)
        )
          throw new Error(
            "Note identity, player, or team audience changed; cached copy retained.",
          );
        notes.push({
          ...source.record,
          resourceKey: resource.resourceKey,
          noteCache: { note, version: current.file.version, syncedAt },
        });
      }
    } catch (error) {
      // Authorization and quota failures abort the pass rather than probing
      // every remaining source with the same unusable credentials.
      if (
        error.status === 401 ||
        error.status === 429 ||
        error.status >= 500 ||
        [
          "dailyLimitExceeded",
          "rateLimitExceeded",
          "userRateLimitExceeded",
        ].includes(error.reason)
      )
        throw error;
      warn(
        source.kind,
        source.id,
        error.status
          ? `Drive request failed (${error.status}); cached copy retained.`
          : error.message,
      );
    }
  }
  report.nextCursor = sources.length
    ? (start + report.inspected) % sources.length
    : 0;
  report.deferred ||= report.inspected < sources.length;
  // Each retry starts from the latest shared document. Removed attachments
  // and changed player links are never restored by collected cache updates.
  for (let attempt = 0; attempt < 3; attempt++) {
    const eligibleNotes = notes.filter((update) => {
      const existing = plan.teamNotes?.find((row) => row.id === update.id);
      return (
        existing?.playerId === update.playerId &&
        existing.noteCache.note.id === update.noteCache.note.id
      );
    });
    const next = mirrorPlayerActivity(
      applyNoteCaches(applyProfileCaches(plan, players), eligibleNotes),
      activity,
    );
    report.players = next.keeps.filter(
      (player, i) => JSON.stringify(player) !== JSON.stringify(plan.keeps[i]),
    ).length;
    report.notes = (next.teamNotes || []).filter(
      (note, i) => JSON.stringify(note) !== JSON.stringify(plan.teamNotes[i]),
    ).length;
    const previousActivity = new Map(
      (plan.activityLog || []).map((entry) => [entry.id, entry]),
    );
    report.activity = next.activityLog.filter(
      (entry) =>
        JSON.stringify(entry) !==
        JSON.stringify(previousActivity.get(entry.id)),
    ).length;
    if (!report.players && !report.notes && !report.activity) return report;
    if (dryRun) return report;
    if (now() >= deadline) {
      report.deferred = true;
      report.nextCursor = start;
      return report;
    }
    try {
      drive.save(loaded.file, { ...loaded.document, plan: next });
      report.written = true;
      return report;
    } catch (error) {
      if (![409, 412].includes(error.status) || attempt === 2) throw error;
      loaded = drive.load(team);
      plan = teamPlan(loaded, config);
    }
  }
}
