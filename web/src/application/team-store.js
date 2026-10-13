import { ensureRallySetter, ensureMapRallySetters } from "../domain/rally.js";
import { createEmptyPlan } from "../domain/plan.js";
import { validatePlan } from "../domain/validation.js";
import {
  projectFingerprint,
  selectMapPlan,
  syncMapLayouts,
} from "../domain/map-plans.js";
import { updateKeepAppearances } from "../domain/castles.js";
import { normalizeGameFootprints } from "../domain/game-footprints.js";

// Stored documents are immutable; callers must use an edit transaction.
function readonly(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) readonly(child);
    Object.freeze(value);
  }
  return value;
}

// Shared editable data and Undo history; navigation does not alter edit snapshots.
export class TeamStore {
  #plan;
  readOnly = false;
  #history = [];
  #historyLimit;
  constructor(catalog, { historyLimit = 20, assets = new Map() } = {}) {
    this.catalog = catalog;
    this.#historyLimit = historyLimit;
    this.assets = assets;
    this.listeners = new Set();
    this.#history = [];
    this.#plan = this.prepare(createEmptyPlan());
    this.refreshAssets();
  }
  get plan() {
    return this.#plan;
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  emit(kind, footprintRepairs = []) {
    for (const listener of this.listeners)
      listener({ kind, plan: this.#plan, footprintRepairs });
  }
  prepare(input, footprintRepairs = []) {
    const next = structuredClone(input);
    const assets = new Map(
      [...this.catalog.assets, ...next.customAssets].map((asset) => [
        asset.id,
        asset,
      ]),
    );
    updateKeepAppearances(next.keeps, assets);
    footprintRepairs.push(...normalizeGameFootprints(next, assets));
    ensureMapRallySetters(next);
    return readonly(syncMapLayouts(next));
  }
  refreshAssets() {
    this.assets.clear();
    for (const asset of [...this.catalog.assets, ...this.#plan.customAssets])
      this.assets.set(asset.id, asset);
  }
  replace(input, { force = false } = {}) {
    if (this.readOnly && !force) return false;
    // Downloads/imports are the trust boundary. Unknown profile fields survive validation.
    const repairs = [];
    const next = this.prepare(
      validatePlan(input, this.catalog, true, repairs),
      repairs,
    );
    this.#plan = next;
    this.#history = [];
    this.refreshAssets();
    this.emit("replace", repairs);
  }
  commit(input) {
    if (this.readOnly) return false;
    const repairs = [];
    const next = this.prepare(input, repairs);
    if (projectFingerprint(next) === projectFingerprint(this.#plan))
      return false;
    this.#history.push(this.#plan);
    if (this.#history.length > this.#historyLimit) this.#history.shift();
    this.#plan = next;
    this.refreshAssets();
    this.emit("edit", repairs);
    return true;
  }
  mutate(change) {
    if (this.readOnly) return false;
    const next = structuredClone(this.#plan);
    change(next);
    return this.commit(next);
  }
  refresh(input, rebaseHistory = (plan) => plan) {
    const repairs = [];
    const next = this.prepare(
      validatePlan(structuredClone(input), this.catalog, true, repairs),
      repairs,
    );
    this.#history = this.#history.flatMap((snapshot) => {
      try {
        return [
          this.prepare(validatePlan(rebaseHistory(snapshot), this.catalog)),
        ];
      } catch {
        return [];
      }
    });
    this.#plan = next;
    this.refreshAssets();
    this.emit("refresh", repairs);
  }
  openMap(id) {
    this.#plan = this.prepare(ensureRallySetter(selectMapPlan(this.#plan, id)));
    this.refreshAssets();
    this.emit("navigate");
  }
  get canUndo() {
    return !this.readOnly && this.#history.length > 0;
  }
  undo() {
    if (!this.canUndo) return false;
    this.#plan = this.#history.pop();
    this.refreshAssets();
    this.emit("undo");
    return true;
  }
}
