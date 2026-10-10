import { OperationCancelled } from "../cancellation.js";
import { TEAM_MIME, PLAYER_MIME } from "../../domain/drive-documents.js";

class PickerCancelled extends OperationCancelled {
  constructor() {
    super("Google Drive selection cancelled.");
  }
}
let library;
function loadPicker() {
  if (globalThis.google?.picker) return Promise.resolve();
  if (!library)
    library = new Promise((resolve, reject) => {
      const load = () =>
        globalThis.gapi.load("picker", {
          callback: resolve,
          onerror: () =>
            reject(new Error("Google Picker could not load. Try again.")),
          timeout: 15000,
          ontimeout: () =>
            reject(
              new Error("Google Picker timed out. Check your connection."),
            ),
        });
      if (globalThis.gapi) return load();
      const script = document.createElement("script");
      script.src = "https://apis.google.com/js/api.js";
      script.onload = load;
      script.onerror = () =>
        reject(
          new Error("Google Picker could not load. Check your connection."),
        );
      document.head.append(script);
    }).catch((error) => {
      library = null;
      throw error;
    });
  return library;
}
export class DrivePicker {
  constructor(config, token) {
    this.config = config;
    this.token = token;
  }
  async select({
    folder = null,
    folders = false,
    file = null,
    player = false,
  } = {}) {
    if (!this.config.apiKey || !/^\d+$/.test(this.config.appId || ""))
      throw new Error(
        "Google Picker needs an API key and Cloud project number. Ask the site owner to complete Google configuration.",
      );
    if (!this.token()) {
      const error = new Error("Your Google session expired. Sign in again.");
      error.status = 401;
      throw error;
    }
    await loadPicker();
    const p = globalThis.google.picker;
    const mime = folders
      ? "application/vnd.google-apps.folder"
      : player
        ? PLAYER_MIME
        : TEAM_MIME;
    const view = new p.DocsView(p.ViewId.DOCS)
      .setLabel(
        folders
          ? "Team folder"
          : file
            ? "Linked file"
            : player
              ? "Player files"
              : "Team files",
      )
      .setMode(p.DocsViewMode.LIST)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(folders);
    if (folders) {
      view.setMimeTypes(mime);
      if (folder) view.setFileIds(folder.id);
    } else {
      view.setMimeTypes(file ? `${mime},application/json` : mime);
      if (file) view.setFileIds(file.id);
      else if (folder) view.setParent(folder.id);
    }
    return new Promise((resolve, reject) => {
      let picker;
      const builder = new p.PickerBuilder()
        .addView(view)
        .setSelectableMimeTypes(folders ? mime : `${mime},application/json`)
        .setMaxItems(1)
        .setOAuthToken(this.token())
        .setDeveloperKey(this.config.apiKey)
        .setAppId(this.config.appId)
        .setOrigin(location.origin)
        .setTitle(
          folders
            ? `Add player: select the ${folder?.name || "team"} folder`
            : player
              ? file
                ? `Connect ${file.name || "this player"}: select the linked Player file`
                : "Add existing player: select a Player file"
              : "Open team: select a Team file",
        )
        .setCallback((data) => {
          if (data.action === p.Action.CANCEL) {
            picker.dispose();
            reject(new PickerCancelled());
          }
          if (data.action === p.Action.PICKED) {
            const docs = data.docs || [];
            const selected = docs.map((doc) => ({
              id: doc.id,
              resourceKey: doc.resourceKey || "",
            }));
            picker.dispose();
            if (
              folders &&
              (selected.length !== 1 ||
                (folder && selected[0].id !== folder.id))
            )
              return reject(
                new Error("Select the team folder from the link you supplied."),
              );
            if (!selected.length) return reject(new PickerCancelled());
            if (file && selected[0].id !== file.id)
              return reject(
                new Error(
                  player
                    ? `Choose the linked Player file for ${file.name || "this player"}.`
                    : "Choose the Team file from the link you opened.",
                ),
              );
            if (selected.length !== 1)
              return reject(
                new Error(
                  player ? "Choose one player file." : "Choose one team file.",
                ),
              );
            resolve(selected);
          }
        });
      // Personal sharing and Workspace shared drives are different locations.
      // Keep these views separate: enabling shared drives overrides parent/ID filters.
      if ((!folder && !file) || folders) {
        if (folders && folder)
          builder.addView(
            new p.DocsView(p.ViewId.DOCS)
              .setLabel("My Drive")
              .setIncludeFolders(true)
              .setSelectFolderEnabled(true)
              .setMimeTypes(mime),
          );
        builder.addView(
          new p.DocsView(p.ViewId.DOCS)
            .setLabel("Shared with me")
            .setMode(p.DocsViewMode.LIST)
            .setIncludeFolders(true)
            .setSelectFolderEnabled(folders)
            .setMimeTypes(mime)
            .setOwnedByMe(false),
        );
        builder.addView(
          new p.DocsView(p.ViewId.DOCS)
            .setLabel("Shared drives")
            .setMode(p.DocsViewMode.LIST)
            .setIncludeFolders(true)
            .setSelectFolderEnabled(folders)
            .setMimeTypes(mime)
            .setEnableDrives(true),
        );
      }

      if (!folders && !file) {
        const legacy = new p.DocsView(p.ViewId.DOCS)
          .setLabel(player ? "Older player files" : "Older team files")
          .setMode(p.DocsViewMode.LIST)
          .setIncludeFolders(true)
          .setSelectFolderEnabled(false)
          .setMimeTypes("application/json")
          .setQuery(player ? "player.consilium.json" : "team.consilium.json");
        if (folder) legacy.setParent(folder.id);
        builder.addView(legacy);
      }

      picker = builder.build();
      picker.setVisible(true);
    });
  }
  async folder(resource = null) {
    return (await this.select({ folder: resource, folders: true }))[0];
  }
  player(file = null, folder = null) {
    return this.select({ file, folder, player: true });
  }
  files(folder, file = null) {
    return this.select({ folder, file });
  }
}
