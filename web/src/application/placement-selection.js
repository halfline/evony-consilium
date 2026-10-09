import { ENTITY_COLLECTIONS } from "../domain/entities.js";

// Navigation and placement intent are separate from persisted team edits.
export class PlacementSelection {
  id = null;
  pending = null;
  ids = new Set();
  constructor(getPlan) {
    this.getPlan = getPlan;
  }
  get entities() {
    const plan = this.getPlan();
    return ENTITY_COLLECTIONS.flatMap((collection) => plan[collection]);
  }
  get selected() {
    return this.entities.find((entity) => entity.id === this.id);
  }
  select(id) {
    this.id = id;
    this.pending = null;
  }
  reconcile() {
    const present = new Set(this.entities.map((entity) => entity.id));
    if (!present.has(this.id)) this.id = null;
    if (!present.has(this.pending)) this.pending = null;
    for (const id of this.ids) if (!present.has(id)) this.ids.delete(id);
  }
  clear() {
    this.id = null;
    this.pending = null;
    this.ids.clear();
  }
}
