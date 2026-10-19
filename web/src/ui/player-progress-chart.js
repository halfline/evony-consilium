import { element } from "./player-fields.js";
import { progressDay } from "../domain/player-progress.js";
import { metricName } from "./player-progress-controls.js";

const colors = ["#ddc58b", "#7fc7b1", "#91b9e5"];
const states = new WeakMap();
const compact = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});
export const progressValue = (value, unit = "") =>
  value === null
    ? "—"
    : `${value.toLocaleString()}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}`;
export const progressDate = (at, { showTime = false } = {}) =>
  new Date(at).toLocaleString(undefined, {
    dateStyle: "medium",
    ...(showTime ? { timeStyle: "short" } : {}),
  });
const shortDate = (at) =>
  new Date(at).toLocaleDateString(undefined, { dateStyle: "medium" });
const observedAt = (point) => point.observedAt || point.at;
const svgNode = (tag, attrs = {}, text) => {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs))
    node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
};

export function renderProgressChart(
  root,
  series,
  onSelect,
  { daily = true } = {},
) {
  root.replaceChildren();
  const signature = series.map((line) => line.key).join(",");
  if (states.get(root)?.signature !== signature)
    states.set(root, { signature, hidden: new Set(), selected: null });
  const state = states.get(root);
  const summary = element("div", undefined, "progress-summary");
  for (const line of series) {
    const first = line.points[0],
      last = line.points.at(-1);
    const card = element(
      last ? "button" : "div",
      undefined,
      "progress-summary-card",
    );
    card.append(
      element("span", metricName(line), "muted"),
      element("strong", last ? progressValue(last.value, line.unit) : "—"),
    );
    if (last) {
      card.type = "button";
      card.dataset.progressSnapshot = last.id;
      card.setAttribute(
        "aria-label",
        `${line.label}: ${progressValue(last.value, line.unit)} · ${progressDate(observedAt(last), last)}`,
      );
      card.onclick = () => onSelect(last.id);
      if (
        first.value !== null &&
        last.value !== null &&
        (line.points.length > 1 || last.carried)
      ) {
        const delta = last.value - first.value;
        const change =
          delta === 0
            ? "No recorded change"
            : `${delta > 0 ? "+" : "−"}${Math.abs(delta).toLocaleString()}${line.unit === "%" ? " pp" : line.unit ? ` ${line.unit}` : ""} since ${shortDate(observedAt(first))}`;
        card.append(element("span", change, "progress-delta"));
      }
      card.append(
        element(
          "span",
          `Recorded ${progressDate(observedAt(last), last)}`,
          "muted",
        ),
      );
    } else card.append(element("span", "Not recorded", "muted"));
    summary.append(card);
  }
  root.append(summary);
}
