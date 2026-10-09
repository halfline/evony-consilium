import { addPlayer } from "../domain/players.js";

// Coordinates authoritative profile files and their read-only team cache.
// Views supply only presentation decisions; plan mutations use injected transactions.
export class PlayerProfiles {
  constructor({ workspace, getPlan, commitPlan, validatePlan, isEditing }) {
    Object.assign(this, {
      workspace,
      getPlan,
      commitPlan,
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
    const folder = await this.workspace.playerFolder();
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
    if (player.playerSource) return this.workspace.players.open(player);
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
}
