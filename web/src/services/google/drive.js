import { readTeamDocument } from "../../domain/document-migrations.js";
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
}
