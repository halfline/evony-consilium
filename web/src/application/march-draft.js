import { MARCH_PRESETS, TROOP_TYPES } from "../domain/troops.js";
import { newMarch } from "../domain/attack-marches.js";
import {
  marchType,
  initialGeneration,
  regenerateMarch,
  strategyWeights,
} from "../domain/march-generation.js";

// Uncommitted march edits belong to a draft, independent of its rendered controls.
export class MarchDraft {
  constructor(getSizes) {
    this.getSizes = getSizes;
    this.explicit = new Set();
    this.errors = new Map();
    this.marches = [];
    this.currentIndex = 0;
  }
  get current() {
    return this.marches[this.currentIndex];
  }
  generate(index = this.currentIndex) {
    const march = this.marches[index];
    try {
      this.marches[index] = regenerateMarch(march, this.getSizes());
      this.errors.delete(march.id);
    } catch (error) {
      this.errors.set(march.id, error.message);
    }
  }
  syncSizes() {
    this.marches.forEach((_, index) => this.generate(index));
  }
  load(details, level) {
    this.maxTier = level >= 50 ? 17 : level >= 45 ? 16 : 15;
    this.original = structuredClone(details);
    this.explicit.clear();
    this.errors.clear();
    this.marches = structuredClone(details.marches || []);
    for (const preset of MARCH_PRESETS)
      if (
        this.marches.length < 50 &&
        !this.marches.some((march) => march.name === preset.name)
      )
        this.marches.push(
          newMarch(preset.name, preset.troopType, this.maxTier),
        );
    this.marches.forEach((march, index) => {
      march.layers ||= [];
      march.troopType = marchType(march);
      if (!march.generation) {
        march.generation = initialGeneration(
          march,
          Math.min(
            17,
            Math.max(this.maxTier, ...march.layers.map((row) => row.tier)),
          ),
        );
        march.generation.manual =
          march.layers.some((row) =>
            TROOP_TYPES.some((type) => row[type] != null),
          ) || Object.values(march.bases || {}).some((value) => value != null);
      }
      this.generate(index);
    });
    this.currentIndex = 0;
  }
  markEdited() {
    this.explicit.add(this.current.id);
  }
  count(tier, type, value) {
    const march = this.current;
    let row = march.layers.find((row) => row.tier === tier);
    if (!row) march.layers.push((row = { tier }));
    row[type] = value;
    this.manual();
  }
  base(type, value) {
    (this.current.bases ||= {})[type] = value;
    this.manual();
  }
  manual() {
    this.current.generation.manual = true;
    this.markEdited();
  }
  addTier() {
    const march = this.current;
    const tier = march.generation.highestTier + 1;
    if (tier > 17) return;
    march.generation.highestTier = tier;
    march.generation.weights = strategyWeights(
      marchType(march),
      march.generation.strategy,
      tier,
    );
    if (march.generation.manual) march.layers.push({ tier });
    else this.generate();
  }
}
