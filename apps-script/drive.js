const V3 = "https://www.googleapis.com/drive/v3/files";
const V2 = "https://www.googleapis.com/drive/v2/files";
const FIELDS =
  "id,name,mimeType,version,parents,trashed,resourceKey,capabilities(canEdit)";
const V2_FIELDS =
  "id,title,mimeType,version,etag,parents(id),labels(trashed),resourceKey,capabilities(canEdit)";
const query = (params) =>
  Object.entries(params)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");
const normalized = (file) => ({
  ...file,
  name: file.title,
  trashed: file.labels?.trashed || false,
  parents: (file.parents || []).map((parent) => parent.id),
});

// All endpoints are fixed Google Drive endpoints. Tokens exist only during
// execution, and no request is retried without its conditional-write header.
export class ScriptDrive {
  constructor({ fetch, token, uuid }) {
    Object.assign(this, { fetch, token, uuid });
  }
  request(url, resource, { method = "get", body, headers = {} } = {}) {
    const authorization = this.token();
    if (!authorization)
      throw Object.assign(new Error("Google authorization is required."), {
        status: 401,
      });
    if (resource.resourceKey)
      headers["X-Goog-Drive-Resource-Keys"] =
        `${resource.id}/${resource.resourceKey}`;
    let response;
    try {
      response = this.fetch(url, {
        method,
        headers: { ...headers, Authorization: `Bearer ${authorization}` },
        ...(body === undefined ? {} : { payload: body }),
        muteHttpExceptions: true,
        followRedirects: false,
      });
    } catch (error) {
      if (error.status === 429) throw error;
      throw Object.assign(
        new Error(
          "Apps Script could not complete the Drive request; check authorization, quota, or service availability.",
        ),
        { status: 503 },
      );
    }
    const status = response.getResponseCode();
    if (status < 200 || status >= 300) {
      let reason;
      try {
        reason = JSON.parse(response.getContentText()).error?.errors?.[0]
          ?.reason;
      } catch {}
      // Do not log response bodies: Drive errors can contain user content.
      throw Object.assign(
        new Error(`Google Drive request failed (${status}).`),
        { status, reason },
      );
    }
    try {
      return JSON.parse(response.getContentText());
    } catch {
      throw new Error("Google Drive returned invalid JSON.");
    }
  }
  metadata(resource) {
    return this.request(
      `${V3}/${encodeURIComponent(resource.id)}?${query({ supportsAllDrives: true, fields: FIELDS })}`,
      resource,
    );
  }
  revision(resource) {
    return normalized(
      this.request(
        `${V2}/${encodeURIComponent(resource.id)}?${query({ supportsAllDrives: true, fields: V2_FIELDS })}`,
        resource,
      ),
    );
  }
  load(resource) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const before = this.revision(resource),
        document = this.request(
          `${V3}/${encodeURIComponent(resource.id)}?alt=media&supportsAllDrives=true`,
          resource,
        ),
        after = this.revision(resource);
      if (before.version === after.version && before.etag === after.etag)
        return {
          file: {
            ...after,
            resourceKey: after.resourceKey || resource.resourceKey || "",
          },
          document,
        };
    }
    throw Object.assign(
      new Error("Source changed during every read; retry on the next run."),
      { status: 409 },
    );
  }
  children(folder) {
    const files = [];
    let pageToken;
    do {
      const result = this.request(
        `${V3}?${query({ q: `'${folder.id}' in parents and trashed = false and (mimeType = 'application/json' or mimeType = 'application/vnd.evony-consilium.player+json' or mimeType = 'application/vnd.evony-consilium.note+json')`, supportsAllDrives: true, includeItemsFromAllDrives: true, pageSize: 1000, fields: `nextPageToken,incompleteSearch,files(${FIELDS})`, ...(pageToken ? { pageToken } : {}) })}`,
        folder,
      );
      if (result.incompleteSearch || !Array.isArray(result.files))
        throw new Error(
          "Drive could not completely list the team folder; sync paused.",
        );
      files.push(...result.files);
      pageToken = result.nextPageToken;
      if (files.length > 10000)
        throw new Error("The team folder is too large for this sync job.");
    } while (pageToken);
    return files;
  }
  save(file, document) {
    const current = this.revision(file);
    if (current.trashed || !current.capabilities?.canEdit)
      throw Object.assign(new Error("Team editing access is unavailable."), {
        status: 403,
      });
    if (current.version !== file.version || current.etag !== file.etag)
      throw Object.assign(new Error("Team changed before saving."), {
        status: 409,
      });
    if (typeof current.etag !== "string" || !/^"[^\r\n]+"$/.test(current.etag))
      throw new Error(
        "Drive did not provide a strong ETag; refusing an unconditional upload.",
      );
    const boundary = `consilium_${this.uuid()}`;
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(document)}\r\n--${boundary}--`;
    return this.request(
      `https://www.googleapis.com/upload/drive/v2/files/${encodeURIComponent(file.id)}?${query({ uploadType: "multipart", supportsAllDrives: true, fields: "id,version" })}`,
      file,
      {
        method: "put",
        body,
        headers: {
          "Content-Type": `multipart/related; boundary=${boundary}`,
          "If-Match": current.etag,
        },
      },
    );
  }
}
