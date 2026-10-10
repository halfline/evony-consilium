export function drawEntity(view, e, p, z, fixed, { deferLabel = false } = {}) {
  const c = view.ctx;
  const center = view.screen(e.x + e.w / 2, e.y + e.h / 2);
  const asset = view.assets.get(e.skin);
  const major = fixed && (e.skin === "map-kingdom" || e.skin.endsWith("shrin"));
  const spriteZoom = major ? Math.max(z, 0.18) : z;
  const selected = e.id === view.selected || view.selectedIds?.has(e.id);
  const rally = e.id === p.rallyId;
  const obstacle = p.obstacles.some((o) => o.id === e.id);
  if (
    center.x < -250 * spriteZoom ||
    center.y < -300 * spriteZoom ||
    center.x > view.width + 250 * spriteZoom ||
    center.y > view.height + 300 * spriteZoom
  )
    return;
  if (z < 0.16 && !major) {
    if (fixed) return;
    c.beginPath();
    c.arc(center.x, center.y, selected ? 6 : rally ? 5 : 3, 0, Math.PI * 2);
    c.fillStyle = obstacle ? "#e5a887" : rally ? "#f4d386" : "#e0e9ce";
    c.fill();
    c.strokeStyle = "#233529";
    c.lineWidth = 1;
    c.stroke();
    if (!fixed)
      view.hits.push({
        id: e.id,
        left: center.x - 7,
        right: center.x + 7,
        top: center.y - 7,
        bottom: center.y + 7,
      });
    return {
      e,
      p,
      z,
      major,
      spriteZoom,
      center,
      top: center.y,
      rally,
      selected,
    };
  }
  view.path(e);
  if (obstacle) {
    c.fillStyle = "#513e37aa";
    c.fill();
    c.strokeStyle = "#e6b19788";
    c.lineWidth = 1;
    c.stroke();
  } else if (!fixed && (selected || rally || e.locked)) {
    c.fillStyle = selected ? "#e7d59728" : "#22372620";
    c.fill();
    c.strokeStyle = selected ? "#fff0b4" : rally ? "#e1c678" : "#b1d0ba";
    c.lineWidth = selected ? 2 : 1.2;
    c.stroke();
  }
  let width = 0,
    height = 0,
    top = center.y;
  if (asset) {
    const im = view.image(asset.src);
    width =
      (Math.abs(p.grid.ax) + Math.abs(p.grid.bx)) *
      Math.max(e.w, e.h) *
      0.87 *
      spriteZoom;
    height = (width * asset.height) / asset.width;
    top =
      center.y -
      height +
      Math.abs(p.grid.ay + p.grid.by) * e.h * 0.35 * spriteZoom;
    let left = center.x - width / 2;
    if (asset.mapAnchor) {
      const gridWidth = Math.abs(p.grid.ax) + Math.abs(p.grid.bx);
      const scale = asset.mapAnchor.footprintFill
        ? (gridWidth *
            Math.max(e.w, e.h) *
            asset.mapAnchor.footprintFill *
            spriteZoom) /
          (asset.mapAnchor.footprintWidth || asset.width)
        : ((gridWidth / 256) * spriteZoom) / asset.mapAnchor.pixelScale;
      width = asset.width * scale;
      height = asset.height * scale;
      if (asset.mapAnchor.footprintFill) {
        const front = view.screen(e.x + e.w, e.y + e.h);
        left = front.x - asset.mapAnchor.pivotX * scale;
        top = front.y - (asset.mapAnchor.groundPivotY ?? asset.height) * scale;
      } else {
        left = center.x - asset.mapAnchor.pivotX * scale;
        top = center.y - asset.mapAnchor.pivotY * scale;
      }
    }
    if (im) {
      c.drawImage(im, left, top, width, height);
    } else {
      c.fillStyle = "#d1ba7c";
      c.font = `${Math.max(14, 30 * z)}px serif`;
      c.textAlign = "center";
      c.fillText("♜", center.x, center.y);
    }
  }
  if (rally) {
    c.strokeStyle = "#e6cf86";
    c.lineWidth = 1.3;
    const radius = Math.max(5, 18 * z);
    c.beginPath();
    c.ellipse(
      center.x,
      center.y + 7 * z,
      Math.max(10, 75 * z),
      radius,
      0,
      0,
      Math.PI * 2,
    );
    c.stroke();
  }
  if (!fixed)
    view.hits.push({
      id: e.id,
      left: center.x - Math.max(width / 2, 10),
      right: center.x + Math.max(width / 2, 10),
      top: top - 10,
      bottom: center.y + Math.max(25, 35 * z),
    });
  const labelData = {
    e,
    p,
    z,
    major,
    spriteZoom,
    center,
    top,
    rally,
    selected,
  };
  if (!deferLabel) drawEntityLabel(view, labelData);
  return labelData;
}

export function drawEntityLabel(
  view,
  { e, p, z, major, spriteZoom, center, top, rally, selected },
  occupied = null,
) {
  const c = view.ctx;
  if (p.labels && (z > 0.45 || major || selected || rally)) {
    const label =
      (rally ? "★ " : "") +
      (e.allianceTag ? "[" + e.allianceTag + "] " : "") +
      e.name;
    const font = selected || rally ? 13 : 11;
    c.font = `500 ${font}px "DM Sans", sans-serif`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    const limit = selected || rally ? 40 : 26;
    const text = label.length > limit ? label.slice(0, limit - 1) + "…" : label;
    const tw = c.measureText(text).width;
    const ly = center.y + Math.max(14, 24 * spriteZoom);
    const bounds = {
      left: center.x - tw / 2 - 7,
      right: center.x + tw / 2 + 7,
      top: ly - 11,
      bottom: ly + 11,
    };
    if (
      occupied?.some(
        (rect) =>
          bounds.left < rect.right &&
          bounds.right > rect.left &&
          bounds.top < rect.bottom &&
          bounds.bottom > rect.top,
      )
    )
      return;
    occupied?.push(bounds);
    c.fillStyle = selected || rally ? "#e2c68e" : "#101e17ee";
    c.fillRect(bounds.left, bounds.top, tw + 14, 22);
    c.fillStyle = selected || rally ? "#14251b" : "#f0eee2";
    c.fillText(text, center.x, ly + 0.5);
    if ("level" in e && z >= 0.16) {
      c.font = `600 ${Math.max(8, 10 * z)}px "DM Sans", sans-serif`;
      c.fillStyle = "#efe3b5";
      c.strokeStyle = "#18251d";
      c.lineWidth = 3;
      c.strokeText("K" + e.level, center.x, top + 7);
      c.fillText("K" + e.level, center.x, top + 7);
    }
  }
}

export function paintEntityLabels(view, labels) {
  const priority = (label) =>
    label.selected ? 0 : label.rally ? 1 : label.major ? 2 : 3;
  const occupied = [];
  for (const label of [...labels].sort(
    (a, b) => priority(a) - priority(b) || b.center.y - a.center.y,
  ))
    drawEntityLabel(view, label, occupied);
}
