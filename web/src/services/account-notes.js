import { OperationCancelled } from "./cancellation.js";
import { validateNoteIndex } from "../domain/note-document.js";

// References live in the signed-in account's own Drive, never in the team plan.
export class AccountNotes {
  constructor(drive) {
    this.drive = drive;
    this.reset();
  }
  reset() {
    this.generation = (this.generation || 0) + 1;
    this.index = null;
    this.file = null;
    this.loading = null;
    this.pending = Promise.resolve();
  }
  context() {
    const generation = this.generation;
    return () => {
      if (generation !== this.generation) throw new OperationCancelled();
    };
  }
  async load() {
    if (this.index) return this.index;
    if (this.loading) return this.loading;
    const current = this.context();
    const task = (async () => {
      const files = await this.drive.noteIndexes();
      current();
      if (files.length) {
        const loaded = await this.drive.loadNoteIndex(files[0]);
        current();
        this.file = loaded.file;
        this.index = loaded.data;
      } else
        this.index = {
          format: "evony-consilium-notes-index",
          schema: 1,
          links: [],
        };
      return this.index;
    })();
    this.loading = task;
    try {
      return await task;
    } finally {
      if (this.loading === task) this.loading = null;
    }
  }
  change(transform) {
    const current = this.context();
    const task = this.pending
      .catch(() => {})
      .then(async () => {
        current();
        await this.load();
        current();
        // Another device may have created the index since this session opened.
        if (!this.file) {
          const files = await this.drive.noteIndexes();
          current();
          if (files.length) this.file = files[0];
        }
        for (let attempt = 0; attempt < 4; attempt++) {
          if (this.file) {
            const loaded = await this.drive.loadNoteIndex(this.file);
            current();
            this.file = loaded.file;
            this.index = loaded.data;
          }
          const next = validateNoteIndex(
            transform(structuredClone(this.index)),
          );
          try {
            const file = this.file
              ? await this.drive.saveNoteIndex(this.file, next)
              : await this.drive.createNoteIndex(next);
            current();
            this.file = file;
            this.index = next;
            return next;
          } catch (error) {
            current();
            if (![409, 412].includes(error.status) || attempt === 3)
              throw error;
          }
        }
      });
    this.pending = task;
    return task;
  }
  remember(file, subject) {
    return this.change((index) => {
      index.links = index.links.filter((link) => link.id !== file.id);
      index.links.push({
        id: file.id,
        subject,
        resourceKey: file.resourceKey || "",
      });
      return index;
    });
  }
  forget(id) {
    return this.change((index) => {
      index.links = index.links.filter((link) => link.id !== id);
      return index;
    });
  }
  async personalFolder() {
    await this.load();
    if (this.index.folder) return this.drive.metadata(this.index.folder);
    const current = this.context();
    const folder = await this.drive.createFolder("Consilium - Personal notes");
    current();
    await this.change((index) => {
      index.folder ||= { id: folder.id, resourceKey: folder.resourceKey || "" };
      return index;
    });
    current();
    return this.drive.metadata(this.index.folder);
  }
}
