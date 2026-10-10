import { ProjectAccessError, isFileAccessError } from "./google/drive.js";

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
    if (!(error instanceof ProjectAccessError) && !isFileAccessError(error))
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

// Folder authorization is separate from authorizing the JSON document inside it.
export async function loadPlayerFolder({
  drive,
  picker,
  project,
  file,
  current = () => {},
  status = () => {},
  interactive = true,
}) {
  const id = file.parents?.[0] || project.folder.id;
  if (!id || id === file.id)
    throw new Error(
      "Move the team file into a Drive folder before managing player files.",
    );
  const resource = {
    id,
    name: project.folder.name,
    resourceKey:
      project.folder.id === id ? project.folder.resourceKey || "" : "",
  };
  let folder;
  try {
    folder = await drive.metadata(resource);
    current();
  } catch (error) {
    current();
    if (!isFileAccessError(error)) throw error;
    if (!interactive)
      throw Object.assign(
        new Error("Team folder access changed. Try adding the player again."),
        { code: "team_folder_picker_needed" },
      );
    status("Choose the central team folder to load and add players.");
    const selected = await picker.folder(resource);
    current();
    if (selected.id !== id) throw new Error("Choose the central team folder.");
    folder = await drive.metadata(selected);
    current();
    folder.resourceKey ||= selected.resourceKey || "";
  }
  if (folder.mimeType !== "application/vnd.google-apps.folder")
    throw new Error("The team file must be inside a Drive folder.");
  folder.resourceKey ||= resource.resourceKey;
  return {
    ...project.folder,
    ...folder,
    teamFileId: file.id,
    teamFileResourceKey: file.resourceKey || "",
  };
}
