import { readTeamDocument } from "../../domain/document-migrations.js";
import {
  playerDocument,
  readPlayerDocument,
  readPlayerActivity,
} from "../../domain/player-document.js";
import { isTeamLogo } from "../../domain/team.js";
import {
  NOTE_MIME,
  NOTE_INDEX_MIME,
  noteFilename,
  noteDocument,
  readNoteDocument,
  validateNoteIndex,
  fileId,
} from "../../domain/note-document.js";
import {
  TEAM_MIME,
  PLAYER_MIME,
  teamFilename,
  playerFilename,
  isTeamFile,
} from "../../domain/drive-documents.js";
const API = "https://www.googleapis.com/drive/v3";
const FIELDS =
  "id,name,mimeType,version,parents,ownedByMe,capabilities(canEdit,canAddChildren,canShare,canCopy),webViewLink,resourceKey";
export const isFileAccessError = (error) =>
  error.status === 404 ||
  (error.status === 403 &&
    (!error.reason ||
      [
        "appNotAuthorizedToFile",
        "insufficientFilePermissions",
        "notFound",
      ].includes(error.reason)));
export class ProjectAccessError extends Error {
  constructor() {
    super("Choose the team file to open it.");
  }
}
export class DriveError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
export class Drive {
  constructor(token, fetcher = globalThis.fetch.bind(globalThis)) {
    this.token = token;
    this.fetcher = fetcher;
  }
  async request(path, { method = "GET", body, headers = {}, resource } = {}) {
    if (!this.token())
      throw new DriveError(
        "Your Google session expired. Sign in again; your draft is kept on this device.",
        401,
      );
    if (resource?.resourceKey)
      headers["X-Goog-Drive-Resource-Keys"] =
        `${resource.id}/${resource.resourceKey}`;
    const url = path.startsWith("https:") ? path : API + path;
    const response = await this.fetcher(url, {
      method,
      cache: "no-store",
      body,
      headers: { ...headers, Authorization: `Bearer ${this.token()}` },
    });
    if (!response.ok) {
      let detail, reason;
      try {
        const error = (await response.json()).error;
        detail = error?.message;
        reason = error?.errors?.[0]?.reason;
      } catch {}
      const error = new DriveError(
        response.status === 401
          ? "Your Google session expired. Sign in again; your draft is kept on this device."
          : detail || `Google Drive request failed (${response.status}).`,
        response.status,
      );
      error.reason = reason;
      throw error;
    }
    return response.json();
  }
  metadata(resource) {
    return this.request(
      `/files/${encodeURIComponent(resource.id)}?supportsAllDrives=true&fields=${FIELDS}`,
      { resource },
    );
  }
  async children(folder) {
    let pageToken = "",
      files = [];
    do {
      const query = new URLSearchParams({
        q: `'${folder.id}' in parents and trashed = false and (mimeType = 'application/json' or mimeType = '${TEAM_MIME}' or mimeType = '${PLAYER_MIME}')`,
        fields: `nextPageToken,files(${FIELDS})`,
        pageSize: "100",
        supportsAllDrives: "true",
        includeItemsFromAllDrives: "true",
      });
      if (pageToken) query.set("pageToken", pageToken);
      const result = await this.request(`/files?${query}`, {
        resource: folder,
      });
      files.push(...result.files);
      pageToken = result.nextPageToken;
    } while (pageToken);
    return files;
  }
  async load(file) {
    // Drive can advance a newly uploaded file's revision while it settles.
    // Retry the whole read so content is always paired with a stable version.
    for (let attempt = 0; attempt < 3; attempt++) {
      const before = await this.metadata(file);
      const data = await this.request(
        `/files/${file.id}?alt=media&supportsAllDrives=true`,
        { resource: file },
      );
      const after = await this.metadata(file);
      if (before.version !== after.version) continue;
      if (
        data.format !== "evony-consilium-team" ||
        data.schema !== 1 ||
        !data.plan
      )
        throw new Error("This file is not an Evony Consilium team.");
      return { file: after, plan: readTeamDocument(data) };
    }
    throw new DriveError(
      "This team changed while opening. Open it again.",
      409,
    );
  }
  async loadPlayer(file) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const before = await this.metadata(file);
      const data = await this.request(
        `/files/${file.id}?alt=media&supportsAllDrives=true`,
        { resource: file },
      );
      const after = await this.metadata(file);
      if (before.version !== after.version) continue;
      after.resourceKey ||= file.resourceKey || "";
      return {
        file: after,
        profile: readPlayerDocument(data),
        activityLog: readPlayerActivity(data),
      };
    }
    throw new DriveError(
      "This player changed while opening. Open it again.",
      409,
    );
  }
  createPlayer(profile, folder, activityLog = []) {
    if (!folder?.id || !folder.capabilities?.canAddChildren)
      throw new DriveError(
        "Player files need a writable central team folder.",
        403,
      );
    return this.createJSON(
      playerFilename(profile.name),
      playerDocument(profile, activityLog),
      folder,
      { mimeType: PLAYER_MIME },
    );
  }
  async savePlayer(file, profile, activityLog = []) {
    return this.conditionalSave(
      file,
      () => playerDocument(profile, activityLog),
      playerFilename(profile.name),
      PLAYER_MIME,
    );
  }
  async createJSON(
    name,
    data,
    folder = null,
    { mimeType = "application/json", appProperties } = {},
  ) {
    const metadata = {
      name,
      mimeType,
    };
    if (folder) metadata.parents = [folder.id];
    if (appProperties) metadata.appProperties = appProperties;
    const boundary = "evony_" + crypto.randomUUID();
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${JSON.stringify(data)}\r\n--${boundary}--`;
    return this.request(
      `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=${FIELDS}`,
      {
        method: "POST",
        body,
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        resource: folder,
      },
    );
  }
  createFolder(name) {
    return this.request(`/files?supportsAllDrives=true&fields=${FIELDS}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
      }),
    });
  }
  async loadJSON(file, read) {
    fileId(file.id);
    for (let attempt = 0; attempt < 3; attempt++) {
      const before = await this.metadata(file);
      const data = await this.request(
        `/files/${file.id}?alt=media&supportsAllDrives=true`,
        { resource: file },
      );
      const after = await this.metadata(file);
      if (before.version !== after.version) continue;
      after.resourceKey ||= file.resourceKey || "";
      return { file: after, data: read(data) };
    }
    throw new DriveError("The note changed while opening. Try again.", 409);
  }
  async loadNote(file) {
    const loaded = await this.loadJSON(file, readNoteDocument);
    return { file: loaded.file, note: loaded.data };
  }
  loadNoteIndex(file) {
    return this.loadJSON(file, validateNoteIndex);
  }
  async noteIndexes() {
    const query = new URLSearchParams({
      q: "'me' in owners and trashed = false and appProperties has { key='consiliumKind' and value='notes-index' }",
      fields: `nextPageToken,files(${FIELDS})`,
      pageSize: "100",
    });
    const files = [];
    do {
      const result = await this.request(`/files?${query}`);
      files.push(...result.files);
      if (!result.nextPageToken) return files;
      query.set("pageToken", result.nextPageToken);
    } while (true);
  }
  createNoteIndex(data) {
    const index = validateNoteIndex(data);
    if (!index.folder)
      throw new Error(
        "A personal notes folder is required for the notes index.",
      );
    return this.createJSON(
      "Consilium - Personal notes index.json",
      index,
      index.folder,
      {
        mimeType: NOTE_INDEX_MIME,
        appProperties: { consiliumKind: "notes-index" },
      },
    );
  }
  saveNoteIndex(file, data) {
    return this.conditionalSave(
      file,
      () => validateNoteIndex(data),
      "Consilium - Personal notes index.json",
      NOTE_INDEX_MIME,
    );
  }
  createNote(note, folder) {
    if (!folder?.capabilities?.canAddChildren)
      throw new DriveError(
        "You need permission to create files in the notes folder.",
        403,
      );
    return this.createJSON(noteFilename(note), noteDocument(note), folder, {
      mimeType: NOTE_MIME,
    });
  }
  saveNote(file, note) {
    return this.conditionalSave(
      file,
      () => noteDocument(note),
      noteFilename(note),
      NOTE_MIME,
    );
  }
  notePermissions(file) {
    fileId(file.id);
    return this.request(
      `/files/${file.id}/permissions?supportsAllDrives=true&fields=nextPageToken,permissions(id,type,role,emailAddress)&pageSize=100`,
      { resource: file },
    );
  }
  shareNote(file, emailAddress, role) {
    fileId(file.id);
    if (!["reader", "writer"].includes(role))
      throw new Error("Invalid note sharing role.");
    return this.request(
      `/files/${file.id}/permissions?supportsAllDrives=true&fields=id,type,role,emailAddress`,
      {
        method: "POST",
        resource: file,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "user", role, emailAddress }),
      },
    );
  }
  async initializeProject(folder, plan, { logo = "" } = {}) {
    const files = await this.children(folder);
    if (files.some(isTeamFile))
      throw new Error("This folder already has a team. Open it instead.");
    if (!folder.capabilities?.canAddChildren)
      throw new DriveError(
        "You need permission to add files to this folder.",
        403,
      );
    const file = await this.createJSON(
      teamFilename(plan.title),
      {
        format: "evony-consilium-team",
        schema: 1,
        plan: { ...plan, ...(isTeamLogo(logo) ? { projectLogo: logo } : {}) },
      },
      folder,
      { mimeType: TEAM_MIME },
    );
    folder.teamFileId = file.id;
    return folder;
  }
  async project(folder, selected = []) {
    if (folder.teamFileId || folder.kind === "file") {
      const file = await this.metadata({
        id: folder.teamFileId || folder.id,
        resourceKey:
          (folder.teamFileId
            ? folder.teamFileResourceKey
            : folder.resourceKey) || "",
      });
      file.resourceKey ||=
        (folder.teamFileId ? folder.teamFileResourceKey : folder.resourceKey) ||
        "";
      return {
        folder:
          folder.kind === "file"
            ? { id: file.parents?.[0] || file.id, name: file.name }
            : { ...folder },
        file,
      };
    }
    const files = selected.length ? [] : await this.children(folder);
    let folderFiles;
    for (const resource of selected) {
      const file = await this.metadata(resource);
      file.resourceKey ||= resource.resourceKey;
      if (file.parents?.length) {
        if (!file.parents.includes(folder.id))
          throw new Error(
            "Select only files directly inside this team folder.",
          );
      } else {
        // Verify membership independently instead of assuming an omitted field
        // proves either membership or a mismatch. The query carries the folder key.
        folderFiles ??= await this.children(folder);
        if (!folderFiles.some((child) => child.id === file.id))
          throw new Error(
            "Could not verify this file belongs to the linked team folder. Open the team's file link directly.",
          );
      }
      files.push(file);
    }
    const choices = selected.length ? files : files.filter(isTeamFile);
    if (choices.length !== 1) throw new ProjectAccessError();
    return { folder: { ...folder }, file: choices[0] };
  }
  async save(file, plan) {
    return this.conditionalSave(
      file,
      { format: "evony-consilium-team", schema: 1, plan },
      teamFilename(plan.title),
      TEAM_MIME,
    );
  }
  async conditionalSave(file, document, name, mimeType) {
    // v2 exposes a strong metadata ETag in JSON. v3 omits it. Use the exact
    // token as a server-side precondition, never a guessed version or media ETag.
    const fields =
      "id,title,mimeType,etag,version,parents(id),capabilities(canEdit,canAddChildren,canShare,canCopy),alternateLink,resourceKey";
    const current = await this.request(
      `https://www.googleapis.com/drive/v2/files/${encodeURIComponent(file.id)}?supportsAllDrives=true&fields=${fields}`,
      { resource: file },
    );
    if (!current.capabilities?.canEdit)
      throw new DriveError(
        "This file is read-only. Ask its owner for Editor access in Drive.",
        403,
      );
    if (current.version !== file.version)
      throw new DriveError(
        "A teammate changed this file. Your edits are kept locally; retry to merge the latest changes.",
        409,
      );
    if (typeof current.etag !== "string" || !/^"[^\r\n]+"$/.test(current.etag))
      throw new DriveError(
        "Drive did not provide a safe revision for this file. Your draft is kept locally; try again.",
        503,
      );
    const boundary = "consilium_" + crypto.randomUUID();
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ title: name, mimeType })}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${JSON.stringify(typeof document === "function" ? document() : document)}\r\n--${boundary}--`;
    const saved = await this.request(
      `https://www.googleapis.com/upload/drive/v2/files/${encodeURIComponent(file.id)}?uploadType=multipart&supportsAllDrives=true&fields=${fields}`,
      {
        method: "PUT",
        body,
        headers: {
          "Content-Type": `multipart/related; boundary=${boundary}`,
          "If-Match": current.etag,
        },
        resource: file,
      },
    );
    return {
      ...file,
      id: saved.id,
      name: saved.title,
      mimeType: saved.mimeType,
      version: saved.version,
      capabilities: saved.capabilities,
      parents: saved.parents?.map((parent) => parent.id) || file.parents,
      webViewLink: saved.alternateLink || file.webViewLink,
      resourceKey: saved.resourceKey || file.resourceKey || "",
    };
  }
}
