import { OperationCancelled } from "./cancellation.js";
import { addPlayer } from "../domain/players.js";
import { applyPlayerProfile, linkedPlayer } from "../domain/player-document.js";
import { applyProfileCaches } from "../domain/team-collaboration.js";

// Coordinates authoritative profile files and their read-only team cache.
// Views supply only presentation decisions; plan mutations use injected transactions.
export class PlayerProfiles {
  constructor({
    workspace,
    getPlan,
    commitPlan,
    refreshPlan = commitPlan,
    validatePlan,
    isEditing,
  }) {
    Object.assign(this, {
      workspace,
      getPlan,
      commitPlan,
      refreshPlan,
      validatePlan,
      isEditing,
    });
  }
  canEditTeam() {
    return !!this.workspace.sync.file?.capabilities?.canEdit;
  }
  player(id) {
    return this.getPlan().keeps.find((player) => player.id === id);
  }
  context() {
    return this.workspace.players.captureContext();
  }
  replaceCached(player) {
    const next = structuredClone(this.getPlan());
    const index = next.keeps.findIndex((item) => item.id === player.id);
    if (index === -1) throw new Error("Player is no longer on the team.");
    next.keeps[index] = player;
    this.validatePlan(next);
    this.commitPlan(next);
  }
  editingPlan(id) {
    const plan = this.getPlan(),
      player = this.player(id);
    if (!player) return plan;
    const profile = this.workspace.players.profile(player);
    if (profile === player) return plan;
    return {
      ...plan,
      keeps: plan.keeps.map((item) => (item.id === id ? profile : item)),
    };
  }
  async add(player) {
    if (!this.canEditTeam())
      throw new Error("Team write access is needed to add players.");
    this.validatePlan(addPlayer(this.getPlan(), player));
    this.workspace.authorize();
    const current = this.context();
    const folder = await this.workspace.playerFolder({ interactive: false });
    current();
    const linked = await this.workspace.players.create(player, folder);
    current();
    if (!this.canEditTeam())
      throw new Error(
        "Team access changed. The central player file has been retained.",
      );
    const next = addPlayer(this.getPlan(), linked);
    this.validatePlan(next);
    this.commitPlan(next);
    return linked;
  }
  async unlock(id) {
    const player = this.player(id);
    if (!player) throw new Error("Player is no longer on the team.");
    this.workspace.authorize();
    if (player.playerSource) {
      await this.workspace.players.probe(player, true);
      if (this.workspace.players.state(player).connected) return;
      this.workspace.status?.(
        "Choose this player's file to connect it. Editing requires Editor access from its owner in Drive.",
      );
      return this.workspace.players.open(player);
    }
    if (!this.canEditTeam())
      throw new Error(
        "Ask an admin to create this player's central file before unlocking.",
      );
    const current = this.context(),
      before = JSON.stringify(player);
    const folder = await this.workspace.playerFolder();
    current();
    const linked = await this.workspace.players.create(player, folder);
    current();
    if (!this.canEditTeam() || JSON.stringify(this.player(id)) !== before)
      throw new Error(
        "The roster changed. The player file was created; retry unlocking to link it.",
      );
    this.replaceCached(linked);
  }
  async save(player, resolve, baseline) {
    if (!this.workspace.players.state(player).canEdit)
      throw new Error(
        "Connect this player's file with Editor access to edit its profile.",
      );
    const current = this.context();
    await this.workspace.players.saveOwn(player, resolve, baseline);
    current();
    const cached = this.player(player.id);
    if (cached) {
      const update = this.workspace.players.cachedPlayer(cached);
      const next = applyProfileCaches(this.getPlan(), [update]);
      this.validatePlan(next);
      this.refreshPlan(next, (snapshot) =>
        applyProfileCaches(snapshot, [update]),
      );
      if (this.canEditTeam()) {
        try {
          await this.workspace.publishPlayers?.([update]);
        } catch (error) {
          this.workspace.status?.(
            "Player saved. Team cache publication will retry: " + error.message,
            true,
          );
        }
      }
    }
  }
  async collectCache(player) {
    if (this.isEditing()) throw new OperationCancelled();
    return this.workspace.players.refreshCache(player, (profile) => {
      if (this.isEditing()) throw new OperationCancelled();
      const next = structuredClone(this.getPlan());
      const index = next.keeps.findIndex((item) => item.id === player.id);
      if (index === -1) throw new OperationCancelled();
      next.keeps[index] = applyPlayerProfile(next.keeps[index], profile);
      this.validatePlan(next);
    });
  }
  commitCaches(before, updates) {
    if (this.isEditing() || this.getPlan() !== before)
      throw new OperationCancelled();
    const changed = updates.filter(
      (player) => player !== before.keeps.find((item) => item.id === player.id),
    );
    if (!changed.length) return false;
    const next = applyProfileCaches(before, changed);
    this.validatePlan(next);
    this.refreshPlan(next, (snapshot) => applyProfileCaches(snapshot, changed));
    return true;
  }
  async import() {
    if (!this.canEditTeam())
      throw new Error(
        "Team Editor access is needed to add an existing player.",
      );
    this.workspace.authorize();
    const current = this.context();
    const folder = this.workspace.project.folder;
    if (folder.id === this.workspace.sync.file.id)
      throw new Error(
        "Move the team document into a folder before linking players.",
      );
    this.workspace.status(
      "Choose an existing player profile in this team's folder. Roster membership is published with Save team.",
    );
    const loaded = await this.workspace.players.open(null, folder);
    current();
    if (!this.canEditTeam())
      throw new Error(
        "Team access changed. Reopen the team before adding players.",
      );
    if (
      this.getPlan().keeps.some(
        (player) => player.playerSource?.fileId === loaded.file.id,
      )
    )
      throw new Error("This player is already on the team.");
    const player = linkedPlayer(
      { id: crypto.randomUUID(), w: 2, h: 2, x: null, y: null, locked: false },
      loaded.profile,
      loaded.file,
    );
    const next = addPlayer(this.getPlan(), player);
    next.excludedPlayerFileIds = (next.excludedPlayerFileIds || []).filter(
      (id) => id !== loaded.file.id,
    );
    this.validatePlan(next);
    this.commitPlan(next);
    return player;
  }
}
