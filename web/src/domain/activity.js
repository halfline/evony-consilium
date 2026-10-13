import { string } from "./constraints.js";

export function readActivityLog(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("Invalid activity log.");
  const ids = new Set();
  for (const entry of value) {
    if (!entry || typeof entry !== "object")
      throw new Error("Invalid activity entry.");
    string(entry.id, 200, "activity ID");
    string(entry.account, 200, "activity account");
    string(entry.at, 100, "activity time");
    if (
      !entry.id ||
      ids.has(entry.id) ||
      !Number.isFinite(Date.parse(entry.at))
    )
      throw new Error("Invalid activity entry.");
    ids.add(entry.id);
    if (!Array.isArray(entry.changes) || !entry.changes.length)
      throw new Error("Invalid activity changes.");
    for (const change of entry.changes) string(change, 1000, "activity change");
    if (entry.sessionId != null)
      string(entry.sessionId, 200, "activity session");
    if (
      entry.revision !== undefined &&
      (!Number.isSafeInteger(entry.revision) || entry.revision < 1)
    )
      throw new Error("Invalid activity revision.");
    if (entry.source !== undefined) {
      if (entry.source?.kind !== "player")
        throw new Error("Invalid activity source.");
      string(entry.source.fileId, 200, "activity source file");
      string(entry.source.name, 100, "activity source name");
      if (
        entry.source.version !== undefined &&
        (typeof entry.source.version !== "string" ||
          !/^\d{1,100}$/.test(entry.source.version))
      )
        throw new Error("Invalid activity source revision.");
    }
  }
  return structuredClone(value);
}

export function recordActivity(log, account, sessionId, changes) {
  if (!changes.length) return log;
  const actor = account?.email || account?.sub || "Unknown Google account";
  const entry = {
    id: crypto.randomUUID(),
    sessionId: sessionId || null,
    at: new Date().toISOString(),
    account: actor,
    changes: [...new Set(changes)],
  };
  return [...log, entry];
}

export function groupActivityEntries(entries) {
  const groups = [];
  for (const entry of mergeActivityLogs(entries)) {
    const latest = groups[groups.length - 1];
    const changes = entry.changes.map((change) => {
      const summary = change.startsWith("Renamed team to ")
        ? "Renamed team"
        : change;
      return entry.source?.kind === "player"
        ? `${entry.source.name}: ${summary}`
        : summary;
    });
    if (
      entry.sessionId &&
      latest?.sessionId === entry.sessionId &&
      latest.account === entry.account
    ) {
      latest.at = entry.at;
      latest.changes = [...new Set([...latest.changes, ...changes])];
    } else {
      groups.push({
        id: entry.id,
        sessionId: entry.sessionId,
        at: entry.at,
        account: entry.account,
        changes,
      });
    }
  }
  return groups;
}

function newerEntry(previous, entry) {
  if (!previous) return entry;
  const a = previous.source,
    b = entry.source;
  if (
    a?.fileId === b?.fileId &&
    a?.version &&
    b?.version &&
    a.version !== b.version
  )
    return BigInt(a.version) > BigInt(b.version) ? previous : entry;
  if ((previous.revision || 0) !== (entry.revision || 0))
    return (previous.revision || 0) > (entry.revision || 0) ? previous : entry;
  return previous.at > entry.at ? previous : entry;
}

export function mergeActivityLogs(...logs) {
  const entries = new Map();
  for (const log of logs)
    for (const entry of log || [])
      entries.set(entry.id, newerEntry(entries.get(entry.id), entry));
  return [...entries.values()].sort((a, b) => a.at.localeCompare(b.at));
}
