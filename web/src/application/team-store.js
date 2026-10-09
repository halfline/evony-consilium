import { createEmptyPlan } from "../domain/plan.js";
import { validatePlan } from "../domain/validation.js";
import { updateKeepAppearances } from "../domain/castles.js";
import { selectMapPlan, syncMapLayouts } from "../domain/map-plans.js";
import { ensureRallySetter } from "../domain/rally.js";

function readonly(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) readonly(child);
    Object.freeze(value);
  }
  return value;
}
const fingerprint = (value) =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );

// The team document is immutable; opening a document is a validation boundary.
export class TeamStore {
  #plan = readonly(createEmptyPlan());
  #history = [];
  readOnly = false;
  listeners = new Set();
  constructor(catalog = { assets: [] }, { historyLimit = 20, assets = new Map() } = {}) {
    this.catalog = catalog;
    this.assets = assets;
    this.historyLimit = historyLimit;
    this.refreshAssets();
  }
  get plan() {
    return this.#plan;
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  emit(kind) {
    for (const listener of this.listeners) listener({ kind, plan: this.#plan });
  }
  prepare(input) {
    const next = structuredClone(input);
    const assets = new Map(
      [...this.catalog.assets, ...(next.customAssets || [])].map((asset) => [asset.id, asset]),
    );
    updateKeepAppearances(next.keeps, assets);
    ensureRallySetter(next);
    syncMapLayouts(next);
    return readonly(next);
  }
  refreshAssets() {
    this.assets.clear();
    for (const asset of [...this.catalog.assets, ...(this.#plan.customAssets || [])])
      this.assets.set(asset.id, asset);
  }
  replace(input, { force = false } = {}) {
    if (this.readOnly && !force) return false;
    this.#plan = this.prepare(validatePlan(input, this.catalog));
    this.#history = [];
    this.refreshAssets();
    this.emit("replace");
    return true;
  }
  commit(input) {
    if (this.readOnly) return false;
    const next = this.prepare(input);
    if (fingerprint(next) === fingerprint(this.#plan)) return false;
    this.#history.push(this.#plan);
    if (this.#history.length > this.historyLimit) this.#history.shift();
    this.#plan = next;
    this.refreshAssets();
    this.emit("edit");
    return true;
  }
  mutate(change) {
    if (this.readOnly) return false;
    const next = structuredClone(this.#plan);
    change(next);
    return this.commit(next);
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
  openMap(id) {
    this.#plan = readonly(selectMapPlan(this.#plan, id));
    this.refreshAssets();
    this.emit("navigate");
  }
}
