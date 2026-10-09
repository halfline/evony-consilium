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
      !!this.sync.file?.capabilities?.canEdit &&
      !this.sync.saving &&
      !this.sync.remoteChanged &&
      !this.sync.dirty
    );
  }
  async refresh() {
    if (this.running || !this.profiles.commitPlan || !this.canRefresh()) return;
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
      if (this.profiles.commitCaches(before, updates)) await this.save();
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
