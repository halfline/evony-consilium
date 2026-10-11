import { string } from "./constraints.js";

export const NOTE_MIME = "application/vnd.evony-consilium.note+json";
export const NOTE_INDEX_MIME =
  "application/vnd.evony-consilium.notes-index+json";
export const NOTE_SUFFIX = ".note.consilium.json";
export const noteSubject = (player, teamId) =>
  player.playerSource?.fileId
    ? `player:${player.playerSource.fileId}`
    : `team:${teamId}:player:${player.id}`;
// Notes made before an embedded profile gets a central file keep their identity.
export const noteMatchesPlayer = (subject, player, teamId) =>
  subject === noteSubject(player, teamId) ||
  subject === `team:${teamId}:player:${player.id}`;
export function fileId(value) {
  if (typeof value !== "string" || !/^[\w-]{1,200}$/.test(value))
    throw new Error("Invalid note file ID.");
  return value;
}
export function validateNote(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Invalid note.");
  const note = Object.fromEntries(
    [
      "id",
      "subject",
      "title",
      "body",
      "scope",
      "teamFileId",
      "author",
      "createdAt",
      "updatedAt",
    ]
      .filter((key) => input[key] !== undefined)
      .map((key) => [key, structuredClone(input[key])]),
  );
  fileId(note.id);
  string(note.subject, 500, "note subject");
  if (!/^(player:[\w-]+|team:[\w-]+:player:[\w-]+)$/.test(note.subject))
    throw new Error("Invalid note subject.");
  string(note.title, 120, "note title");
  string(note.body, 50000, "note text");
  if (!note.body.trim()) throw new Error("Write some note text.");
  if (!["personal", "team"].includes(note.scope))
    throw new Error("Invalid note audience.");
  if (note.scope === "team") fileId(note.teamFileId);
  else if (note.teamFileId)
    throw new Error("Personal notes cannot be published to a team.");
  string(note.author, 200, "note author");
  for (const key of ["createdAt", "updatedAt"])
    if (
      typeof note[key] !== "string" ||
      !Number.isFinite(Date.parse(note[key]))
    )
      throw new Error("Invalid note date.");
  return note;
}
export function noteDocument(note) {
  return {
    format: "evony-consilium-note",
    schema: 1,
    note: validateNote(note),
  };
}
export function readNoteDocument(data) {
  if (data?.format !== "evony-consilium-note" || data.schema !== 1)
    throw new Error("Choose a Consilium note file.");
  return validateNote(data.note);
}
export const noteFilename = (note) =>
  `Note - ${(note.title.trim() || "Untitled").replace(/[\u0000-\u001f/\\]/g, " ")}${NOTE_SUFFIX}`;
// The body is one conflict unit. Identity, subject, and audience come from the source.
export function mergeNote(base, local, remote, resolution = null) {
  const note = structuredClone(remote),
    conflicts = [];
  for (const key of ["title", "body"]) {
    if (local[key] === base[key]) continue;
    if (remote[key] !== base[key] && remote[key] !== local[key]) {
      conflicts.push(key);
      if (resolution === "remote") continue;
    }
    note[key] = local[key];
  }
  return { note, conflicts };
}
export function validateNoteIndex(data) {
  if (
    data?.format !== "evony-consilium-notes-index" ||
    data.schema !== 1 ||
    !Array.isArray(data.links) ||
    data.links.length > 2000
  )
    throw new Error("Invalid personal notes index.");
  const next = structuredClone(data),
    ids = new Set();
  for (const link of next.links) {
    fileId(link.id);
    if (ids.has(link.id)) throw new Error("Duplicate note attachment.");
    ids.add(link.id);
    string(link.subject, 500, "note subject");
    if (!/^(player:[\w-]+|team:[\w-]+:player:[\w-]+)$/.test(link.subject))
      throw new Error("Invalid note subject.");
    string(link.resourceKey, 200, "note resource key");
  }
  if (next.folder) fileId(next.folder.id);
  return next;
}
export function validateTeamNotes(notes = []) {
  if (!Array.isArray(notes) || notes.length > 1000)
    throw new Error("Too many team notes.");
  const ids = new Set();
  return notes.map((item) => {
    fileId(item.id);
    fileId(item.playerId);
    string(item.resourceKey, 200, "note resource key");
    if (ids.has(item.id)) throw new Error("Duplicate team note.");
    ids.add(item.id);
    const cache = item.noteCache;
    const note = cache && validateNote(cache.note);
    if (!note || note.scope !== "team")
      throw new Error("Only team notes belong in the team cache.");
    if (
      !/^\d{1,100}$/.test(cache.version) ||
      !Number.isFinite(Date.parse(cache.syncedAt))
    )
      throw new Error("Invalid team note revision.");
    return {
      id: item.id,
      playerId: item.playerId,
      resourceKey: item.resourceKey || "",
      noteCache: { note, version: cache.version, syncedAt: cache.syncedAt },
    };
  });
}
export function newerNoteCache(a, b) {
  if (!a || !b) return a || b;
  if (a.note.id !== b.note.id) return null;
  if (a.version !== b.version)
    return BigInt(a.version) > BigInt(b.version) ? a : b;
  return Date.parse(a.syncedAt) >= Date.parse(b.syncedAt) ? a : b;
}
export function applyNoteCaches(plan, updates, { attach = false } = {}) {
  const next = structuredClone(plan);
  for (const update of validateTeamNotes(updates)) {
    const player = next.keeps.find((row) => row.id === update.playerId);
    if (!player) continue;
    if (
      !noteMatchesPlayer(
        update.noteCache.note.subject,
        player,
        update.noteCache.note.teamFileId,
      )
    )
      continue;
    const existing = next.teamNotes?.find((row) => row.id === update.id);
    if (!existing) {
      if (attach) (next.teamNotes ||= []).push(structuredClone(update));
    } else if (
      existing.playerId === update.playerId &&
      newerNoteCache(existing.noteCache, update.noteCache) === update.noteCache
    )
      existing.noteCache = structuredClone(update.noteCache);
  }
  return next;
}
