import {
  applyPlayerProfile,
  linkedPlayer,
  mergePlayerProfiles,
  playerProfile,
  profileFingerprint,
  playerProfileChanges,
  validateProfile,
} from "../domain/player-document.js";
import { recordActivity } from "../domain/activity.js";
import { recordPlayerProgress } from "../domain/player-progress.js";
import { OperationCancelled } from "./cancellation.js";
import { isFileAccessError } from "./google/drive.js";

// Grants and downloaded profiles belong to one signed-in workspace, never the team JSON.
export class PlayerFiles {
  #files;
  constructor({
    drive,
    picker,
    remember = () => {},
    changed = () => {},
    readDraft = async () => null,
    writeDraft = async () => {},
    actor = () => null,
    activitySession = () => null,
  }) {
    Object.assign(this, {
      drive,
      picker,
      remember,
      changed,
      readDraft,
      writeDraft,
      actor,
      activitySession,
    });
    this.reset();
  }
  reset() {
    this.generation = (this.generation || 0) + 1;
    this.#files = new Map();
    this.busy = new Set();
    this.pending = new Map();
    this.created = new Map();
    this.checked = new Map();
    this.retryAfter = new Map();
    this.operations = new Map();
  }
  state(player) {
    if (!player?.playerSource)
      return { label: "Team copy", connected: false, canEdit: false };
    const state = this.#files.get(player.playerSource.fileId);
    return {
      label: state?.error
        ? "Cached profile · Connect file to retry"
        : !state
          ? "Cached profile · Connect player file"
          : state.file.capabilities?.canEdit
            ? ""
            : "Read-only profile",
      connected: !!state && !state.error,
      canEdit: !!state && !state.error && !!state.file.capabilities?.canEdit,
      busy: this.busy.has(player.playerSource.fileId),
    };
  }
  profile(player) {
    const entry =
      player?.playerSource && this.#files.get(player.playerSource.fileId);
    return entry?.draft
      ? applyPlayerProfile(player, entry.draft.profile)
      : entry?.profile && !entry.error
        ? applyPlayerProfile(player, entry.profile)
        : player;
  }
  captureContext() {
    const generation = this.generation;
    return () => {
      if (generation !== this.generation) throw new OperationCancelled();
    };
  }
  async discardDraft(player) {
    const id = player.playerSource?.fileId;
    if (!id) return;
    const current = this.captureContext();
    await this.writeDraft(id, null);
    current();
    const entry = this.#files.get(id);
    if (entry) entry.draft = null;
    this.changed();
  }
  cachedPlayer(player) {
    const entry = this.#files.get(player.playerSource?.fileId);
    if (!entry?.profile || entry.error)
      throw new Error("Player file is unavailable.");
    return linkedPlayer(player, entry.profile, entry.file);
  }
  activitySnapshots() {
    return [...this.#files.entries()]
      .filter(([, entry]) => !entry.error && Array.isArray(entry.activityLog))
      .map(([fileId, entry]) => ({
        fileId,
        version: entry.file.version,
        activityLog: structuredClone(entry.activityLog),
      }));
  }
  async run(id, task, { notifyBusy = true } = {}) {
    const generation = this.generation;
    while (this.pending.has(id)) {
      await this.pending.get(id);
      if (generation !== this.generation) throw new OperationCancelled();
    }
    let finished;
    const pending = new Promise((resolve) => {
      finished = resolve;
    });
    this.pending.set(id, pending);
    const current = () => {
      if (generation !== this.generation) throw new OperationCancelled();
    };
    this.operations.set(id, (this.operations.get(id) || 0) + 1);
    this.busy.add(id);
    if (notifyBusy) this.changed();
    try {
      return await task(current);
    } catch (error) {
      if (generation === this.generation && isFileAccessError(error))
        this.#files.set(id, { ...this.#files.get(id), error: true });
      throw error;
    } finally {
      finished();
      if (this.pending.get(id) === pending) this.pending.delete(id);
      if (generation === this.generation) {
        this.busy.delete(id);
        if (notifyBusy) this.changed();
      }
    }
  }
  async probe(player, force = false) {
    const source = player?.playerSource;
    if (!source || this.busy.has(source.fileId)) return;
    const id = source.fileId;
    if (!force && Date.now() < (this.retryAfter.get(id) || 0)) return;
    if (!force && Date.now() - (this.checked.get(id) || 0) < 30000) return;
    this.checked.set(id, Date.now());
    const generation = this.generation;
    const operation = (this.operations.get(id) || 0) + 1;
    this.operations.set(id, operation);
    const current = () =>
      generation === this.generation &&
      operation === this.operations.get(id) &&
      !this.busy.has(id);
    try {
      const file = await this.drive.metadata({
        id,
        resourceKey: source.resourceKey,
      });
      if (!current()) return;
      file.resourceKey ||= source.resourceKey || "";
      this.retryAfter.delete(id);
      const previous = this.#files.get(id);
      if (previous?.profile && !previous.error) {
        const changed =
          !!previous.file.capabilities?.canEdit !==
          !!file.capabilities?.canEdit;
        previous.file.capabilities = file.capabilities;
        if (changed) this.changed();
        return;
      }
      const loaded = await this.drive.loadPlayer(file);
      if (!current()) return;
      loaded.draft = await this.readDraft(id);
      if (!current()) return;
      this.#files.set(id, loaded);
      this.remember(id);
      this.changed();
    } catch (error) {
      // A Drive share may supply both access layers; Picker remains a fallback.
      if (!current() || !isFileAccessError(error)) return;
      this.retryAfter.set(id, Date.now() + 5 * 60000);
      const previous = this.#files.get(id);
      if (previous && !previous.error) {
        this.#files.set(id, { ...previous, error: true });
        this.changed();
      }
    }
  }
  async open(player = null, folder = null) {
    return this.run(
      player?.playerSource?.fileId || "picker",
      async (current) => {
        const source = player?.playerSource;
        const [selected] = await this.picker.player(
          source ? { id: source.fileId, name: player.name } : null,
          folder,
        );
        current();
        if (source && selected.id !== source.fileId)
          throw new Error("Choose this player's linked file.");
        selected.resourceKey ||= source?.resourceKey || "";
        const loaded = await this.drive.loadPlayer(selected);
        current();
        if (folder) {
          const members = loaded.file.parents;
          if (
            members
              ? !members.includes(folder.id)
              : !(await this.drive.children(folder)).some(
                  (file) => file.id === loaded.file.id,
                )
          )
            throw new Error("Open a player file from the central team folder.");
          current();
        }
        loaded.draft = await this.readDraft(loaded.file.id);
        current();
        this.#files.set(loaded.file.id, loaded);
        this.remember(loaded.file.id);
        return loaded;
      },
    );
  }
  async create(player, folder) {
    if (!folder?.id || !folder.capabilities?.canAddChildren)
      throw new Error(
        "Player files must be created in the central team folder.",
      );
    return this.run("create", async (current) => {
      const existing = this.created.get(player.id);
      if (existing)
        return linkedPlayer(player, existing.profile, existing.file);
      const profile = validateProfile(
        recordPlayerProgress(null, player, {
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          account:
            this.actor()?.email ||
            this.actor()?.sub ||
            "Unknown Google account",
        }),
      );
      const activityLog = recordActivity(
        [],
        this.actor(),
        this.activitySession(),
        ["Created player file"],
      );
      const file = await this.drive.createPlayer(profile, folder, activityLog);
      current();
      this.#files.set(file.id, { file, profile, activityLog });
      this.remember(file.id);
      this.created.set(player.id, { file, profile });
      return linkedPlayer(player, profile, file);
    });
  }
  async saveOwn(player, resolveConflicts = async () => null, baseline = null) {
    const id = player.playerSource?.fileId;
    return this.run(id, async (current) => {
      const actor = this.actor(),
        sessionId = this.activitySession();
      const entry = this.#files.get(id);
      if (!entry || entry.error)
        throw new Error("Open player before saving its file.");
      const draft = {
        profile: validateProfile(player),
        baseline: entry.draft?.baseline || baseline || entry.profile,
      };
      entry.draft = draft;
      await this.writeDraft(id, draft);
      current();
      for (let attempt = 0; attempt < 4; attempt++) {
        const loaded = await this.drive.loadPlayer(entry.file);
        current();
        let result = mergePlayerProfiles(
          draft.baseline,
          draft.profile,
          loaded.profile,
        );
        if (result.conflicts.length) {
          const resolution = await resolveConflicts(result.conflicts);
          current();
          if (!resolution) throw new OperationCancelled();
          result = mergePlayerProfiles(
            draft.baseline,
            draft.profile,
            loaded.profile,
            resolution,
          );
        }
        const profile = validateProfile(result.profile);
        const changes = playerProfileChanges(loaded.profile, profile);
        const activityLog = recordActivity(
          loaded.activityLog || [],
          actor,
          sessionId,
          changes,
        );
        let file;
        try {
          file = await this.drive.savePlayer(loaded.file, profile, activityLog);
        } catch (error) {
          current();
          if (![409, 412].includes(error.status) || attempt === 3) throw error;
          continue;
        }
        current();
        this.#files.set(id, { file, profile, activityLog });
        await this.writeDraft(id, null);
        current();
        return profile;
      }
    });
  }
  async refreshCache(player, validate = () => {}) {
    const source = player.playerSource;
    if (!source || !this.state(player).connected)
      throw new Error("Player file access is needed to refresh its cache.");
    return this.run(
      source.fileId,
      async (current) => {
        const file = await this.drive.metadata({
          id: source.fileId,
          resourceKey: source.resourceKey,
        });
        current();
        file.resourceKey ||= source.resourceKey || "";
        const entry = this.#files.get(source.fileId);
        const loaded =
          entry?.profile && !entry.error && entry.file.version === file.version
            ? { file, profile: entry.profile, activityLog: entry.activityLog }
            : await this.drive.loadPlayer(file);
        current();
        const profile = validateProfile(loaded.profile);
        validate(profile);
        const previous = this.#files.get(source.fileId);
        this.#files.set(source.fileId, {
          ...loaded,
          profile,
          draft: previous?.draft,
        });
        if (
          source.version === loaded.file.version &&
          profileFingerprint(playerProfile(player)) ===
            profileFingerprint(profile)
        )
          return player;
        return linkedPlayer(player, profile, loaded.file);
      },
      { notifyBusy: false },
    );
  }
}
