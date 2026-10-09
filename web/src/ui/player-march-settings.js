import { numeric, element, numberInput } from "./player-fields.js";
import {
  marchType,
  marchCapacity,
  strategyWeights,
} from "../domain/march-generation.js";

export function renderMarchSettings({
  root,
  march,
  getSizes,
  generate,
  renderMarch,
  explicit,
}) {
  root.replaceChildren();
  const g = march.generation;
  function field(name, input) {
    const label = element("label", name);
    label.append(input);
    root.append(label);
    return input;
  }
  const sizeGroup = element("span", undefined, "march-capacity-field");
  const capacity = numberInput(
    marchCapacity(march, getSizes()),
    "March capacity (+200%)",
  );
  capacity.id = "player-march-capacity";
  sizeGroup.append(capacity);
  const reset = element("button", "↺");
  reset.type = "button";
  reset.id = "player-march-capacity-reset";
  reset.setAttribute("aria-label", "Use player's march size");
  reset.hidden = march.capacityOverride == null;
  reset.onclick = () => {
    march.capacityOverride = null;
    generate();
    renderMarch();
  };
  sizeGroup.append(reset);
  field("March size", sizeGroup);
  capacity.onchange = () => {
    march.capacityOverride = numeric(capacity);
    explicit.add(march.id);
    generate();
    renderMarch();
  };
  const highest = element("select");
  highest.id = "player-march-highest";
  for (let tier = 10; tier <= 17; tier++) {
    const option = element("option", `T${tier}`);
    option.value = tier;
    highest.append(option);
  }
  highest.value = g.highestTier;
  field("Highest tier", highest);
  highest.onchange = () => {
    g.highestTier = Number(highest.value);
    g.weights = strategyWeights(marchType(march), g.strategy, g.highestTier);
    explicit.add(march.id);
    generate();
    renderMarch();
  };
  const layer = numberInput(g.layerSize, "Support layer size");
  layer.id = "player-march-layer-size";
  field("Layers", layer);
  layer.onchange = () => {
    g.layerSize = numeric(layer);
    explicit.add(march.id);
    generate();
    renderMarch();
  };
  const strategy = element("select");
  strategy.id = "player-march-strategy";
  for (const [value, name] of marchType(march) === "siege"
    ? [
        ["big-siege", "Big siege"],
        ["small-siege", "Small siege"],
      ]
    : [["balanced", "Balanced"]]) {
    const option = element("option", name);
    option.value = value;
    strategy.append(option);
  }
  strategy.value = g.strategy;
  field("Strategy", strategy);
  strategy.onchange = () => {
    g.strategy = strategy.value;
    g.weights = strategyWeights(marchType(march), g.strategy, g.highestTier);
    explicit.add(march.id);
    generate();
    renderMarch();
  };
}
