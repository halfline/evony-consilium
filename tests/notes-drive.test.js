import test from "node:test";
import assert from "node:assert/strict";
import { Drive } from "../web/src/services/google/drive.js";
import {
  noteDocument,
  NOTE_MIME,
  NOTE_INDEX_MIME,
} from "../web/src/domain/note-document.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status });
const note = {
  id: "note-identity",
  subject: "player:source",
  title: "Growth",
  body: "Review next week",
  scope: "personal",
  author: "alice@example.test",
  createdAt: "2026-10-10T12:00:00Z",
  updatedAt: "2026-10-10T12:00:00Z",
};
const parts = (body) =>
  body
    .split("\r\n")
    .filter((line) => line.startsWith("{"))
    .map(JSON.parse);

test("note and index creation use independent files with explicit storage and private discovery metadata", async () => {
  const uploads = [];
  const drive = new Drive(
    () => "token",
    async (url, options) => {
      uploads.push({ url, options, blocks: parts(options.body) });
      return json({ id: "created", version: "1" });
    },
  );
  await drive.createNote(note, {
    id: "personal-folder",
    resourceKey: "folder-key",
    capabilities: { canAddChildren: true },
  });
  await drive.createNoteIndex({
    format: "evony-consilium-notes-index",
    schema: 1,
    links: [],
  });
  assert.equal(uploads[0].blocks[0].mimeType, NOTE_MIME);
  assert.deepEqual(uploads[0].blocks[0].parents, ["personal-folder"]);
  assert.deepEqual(uploads[0].blocks[1], noteDocument(note));
  assert.equal(
    uploads[0].options.headers["X-Goog-Drive-Resource-Keys"],
    "personal-folder/folder-key",
  );
  assert.equal(uploads[1].blocks[0].mimeType, NOTE_INDEX_MIME);
  assert.equal(uploads[1].blocks[0].parents, undefined);
  assert.deepEqual(uploads[1].blocks[0].appProperties, {
    consiliumKind: "notes-index",
  });
  assert.throws(() => drive.createNote(note, { id: "readonly" }), /permission/);
});

test("note reads retry unstable revisions and preserve the selected resource key", async () => {
  let metadataReads = 0,
    downloads = 0;
  const drive = new Drive(
    () => "token",
    async (url, options) => {
      assert.equal(
        options.headers["X-Goog-Drive-Resource-Keys"],
        "source-note/key",
      );
      assert.equal(options.cache, "no-store");
      if (url.includes("alt=media"))
        return json(
          noteDocument({
            ...note,
            body: ++downloads === 1 ? "Outdated" : "Stable",
          }),
        );
      return json({
        id: "source-note",
        version: String(++metadataReads === 1 ? 1 : 2),
      });
    },
  );
  const loaded = await drive.loadNote({
    id: "source-note",
    resourceKey: "key",
  });
  assert.equal(downloads, 2);
  assert.equal(loaded.note.body, "Stable");
  assert.equal(loaded.file.version, "2");
  assert.equal(loaded.file.resourceKey, "key");
});

test("note uploads use strong ETags and retain sharing capabilities after saving", async () => {
  const requests = [];
  const drive = new Drive(
    () => "token",
    async (url, options) => {
      requests.push({ url, options });
      return json({
        id: "source-note",
        version: options.method === "PUT" ? "2" : "1",
        title: "Growth",
        etag: '"note-revision"',
        parents: [{ id: "personal-folder" }],
        capabilities: { canEdit: true, canShare: true, canCopy: false },
      });
    },
  );
  const saved = await drive.saveNote({ id: "source-note", version: "1" }, note);
  assert.equal(requests[1].options.headers["If-Match"], '"note-revision"');
  assert.equal(requests[1].options.method, "PUT");
  assert.deepEqual(parts(requests[1].options.body)[1], noteDocument(note));
  assert.equal(saved.capabilities.canShare, true);
  assert.equal(saved.capabilities.canCopy, false);
  assert.deepEqual(saved.parents, ["personal-folder"]);
});

test("personal index discovery is account-owned and follows all result pages", async () => {
  let calls = 0;
  const drive = new Drive(
    () => "token",
    async (url) => {
      const params = new URL(url).searchParams;
      assert.match(params.get("q"), /'me' in owners/);
      assert.match(params.get("q"), /appProperties has/);
      assert.match(params.get("q"), /notes-index/);
      if (++calls === 1)
        return json({ files: [{ id: "first" }], nextPageToken: "more" });
      assert.equal(params.get("pageToken"), "more");
      return json({ files: [{ id: "second" }] });
    },
  );
  assert.deepEqual(await drive.noteIndexes(), [
    { id: "first" },
    { id: "second" },
  ]);
});

test("note sharing grants only the requested user role and carries resource keys", async () => {
  const requests = [];
  const drive = new Drive(
    () => "token",
    async (url, options) => {
      requests.push({ url, options });
      return json(
        options.method === "GET"
          ? {
              permissions: [{ type: "user", role: "owner" }],
              nextPageToken: "unlisted",
            }
          : { id: "permission" },
      );
    },
  );
  const file = { id: "source-note", resourceKey: "key" };
  const permissions = await drive.notePermissions(file);
  assert.equal(permissions.nextPageToken, "unlisted");
  await drive.shareNote(file, "bob@example.test", "reader");
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    type: "user",
    role: "reader",
    emailAddress: "bob@example.test",
  });
  assert.equal(
    requests[1].options.headers["X-Goog-Drive-Resource-Keys"],
    "source-note/key",
  );
  assert.match(requests[1].url, /supportsAllDrives=true/);
  assert.throws(
    () => drive.shareNote(file, "bob@example.test", "owner"),
    /Invalid note sharing role/,
  );
});
