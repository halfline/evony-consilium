import { fileId } from "../web/src/domain/note-document.js";

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
