import { OperationCancelled } from "../cancellation.js";
import { NOTE_MIME } from "../../domain/note-document.js";
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
    note = false,
    purpose = null,
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
      : `${note ? NOTE_MIME : player ? PLAYER_MIME : TEAM_MIME},application/json`;
    // File format is an implementation detail. Search both content types in
    // the same view; the common filename identifies the intended document.
    const documentView = (label) => {
      const view = new p.DocsView(p.ViewId.DOCS)
        .setLabel(label)
        .setMode(p.DocsViewMode.LIST)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(folders)
        .setMimeTypes(mime);
      // A linked file may have been renamed in Drive. Its ID is sufficient.
      if (!folders && !file)
        view.setQuery(
          note
            ? "note.consilium.json"
            : player
              ? "player.consilium.json"
              : "team.consilium.json",
        );
      return view;
    };
    const view = documentView(
      folders
        ? "Team folder"
        : file
          ? "Linked file"
          : note
            ? "Note files"
            : player
              ? "Player files"
              : "Team files",
    );
    if (folders) {
      if (folder) view.setFileIds(folder.id);
    } else {
      if (file) view.setFileIds(file.id);
      else if (folder) view.setParent(folder.id);
    }
    return new Promise((resolve, reject) => {
      let picker;
      const builder = new p.PickerBuilder()
        .addView(view)
        .setSelectableMimeTypes(mime)
        .setMaxItems(1)
        .setOAuthToken(this.token())
        .setDeveloperKey(this.config.apiKey)
        .setAppId(this.config.appId)
        .setOrigin(location.origin)
        .setTitle(
          purpose ||
            (note
              ? file
                ? "Unlock note: select the linked note file"
                : "Attach existing note: select a Consilium note"
              : folders
                ? `Add player: select the ${folder?.name || "team"} folder`
                : player
                  ? file
                    ? `Connect ${file.name || "this player"}: select the linked Player file`
                    : "Add existing player: select a Player file"
                  : "Open team: select a Team file"),
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
                  note
                    ? "Choose the linked note file."
                    : player
                      ? `Choose the linked Player file for ${file.name || "this player"}.`
                      : "Choose the Team file from the link you opened.",
                ),
              );
            if (selected.length !== 1)
              return reject(
                new Error(
                  note
                    ? "Choose one note file."
                    : player
                      ? "Choose one player file."
                      : "Choose one team file.",
                ),
              );
            resolve(selected);
          }
        });
      // Personal sharing and Workspace shared drives are different locations.
      // Keep these views separate: enabling shared drives overrides parent/ID filters.
      if ((!folder && !file) || folders) {
        if (folders && folder) builder.addView(documentView("My Drive"));
        builder.addView(documentView("Shared with me").setOwnedByMe(false));
        builder.addView(documentView("Shared drives").setEnableDrives(true));
      }

      picker = builder.build();
      picker.setVisible(true);
    });
  }
  async folder(resource = null, purpose = null) {
    return (await this.select({ folder: resource, folders: true, purpose }))[0];
  }
  note(file = null) {
    return this.select({ file, note: true });
  }
  player(file = null, folder = null) {
    return this.select({ file, folder, player: true });
  }
  files(folder, file = null) {
    return this.select({ folder, file });
  }
}
