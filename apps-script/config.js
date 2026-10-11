// Edit the IDs in Config.gs in your own Apps Script project, then run
// configureConsiliumSync. Changing configuration removes your old trigger;
// run installConsiliumSync again after reviewing the preview.
function consiliumConfig_() {
  return {
    teamFileId: "PASTE_TEAM_FILE_ID",
    folderId: "PASTE_TEAM_FOLDER_ID",
    teamResourceKey: "",
    folderResourceKey: "",
    intervalMinutes: 5,
    maxSourcesPerRun: 100,
  };
}
