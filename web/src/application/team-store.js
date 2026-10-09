import { createEmptyPlan } from "../domain/plan.js";
import { validatePlan } from "../domain/validation.js";

function readonly(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) readonly(child);
    Object.freeze(value);
  }
  return value;
}

// The team document is immutable; opening a document is a validation boundary.
export class TeamStore {
  #plan = readonly(createEmptyPlan());
  readOnly = false;
  listeners = new Set();
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
    this.emit("replace");
    return true;
  }
}
