import { view } from "./dom.js";
import { renderPlayerPortrait } from "./portrait.js";
import { icon } from "./icons.js";
import { project } from "../domain/geometry.js";
import { MAP_ICONS } from "../domain/maps.js";

export function createTeamDashboard({
  root,
  getPlan,
  getAvatars,
  assets,
  navigate,
  openMap,
  openPlayer,
}) {
  const $ = view(root);
  let signature;
  for (const screen of ["players", "alts", "subcities", "maps"])
    $("team-" + screen).onclick = () => navigate(screen);
  $("team-map-browse").onclick = () => navigate("maps");
  $("team-roster-browse").onclick = () => navigate("players");
  function render() {
    const plan = getPlan();
    for (const [screen, value] of [
      ["player", plan.keeps.filter((player) => player.ownerId == null).length],
      ["alt", plan.keeps.filter((player) => player.ownerId != null).length],
      ["subcity", plan.subcities?.length || 0],
      ["map", plan.maps?.length || 0],
    ])
      $("team-" + screen + "-count").textContent = value;
    const next = JSON.stringify([plan.keeps, plan.maps, plan.activeMapId]);
    if (signature === next) return;
    signature = next;
    const map =
      plan.maps?.find((map) => map.id === plan.activeMapId) || plan.maps?.[0];
    const preview = $("team-map-preview");
    preview.replaceChildren();
    if (map) {
      const button = document.createElement("button");
      button.className = "formation-preview";
      button.type = "button";
      button.onclick = () => openMap(map.id);
      button.setAttribute("aria-label", `Open ${map.name} formation`);
      const positions =
        map.id === plan.activeMapId
          ? plan.keeps
          : (map.layout?.positions || []).map((position) => ({
              ...plan.keeps.find((keep) => keep.id === position.id),
              ...position,
            }));
      const placed = positions.filter(
        (keep) => keep.x != null && keep.y != null,
      );
      if (placed.length) {
        const ns = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(ns, "svg");
        svg.setAttribute("viewBox", "0 0 600 250");
        svg.setAttribute("aria-hidden", "true");
        const points = placed.map((keep) =>
          project(keep.x, keep.y, map.layout?.grid || plan.grid),
        );
        const xs = points.map((point) => point.x),
          ys = points.map((point) => point.y);
        const minX = Math.min(...xs),
          minY = Math.min(...ys);
        const spreadX = Math.max(...xs) - minX,
          spreadY = Math.max(...ys) - minY;
        const scale = Math.min(
          420 / Math.max(spreadX, 1),
          150 / Math.max(spreadY, 1),
          1,
        );
        const ordered = placed
          .map((keep, index) => ({ keep, point: points[index] }))
          .sort((a, b) => a.point.y - b.point.y);
        for (const { keep, point } of ordered.slice(0, 80)) {
          const x = 300 + (point.x - minX - spreadX / 2) * scale;
          const y = 145 + (point.y - minY - spreadY / 2) * scale;
          const asset = assets.get(keep.skin);
          const marker = document.createElementNS(
            ns,
            asset ? "image" : "circle",
          );
          if (asset) {
            marker.setAttribute("href", asset.previewSrc || asset.src);
            marker.setAttribute("x", String(x - 34));
            marker.setAttribute("y", String(y - 56));
            marker.setAttribute("width", "68");
            marker.setAttribute("height", "68");
          } else {
            marker.setAttribute("cx", String(x));
            marker.setAttribute("cy", String(y));
            marker.setAttribute("r", "6");
            marker.setAttribute("fill", "#cfb57a");
          }
          svg.append(marker);
        }
        button.append(svg);
      } else {
        const emblem = document.createElement("span");
        emblem.className = "formation-preview-emblem";
        if (MAP_ICONS[map.type]) {
          const image = document.createElement("img");
          image.src = MAP_ICONS[map.type];
          image.alt = "";
          emblem.append(image);
        } else emblem.append(icon("map"));
        button.append(emblem);
      }
      const caption = document.createElement("span");
      caption.className = "formation-preview-caption";
      const name = document.createElement("strong");
      name.textContent = map.name;
      const detail = document.createElement("span");
      detail.textContent = `${placed.length} placed · Open formation`;
      caption.append(name, detail, icon("back"));
      button.append(caption);
      preview.append(button);
    } else {
      const empty = document.createElement("div");
      empty.className = "dashboard-empty";
      empty.append(icon("map"));
      const text = document.createElement("p");
      text.textContent = "Your next plan starts here.";
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Explore maps";
      button.onclick = () => navigate("maps");
      empty.append(text, button);
      preview.append(empty);
    }
    const roster = $("team-roster-preview");
    const players = plan.keeps
      .filter((player) => player.ownerId == null)
      .slice()
      .sort((a, b) => b.level - a.level)
      .slice(0, 4);
    roster.replaceChildren(
      ...players.map((player) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "roster-preview-row";
        const portrait = document.createElement("span");
        portrait.className = "roster-preview-portrait";
        renderPlayerPortrait(portrait, getAvatars(), player);
        const name = document.createElement("strong");
        name.textContent = player.name;
        name.title = player.name;
        const level = document.createElement("span");
        level.className = "roster-preview-level";
        level.textContent = `K${player.level}`;
        button.append(portrait, name, level);
        button.onclick = () => openPlayer(player.id);
        return button;
      }),
    );
    if (!players.length) {
      const empty = document.createElement("div");
      empty.className = "dashboard-empty";
      const text = document.createElement("p");
      text.textContent =
        "Add player profiles to plan tactics and track growth.";
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Explore players";
      button.onclick = () => navigate("players");
      empty.append(icon("people"), text, button);
      roster.append(empty);
    }
  }
  return { render };
}
