import {
  applyPlayerProfile,
  linkedPlayer,
  mergePlayerProfiles,
  playerProfile,
  profileFingerprint,
  validateProfile,
} from "../domain/player-document.js";
import { OperationCancelled } from "./cancellation.js";

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
  }) {
    Object.assign(this, {
      drive,
      picker,
      remember,
      changed,
      readDraft,
      writeDraft,
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
    this.operations = new Map();
  }
  state(player) {
    if (!player?.playerSource)
      return { label: "Team copy", connected: false, canEdit: false };
    const state = this.#files.get(player.playerSource.fileId);
    return {
      label: state?.error
        ? "Player file unavailable · Unlock player to reconnect"
        : !state
          ? "Team copy · Unlock player to edit or sync"
          : state.file.capabilities?.canEdit
            ? "Player unlocked"
            : "Player locked · Read-only file",
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
  cachedPlayer(player) {
    const entry = this.#files.get(player.playerSource?.fileId);
    if (!entry?.profile || entry.error)
      throw new Error("Player file is unavailable.");
    return linkedPlayer(player, entry.profile, entry.file);
  }
  async run(id, task) {
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
    this.changed();
    try {
      return await task(current);
    } catch (error) {
      if (generation === this.generation && [403, 404].includes(error.status))
        this.#files.set(id, { ...this.#files.get(id), error: true });
      throw error;
    } finally {
      finished();
      if (this.pending.get(id) === pending) this.pending.delete(id);
      if (generation === this.generation) {
        this.busy.delete(id);
        this.changed();
      }
    }
  }
  async probe(player, force = false) {
    const source = player?.playerSource;
    if (!source || this.busy.has(source.fileId)) return;
    const id = source.fileId;
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
      const previous = this.#files.get(id);
      if (previous?.profile && !previous.error) {
        const changed =
          !!previous.file.capabilities?.canEdit !==
          !!file.capabilities?.canEdit;
        previous.file.capabilities = file.capabilities;
        if (changed) this.changed();
        return;
      }
      if (!file.capabilities?.canEdit) {
        this.#files.set(id, { ...previous, file, error: false });
        if (!previous || previous.error) this.changed();
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
      if (!current() || ![403, 404].includes(error.status)) return;
      const previous = this.#files.get(id);
      if (previous && !previous.error) {
        this.#files.set(id, { ...previous, error: true });
        this.changed();
      }
    }
  }
}
