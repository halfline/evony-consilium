import { ProjectAccessError } from "./google/drive.js";

// Resolve folder/file grants and load the authoritative team document.
// Picker remains an explicit user action; this service has no DOM dependencies.
export async function loadTeamFiles({
  drive,
  picker,
  folder,
  authorizeFiles = () => {},
}) {
  let project;
  try {
    project = await drive.project(folder);
  } catch (error) {
    if (
      !(error instanceof ProjectAccessError) &&
      ![403, 404].includes(error.status)
    )
      throw error;
    authorizeFiles();
    const selected = await picker.files(
      folder.kind === "file" || folder.teamFileId ? null : folder,
      folder.teamFileId
        ? { id: folder.teamFileId }
        : folder.kind === "file"
          ? folder
          : null,
    );
    project = await drive.project(
      folder.kind === "file" || folder.teamFileId
        ? { ...selected[0], kind: "file" }
        : folder,
      selected,
    );
  }
  const loaded = await drive.load(project.file);
  project.folder.name = loaded.plan.title;
  project.folder.logo = loaded.plan.projectLogo || "";
  loaded.file.resourceKey ||= project.file.resourceKey || "";
  project.folder.teamFileId = loaded.file.id;
  project.folder.teamFileResourceKey = loaded.file.resourceKey;
  return { project, file: loaded.file, plan: loaded.plan };
}
