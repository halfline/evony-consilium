import { createEmptyPlan } from "../domain/plan.js";
import { validatePlan } from "../domain/validation.js";

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
  constructor(_catalog, { historyLimit = 20 } = {}) {
    this.historyLimit = historyLimit;
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
  replace(input, { force = false } = {}) {
    if (this.readOnly && !force) return false;
    this.#plan = readonly(validatePlan(input));
    this.#history = [];
    this.emit("replace");
    return true;
  }
  commit(input) {
    if (this.readOnly) return false;
    const next = readonly(structuredClone(input));
    if (fingerprint(next) === fingerprint(this.#plan)) return false;
    this.#history.push(this.#plan);
    if (this.#history.length > this.historyLimit) this.#history.shift();
    this.#plan = next;
    this.emit("edit");
    return true;
  }
  mutate(change) {
    if (this.readOnly) return false;
    const next = structuredClone(this.#plan);
    change(next);
    return this.commit(next);
  }
}
