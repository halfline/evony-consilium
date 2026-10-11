import { readTeamDocument } from "../web/src/domain/document-migrations.js";
import {
  applyPlayerProfile,
  readPlayerDocument,
  validatePlayerSource,
} from "../web/src/domain/player-document.js";
import { applyProfileCaches } from "../web/src/domain/team-collaboration.js";
import { fileId } from "../web/src/domain/note-document.js";
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

// Read only explicitly linked profiles. Folder listing supplies inexpensive
// revision checks, never automatic roster membership.
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
  const sources = plan.keeps
    .filter((player) => player.playerSource)
    .map((player) => ({
      kind: "player",
      id: player.playerSource.fileId,
      player,
    }));
  const players = [];
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
      cached = source.player.playerSource;
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
      if (BigInt(file.version) <= BigInt(cached.version)) continue;
      const resource = {
        id: file.id,
        resourceKey: file.resourceKey || cached.resourceKey || "",
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
      if (BigInt(current.file.version) <= BigInt(cached.version)) continue;
      const syncedAt = new Date(now()).toISOString();
      const profile = readPlayerDocument(current.document),
        player = applyPlayerProfile(source.player, profile);
      player.playerSource = {
        fileId: file.id,
        resourceKey: resource.resourceKey,
        version: current.file.version,
        baseline: profile,
        syncedAt,
      };
      players.push(player);
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
  // Each retry starts from the latest shared document. Removed players
  // and changed source links are never restored by collected cache updates.
  for (let attempt = 0; attempt < 3; attempt++) {
    const next = applyProfileCaches(plan, players);
    report.players = next.keeps.filter(
      (player, i) => JSON.stringify(player) !== JSON.stringify(plan.keeps[i]),
    ).length;
    if (!report.players) return report;
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
