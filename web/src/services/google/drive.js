import { readTeamDocument } from "../../domain/document-migrations.js";
import {
  playerDocument,
  readPlayerDocument,
} from "../../domain/player-document.js";
import { isTeamLogo } from "../../domain/team.js";
const API = "https://www.googleapis.com/drive/v3";
const FIELDS =
  "id,name,mimeType,version,parents,capabilities(canEdit,canAddChildren),webViewLink,resourceKey";
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
      let detail;
      try {
        detail = (await response.json()).error?.message;
      } catch {}
      throw new DriveError(
        response.status === 401
          ? "Your Google session expired. Sign in again; your draft is kept on this device."
          : detail || `Google Drive request failed (${response.status}).`,
        response.status,
      );
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
        q: `'${folder.id}' in parents and trashed = false and mimeType = 'application/json'`,
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
      return { file: after, profile: readPlayerDocument(data) };
    }
    throw new DriveError(
      "This player changed while opening. Open it again.",
      409,
    );
  }
  createPlayer(profile, folder) {
    if (!folder?.id || !folder.capabilities?.canAddChildren)
      throw new DriveError(
        "Player files need a writable central team folder.",
        403,
      );
    return this.createJSON(
      `${profile.name}.player.consilium.json`,
      playerDocument(profile),
      folder,
    );
  }
  async savePlayer(file, profile) {
    const current = await this.metadata(file);
    if (!current.capabilities?.canEdit)
      throw new DriveError(
        "You have view-only access to this player file.",
        403,
      );
    if (current.version !== file.version)
      throw new DriveError(
        "This player file changed. Open it again before saving.",
        409,
      );
    const saved = await this.request(
      `https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=media&supportsAllDrives=true&fields=${FIELDS}`,
      {
        method: "PATCH",
        body: JSON.stringify(playerDocument(profile)),
        headers: { "Content-Type": "application/json" },
        resource: file,
      },
    );
    saved.resourceKey ||= file.resourceKey || "";
    return saved;
  }
  async createJSON(name, data, folder = null) {
    const metadata = {
      name,
      mimeType: "application/json",
    };
    if (folder) metadata.parents = [folder.id];
    const boundary = "evony_" + crypto.randomUUID();
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(data)}\r\n--${boundary}--`;
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
  async initializeProject(folder, plan, { logo = "" } = {}) {
    const files = await this.children(folder);
    if (files.some((f) => f.name === "team.consilium.json"))
      throw new Error("This folder already has a team. Open it instead.");
    if (!folder.capabilities?.canAddChildren)
      throw new DriveError(
        "You need permission to add files to this folder.",
        403,
      );
    const file = await this.createJSON(
      "team.consilium.json",
      {
        format: "evony-consilium-team",
        schema: 1,
        plan: { ...plan, ...(isTeamLogo(logo) ? { projectLogo: logo } : {}) },
      },
      folder,
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
    const choices = selected.length
      ? files
      : files.filter((f) => f.name === "team.consilium.json");
    if (choices.length !== 1) throw new ProjectAccessError();
    return { folder: { ...folder }, file: choices[0] };
  }
  async save(file, plan) {
    const current = await this.metadata(file);
    if (!current.capabilities?.canEdit)
      throw new DriveError("You have view-only access to this team.", 403);
    if (current.version !== file.version)
      throw new DriveError(
        "A teammate changed this team. Your edits are kept locally. Load latest to use the shared version.",
        409,
      );
    return this.request(
      `https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=media&supportsAllDrives=true&fields=${FIELDS}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          format: "evony-consilium-team",
          schema: 1,
          plan,
        }),
        headers: { "Content-Type": "application/json" },
        resource: file,
      },
    );
  }
}
