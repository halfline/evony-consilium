import { OperationCancelled } from "./cancellation.js";

// One background pass per workspace, independent of the selected profile.
export class PlayerCacheSync {
  constructor({ players, profiles, sync, getPlan, isEditing, save, status }) {
    Object.assign(this, {
      players,
      profiles,
      sync,
      getPlan,
      isEditing,
      save,
      status,
    });
    this.reset();
  }
  reset() {
    this.generation = (this.generation || 0) + 1;
    this.running = null;
  }
  canRefresh() {
    return (
      !this.isEditing() &&
      this.sync.canCheck() &&
      !!this.sync.file &&
      !this.sync.saving &&
      !this.sync.remoteChanged
    );
  }
  async refresh() {
    if (this.running || !this.profiles.refreshPlan || !this.canRefresh())
      return;
    const generation = this.generation,
      pass = {};
    this.running = pass;
    try {
      const before = this.getPlan(),
        updates = [];
      for (const player of before.keeps) {
        if (
          generation !== this.generation ||
          !this.canRefresh() ||
          this.getPlan() !== before
        )
          return;
        if (!player.playerSource) continue;
        // Members refresh connected files; reading a roster does not probe
        // every other member's unconnected source. Editors publish all accessible caches.
        if (
          !this.sync.file.capabilities?.canEdit &&
          !this.players.state(player).connected
        )
          continue;
        try {
          await this.players.probe(player);
          if (
            generation !== this.generation ||
            !this.canRefresh() ||
            this.getPlan() !== before
          )
            return;
          const state = this.players.state(player);
          if (!state.connected || state.busy) continue;
          updates.push(await this.profiles.collectCache(player));
        } catch (error) {
          if (error instanceof OperationCancelled || error.status === 401)
            throw error;
          this.status(
            `Could not refresh ${player.name}: ${error.message}`,
            true,
          );
        }
      }
      if (
        generation !== this.generation ||
        !this.canRefresh() ||
        this.getPlan() !== before
      )
        return;
      this.profiles.commitCaches(before, updates);
      // Also retry a previous publication even if the visible cache is current.
      if (updates.length && this.sync.file.capabilities?.canEdit)
        await this.save(updates);
    } catch (error) {
      if (
        generation === this.generation &&
        !(error instanceof OperationCancelled)
      ) {
        this.status("Automatic player refresh paused: " + error.message, true);
      }
    } finally {
      if (this.running === pass) {
        this.running = null;
      }
    }
  }
}
