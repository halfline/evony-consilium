import { AccountNotes } from "./account-notes.js";
import { OperationCancelled } from "./cancellation.js";
import { isFileAccessError } from "./google/drive.js";
import {
  noteSubject,
  noteMatchesPlayer,
  validateNote,
  mergeNote,
  applyNoteCaches,
  fileId,
} from "../domain/note-document.js";

export class PlayerNotes {
  constructor(workspace, changed = () => {}) {
    this.workspace = workspace;
    this.changed = changed;
    this.account = new AccountNotes(workspace.drive);
    this.reset();
  }
  reset() {
    this.generation = (this.generation || 0) + 1;
    this.entries = new Map();
    this.running = null;
    this.account.reset();
    this.changed();
  }
  context() {
    const generation = this.generation,
      team = this.workspace.sync.file?.id,
      account = this.workspace.account?.sub;
    return () => {
      if (
        generation !== this.generation ||
        team !== this.workspace.sync.file?.id ||
        account !== this.workspace.account?.sub
      )
        throw new OperationCancelled();
    };
  }
  subject(player) {
    return noteSubject(player, this.workspace.sync.file.id);
  }
  matches(subject, player) {
    return noteMatchesPlayer(subject, player, this.workspace.sync.file.id);
  }
  canPublish() {
    return !!this.workspace.sync.file?.capabilities?.canEdit;
  }
  async initialize() {
    const current = this.context();
    await this.account.load();
    current();
    await this.refresh();
    current();
  }
  draftKey(id) {
    return `consilium-note:${this.workspace.account.sub}:${id}`;
  }
  async load(file, { draft = true } = {}) {
    const current = this.context();
    const loaded = await this.workspace.drive.loadNote(file);
    current();
    let entry = this.entries.get(file.id);
    if (!entry) {
      const saved = draft
        ? await this.workspace.repository.read(this.draftKey(file.id))
        : null;
      current();
      entry = { draft: saved, revision: 0 };
      this.entries.set(file.id, entry);
    }
    Object.assign(entry, loaded, { error: null });
    try {
      const result = await this.workspace.drive.notePermissions(loaded.file);
      current();
      entry.permissions = result.permissions;
      entry.accessKnown = !result.nextPageToken;
    } catch (error) {
      current();
      entry.accessKnown = false;
    }
    return entry;
  }
  async ready(player) {
    const current = this.context();
    const index = await this.account.load();
    current();
    for (const link of index.links.filter((link) =>
      this.matches(link.subject, player),
    )) {
      if (this.entries.has(link.id)) continue;
      try {
        await this.load(link);
        current();
      } catch (error) {
        current();
        if (error.status === 401) throw error;
        this.entries.set(link.id, { error: error.message });
      }
    }
    this.changed();
  }
  list(player) {
    const rows = new Map();
    for (const record of this.workspace.getPlan().teamNotes || []) {
      if (record.playerId !== player.id) continue;
      rows.set(record.id, {
        id: record.id,
        resourceKey: record.resourceKey,
        note: record.noteCache.note,
        published: true,
        syncedAt: record.noteCache.syncedAt,
      });
    }
    for (const link of this.account.index?.links || [])
      if (this.matches(link.subject, player) && !rows.has(link.id))
        rows.set(link.id, { ...link });
    for (const row of rows.values()) {
      const entry = this.entries.get(row.id);
      const valid =
        entry?.note &&
        !entry.error &&
        this.matches(entry.note.subject, player) &&
        (!row.published ||
          (entry.note.scope === "team" &&
            entry.note.teamFileId === this.workspace.sync.file.id &&
            entry.file.parents?.includes(
              this.workspace.sync.file.parents?.[0] ||
                this.workspace.project.folder.id,
            )));
      row.entry = valid
        ? entry
        : entry
          ? {
              error: entry.error || "Source changed · published copy retained",
              file: entry.file,
            }
          : undefined;
      if (valid) row.note = entry.note;
      row.canEdit = !!valid && !!entry.file.capabilities?.canEdit;
      row.connected = !!valid;
      row.draft = valid ? entry.draft : null;
      row.audience =
        row.note?.scope === "team"
          ? "Team"
          : !entry?.accessKnown
            ? "Access in Drive"
            : entry.permissions?.some(
                  (permission) => permission.role !== "owner",
                )
              ? "Specific people"
              : "Only you";
    }
    return [...rows.values()].sort((a, b) =>
      (b.note?.updatedAt || "").localeCompare(a.note?.updatedAt || ""),
    );
  }
  async teamFolder({ interactive = true } = {}) {
    const current = this.context(),
      w = this.workspace;
    let team = await w.drive.metadata(w.sync.file);
    current();
    const id = team.parents?.[0] || w.project.folder.id;
    if (!id || id === team.id)
      throw new Error(
        "Move the team file into a shared Drive folder before creating team notes.",
      );
    let resource = {
      id,
      resourceKey:
        w.project.folder.id === id ? w.project.folder.resourceKey || "" : "",
    };
    let folder;
    try {
      folder = await w.drive.metadata(resource);
      current();
    } catch (error) {
      current();
      if (!isFileAccessError(error) || !interactive) throw error;
      resource = await w.picker.folder(
        resource,
        "Team note: select the shared team folder",
      );
      current();
      folder = await w.drive.metadata(resource);
      current();
    }
    if (!folder.capabilities?.canAddChildren)
      throw new Error(
        "You need permission to add files to the team folder. Create a personal note and ask an editor to make a team copy.",
      );
    return folder;
  }
  async create(player, values, scope = "personal") {
    this.workspace.authorize();
    const current = this.context();
    const now = new Date().toISOString();
    const note = validateNote({
      id: crypto.randomUUID(),
      subject: this.subject(player),
      title: values.title.trim(),
      body: values.body,
      scope,
      ...(scope === "team" ? { teamFileId: this.workspace.sync.file.id } : {}),
      author: this.workspace.account.email || this.workspace.account.sub,
      createdAt: now,
      updatedAt: now,
      context: {
        teamName: this.workspace.getPlan().title,
        playerName: player.name,
      },
    });
    const folder =
      scope === "team"
        ? await this.teamFolder()
        : await this.account.personalFolder();
    current();
    if (scope === "personal") {
      const permissions = await this.workspace.drive.notePermissions(folder);
      current();
      if (
        permissions.nextPageToken ||
        permissions.permissions.some((row) => row.role !== "owner")
      )
        throw new Error(
          "Your personal notes folder is shared. Remove its sharing in Drive before creating a private note.",
        );
    }
    const file = await this.workspace.drive.createNote(note, folder);
    current();
    const entry = { file, note, revision: 0, draft: null };
    this.entries.set(file.id, entry);
    try {
      await this.account.remember(file, note.subject);
      current();
    } catch (error) {
      current();
      this.workspace.status(
        `Note saved in Drive (${file.id}), but its attachment could not be saved. Use Attach existing note to recover it: ${error.message}`,
        true,
      );
      throw error;
    }
    await this.load(file);
    current();
    this.changed();
    if (scope === "team" && this.canPublish()) {
      try {
        await this.publish(player, file.id);
        current();
      } catch (error) {
        current();
        this.workspace.status(
          "Note saved. Team publication is pending: " + error.message,
          true,
        );
      }
    }
    return file.id;
  }
  async connect(player, file = null) {
    this.workspace.authorize();
    const current = this.context();
    if (file) fileId(file.id);
    const [selected] = await this.workspace.picker.note(file);
    current();
    if (file && selected.id !== file.id)
      throw new Error("Choose the linked note file.");
    selected.resourceKey ||= file?.resourceKey || "";
    const entry = await this.load(selected);
    current();
    if (!this.matches(entry.note.subject, player)) {
      this.entries.delete(selected.id);
      throw new Error(
        "This note belongs to a different player. Open that player's profile to attach it.",
      );
    }
    await this.account.remember(entry.file, entry.note.subject);
    current();
    this.changed();
    return selected.id;
  }
  updateDraft(id, values) {
    const entry = this.entries.get(id);
    if (!entry?.note || entry.error || !entry.file.capabilities?.canEdit)
      return;
    entry.draft = {
      baseline: entry.draft?.baseline || structuredClone(entry.note),
      title: values.title,
      body: values.body,
    };
    entry.revision++;
    this.workspace.repository
      .write(entry.draft, this.draftKey(id))
      .catch(() =>
        this.workspace.status("Note draft backup unavailable.", true),
      );
    this.changed();
  }
  async save(player, id, resolution = null) {
    const entry = this.entries.get(id);
    if (!entry?.draft || entry.saving) return;
    const current = this.context(),
      draft = structuredClone(entry.draft),
      revision = entry.revision;
    entry.saving = true;
    this.changed();
    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const remote = await this.workspace.drive.loadNote(entry.file);
        current();
        if (!remote.file.capabilities?.canEdit)
          throw new Error("The note is now read-only. Your draft is retained.");
        if (
          remote.note.id !== draft.baseline.id ||
          remote.note.subject !== draft.baseline.subject ||
          !this.matches(remote.note.subject, player) ||
          remote.note.scope !== draft.baseline.scope ||
          remote.note.teamFileId !== draft.baseline.teamFileId
        )
          throw new Error(
            "The note's subject or audience changed. Reconnect it before saving.",
          );
        const result = mergeNote(
          draft.baseline,
          draft,
          remote.note,
          resolution && entry.conflict?.file.version === remote.file.version
            ? resolution
            : null,
        );
        if (
          result.conflicts.length &&
          (!resolution || entry.conflict?.file.version !== remote.file.version)
        ) {
          entry.conflict = remote;
          throw Object.assign(
            new Error(
              "This note changed. Review the latest text before saving.",
            ),
            { review: true },
          );
        }
        const note = validateNote({
          ...result.note,
          updatedAt: new Date().toISOString(),
        });
        try {
          const file = await this.workspace.drive.saveNote(remote.file, note);
          current();
          Object.assign(entry, { file, note, conflict: null, error: null });
          if (entry.revision === revision) entry.draft = null;
          else entry.draft.baseline = structuredClone(note);
          await this.workspace.repository.write(entry.draft, this.draftKey(id));
          current();
          if (
            note.scope === "team" &&
            this.canPublish() &&
            this.workspace.getPlan().teamNotes?.some((row) => row.id === id)
          ) {
            try {
              await this.publish(player, id);
              current();
            } catch (error) {
              current();
              this.workspace.status(
                "Note saved. Team cache update will retry: " + error.message,
                true,
              );
            }
          }
          return;
        } catch (error) {
          current();
          if (![409, 412].includes(error.status) || attempt === 3) throw error;
        }
      }
    } finally {
      entry.saving = false;
      this.changed();
    }
  }
  async publication(player, id, loaded = null) {
    const current = this.context(),
      entry =
        loaded ||
        (await this.load({
          id,
          resourceKey: this.entries.get(id)?.file?.resourceKey || "",
        }));
    current();
    const w = this.workspace,
      note = entry.note;
    if (
      note.scope !== "team" ||
      note.teamFileId !== w.sync.file.id ||
      !this.matches(note.subject, player)
    )
      throw new Error(
        "Only a team note for this player and team can be published. Use Create team copy for a personal note.",
      );
    const team = await w.drive.metadata(w.sync.file);
    current();
    const folderId = team.parents?.[0] || w.project.folder.id;
    if (folderId === team.id || !entry.file.parents?.includes(folderId))
      throw new Error(
        "The note must be in this team's shared Drive folder before publication.",
      );
    const published = w
      .getPlan()
      .teamNotes?.find((row) => row.id === id)?.noteCache;
    const unchanged =
      published?.version === entry.file.version &&
      JSON.stringify(validateNote(published.note)) === JSON.stringify(note);
    return {
      id,
      playerId: player.id,
      resourceKey: entry.file.resourceKey || "",
      noteCache: {
        note: structuredClone(note),
        version: entry.file.version,
        syncedAt: unchanged ? published.syncedAt : new Date().toISOString(),
      },
    };
  }
  async publish(player, id) {
    if (!this.canPublish())
      throw new Error("A team editor must unlock and publish this note.");
    const current = this.context(),
      update = await this.publication(player, id);
    current();
    await this.workspace.sync.publish((plan) =>
      applyNoteCaches(plan, [update], { attach: true }),
    );
    current();
    if (!this.workspace.sync.basePlan?.teamNotes?.some((row) => row.id === id))
      throw new Error(
        "Team publication is waiting. Resolve any team conflict, then Publish to team.",
      );
    this.changed();
  }
  async refresh() {
    if (
      this.running ||
      !this.workspace.healthy() ||
      !this.account.index ||
      this.workspace.sync.saving
    )
      return;
    const current = this.context(),
      pass = {};
    this.running = pass;
    const updates = [];
    try {
      for (const link of this.account.index.links) {
        const player = this.workspace
          .getPlan()
          .keeps.find((row) => this.matches(link.subject, row));
        if (!player) continue;
        const published = this.workspace
          .getPlan()
          .teamNotes?.some((row) => row.id === link.id);
        const entry = this.entries.get(link.id);
        if (!entry && !published) continue;
        if (entry?.saving) continue;
        try {
          const loaded = await this.load(link);
          current();
          if (published && this.canPublish())
            updates.push(await this.publication(player, link.id, loaded));
          current();
        } catch (error) {
          current();
          if (error.status === 401) throw error;
          if (isFileAccessError(error))
            this.entries.set(link.id, {
              ...entry,
              error: error.message,
              note: null,
            });
        }
      }
      if (updates.length) {
        await this.workspace.sync.publish((plan) =>
          applyNoteCaches(plan, updates),
        );
        current();
      }
    } finally {
      if (this.running === pass) {
        this.running = null;
        this.changed();
      }
    }
  }
  async share(id, email, role) {
    const current = this.context(),
      entry = this.entries.get(id);
    if (!entry?.file?.capabilities?.canShare)
      throw new Error("Manage this note's sharing in Google Drive.");
    if (entry.note.scope !== "personal")
      throw new Error("Team note access follows the shared team folder.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new Error("Enter a Google account email address.");
    await this.workspace.drive.shareNote(entry.file, email, role);
    current();
    await this.load(entry.file);
    current();
    this.changed();
  }
  async detach(player, id, team = false) {
    const current = this.context();
    if (team) {
      if (!this.canPublish())
        throw new Error(
          "Team Editor access is needed to remove published notes.",
        );
      await this.workspace.sync.publish((plan) => ({
        ...plan,
        teamNotes: (plan.teamNotes || []).filter(
          (row) => row.id !== id || row.playerId !== player.id,
        ),
      }));
      current();
      if (this.workspace.sync.basePlan.teamNotes?.some((row) => row.id === id))
        throw new Error(
          "Team removal is pending. Resolve the team conflict and try again.",
        );
    }
    await this.account.forget(id);
    current();
    this.entries.delete(id);
    this.changed();
  }
  async autosave() {
    for (const [id, entry] of this.entries) {
      if (!entry.draft || entry.conflict || entry.saving || entry.error)
        continue;
      const player = this.workspace
        .getPlan()
        .keeps.find((row) => this.matches(entry.note.subject, row));
      if (!player) continue;
      try {
        await this.save(player, id);
      } catch (error) {
        if (!(error instanceof OperationCancelled))
          this.workspace.status(error.message, true);
      }
    }
  }
}
