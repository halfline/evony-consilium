import { readSaved, writeSaved } from "./indexed-db.js";
import {
  rememberedProjects,
  rememberProject,
  forgetProject,
} from "./remembered-projects.js";

export class TeamRepository {
  constructor(storage, { read = readSaved, write = writeSaved } = {}) {
    Object.assign(this, { storage, read, write });
  }
  openedPlayers(account) {
    try {
      const value = JSON.parse(
        this.storage.getItem(`consilium:player-grants:${account}`) || "[]",
      );
      return Array.isArray(value)
        ? value.filter((id) => typeof id === "string")
        : [];
    } catch {
      return [];
    }
  }
  rememberPlayer(account, fileId) {
    try {
      this.storage.setItem(
        `consilium:player-grants:${account}`,
        JSON.stringify([...new Set([...this.openedPlayers(account), fileId])]),
      );
    } catch {
      /* Access can still be used during this session. */
    }
  }
  list(account) {
    return rememberedProjects(this.storage, account);
  }
  remember(account, team) {
    rememberProject(this.storage, account, team);
  }
  forget(account, id) {
    forgetProject(this.storage, account, id);
  }
}
