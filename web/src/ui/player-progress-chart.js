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
  const measured = series.filter((line) =>
    line.points.some((point) => point.value !== null),
  );
  if (!measured.length) return;
  const dates = new Set(
    measured.flatMap((line) =>
      line.points
        .filter((point) => point.value !== null)
        .map((point) => (daily ? progressDay(point.at) : point.at)),
    ),
  );
  if (
    dates.size <= 1 ||
    measured.every((line) => line.points.every((point) => point.carried))
  )
    return;

  const legend = element("div", undefined, "progress-legend");
  if (measured.every((line) => state.hidden.has(line.key)))
    state.hidden.clear();
  measured.forEach((line) => {
    const index = series.indexOf(line);
    const toggle = element("button", metricName(line));
    toggle.type = "button";
    toggle.dataset.progressSeries = line.key;
    toggle.setAttribute("aria-label", `Show ${metricName(line)}`);
    toggle.setAttribute("aria-pressed", String(!state.hidden.has(line.key)));
    toggle.style.setProperty("--series-color", colors[index % colors.length]);
    toggle.onclick = () => {
      if (state.hidden.has(line.key)) state.hidden.delete(line.key);
      else if (
        measured.filter((item) => !state.hidden.has(item.key)).length > 1
      )
        state.hidden.add(line.key);
      renderProgressChart(root, series, onSelect, { daily });
      [...root.querySelectorAll("[data-progress-series]")]
        .find((node) => node.dataset.progressSeries === line.key)
        ?.focus();
    };
    legend.append(toggle);
  });
  root.append(legend);
  const active = measured.filter((line) => !state.hidden.has(line.key));
  const points = active
    .flatMap((line) =>
      line.points
        .filter((point) => point.value !== null)
        .map((point) => ({ ...point, line })),
    )
    .sort((a, b) => a.at.localeCompare(b.at));
  const width = Math.max(
    280,
    Math.min(800, root.clientWidth ? root.clientWidth - 24 : 800),
  );
  const height = width < 500 ? 250 : 280,
    left = width < 500 ? 58 : 74,
    right = 22,
    top = 20,
    bottom = 42;
  const times = active.flatMap((line) =>
    line.points.map((point) => Date.parse(point.at)),
  );
  let minX = times.reduce((min, value) => Math.min(min, value), Infinity),
    maxX = times.reduce((max, value) => Math.max(max, value), -Infinity);
  if (minX === maxX) {
    minX -= 43200000;
    maxX += 43200000;
  }
  let minY = points.reduce(
      (min, point) => Math.min(min, point.value),
      Infinity,
    ),
    maxY = points.reduce((max, point) => Math.max(max, point.value), -Infinity);
  const margin = (maxY - minY) * 0.1 || Math.max(1, Math.abs(maxY) * 0.05);
  minY = Math.max(Math.min(...active.map((line) => line.min)), minY - margin);
  maxY = Math.min(Math.max(...active.map((line) => line.max)), maxY + margin);
  const x = (time) =>
    left + ((time - minX) / (maxX - minX)) * (width - left - right);
  const y = (value) =>
    height -
    bottom -
    ((value - minY) / (maxY - minY)) * (height - top - bottom);
  const svg = svgNode("svg", {
    viewBox: `0 0 ${width} ${height}`,
    role: "group",
    "aria-label": "Player progress chart",
  });
  const ticks = new Set();
  for (let tick = 0; tick <= 4; tick++) {
    let value = minY + ((maxY - minY) * tick) / 4;
    if (active.every((line) => line.integer)) value = Math.round(value);
    if (ticks.has(value)) continue;
    ticks.add(value);
    svg.append(
      svgNode("line", {
        x1: left,
        x2: width - right,
        y1: y(value),
        y2: y(value),
        class: "progress-gridline",
      }),
    );
    svg.append(
      svgNode(
        "text",
        {
          x: left - 8,
          y: y(value) + 4,
          "text-anchor": "end",
          class: "progress-axis",
        },
        `${compact.format(value)}${active[0].unit === "%" ? "%" : ""}`,
      ),
    );
  }
  for (const time of width < 500
    ? [minX, maxX]
    : [minX, (minX + maxX) / 2, maxX])
    svg.append(
      svgNode(
        "text",
        {
          x: x(time),
          y: height - 10,
          "text-anchor":
            time === minX ? "start" : time === maxX ? "end" : "middle",
          class: "progress-axis",
        },
        new Date(time).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "2-digit",
        }),
      ),
    );
  for (const line of active) {
    let path = "",
      drawing = false;
    for (const point of line.points) {
      if (point.value === null) {
        drawing = false;
        continue;
      }
      path += drawing
        ? `H${x(Date.parse(point.at))} V${y(point.value)} `
        : `M${x(Date.parse(point.at))},${y(point.value)} `;
      drawing = true;
    }
    svg.append(
      svgNode("path", {
        d: path,
        fill: "none",
        stroke: colors[series.indexOf(line) % colors.length],
        "stroke-width": 2,
        "vector-effect": "non-scaling-stroke",
      }),
    );
  }
  const readout = element("div", undefined, "progress-point-description");
  const description = element("span");
  description.setAttribute("role", "status");
  const controls = element("div", undefined, "progress-point-controls");
  const action = (label, handler) => {
    const node = element("button", label);
    node.type = "button";
    node.onclick = handler;
    return node;
  };
  const token = (point) => `${point.line.key}:${point.id}:${point.at}`;
  let selected = points.findIndex((point) => token(point) === state.selected);
  if (selected < 0) selected = points.length - 1;
  const selectPoint = (index) => {
    selected = index;
    state.selected = token(points[index]);
    const point = points[index];
    description.textContent = `${point.line.label}: ${progressValue(point.value, point.line.unit)} · ${progressDate(observedAt(point), point)}`;
    for (const node of svg.querySelectorAll("[data-point-index]"))
      node.setAttribute(
        "aria-pressed",
        String(Number(node.dataset.pointIndex) === index),
      );
    previous.disabled = index === 0;
    next.disabled = index === points.length - 1;
  };
  const previous = action("←", () => selectPoint(selected - 1));
  previous.setAttribute("aria-label", "Previous observation");
  const next = action("→", () => selectPoint(selected + 1));
  next.setAttribute("aria-label", "Next observation");
  controls.append(
    previous,
    next,
    action("View record", () => onSelect(points[selected].id)),
  );
  readout.append(description, controls);
  points.forEach((point, index) => {
    const label = `${point.line.label}: ${progressValue(point.value, point.line.unit)} · ${progressDate(observedAt(point), point)}`;
    const dot = svgNode("g", {
      tabindex: 0,
      role: "button",
      "aria-label": label,
      "data-progress-point": point.id,
      "data-point-index": index,
      class: "progress-point",
    });
    dot.append(svgNode("title", {}, label));
    dot.append(
      svgNode("circle", {
        cx: x(Date.parse(point.at)),
        cy: y(point.value),
        r: 22,
        fill: "transparent",
        class: "progress-point-target",
      }),
    );
    dot.append(
      svgNode("circle", {
        cx: x(Date.parse(point.at)),
        cy: y(point.value),
        r: width < 500 ? 5 : 4,
        fill: colors[series.indexOf(point.line) % colors.length],
        class: "progress-point-dot",
      }),
    );
    dot.onfocus = dot.onpointerenter = dot.onclick = () => selectPoint(index);
    dot.onkeydown = (event) => {
      if (["Enter", " ", "ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
        selectPoint(
          event.key === "ArrowLeft"
            ? Math.max(0, selected - 1)
            : event.key === "ArrowRight"
              ? Math.min(points.length - 1, selected + 1)
              : index,
        );
      }
    };
    svg.append(dot);
  });
  selectPoint(selected);
  root.append(svg, readout);
}
