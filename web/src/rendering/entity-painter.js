export function drawEntity(view, e, p, z, fixed) {
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
    return;
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
  if (p.labels && (z > 0.16 || major)) {
    const label =
      (rally ? "★ " : "") +
      (e.allianceTag ? "[" + e.allianceTag + "] " : "") +
      e.name;
    const font = major && z < 0.16 ? 11 : Math.max(9, Math.min(12, 12 * z));
    c.font = `500 ${font}px "DM Sans", sans-serif`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    const text = label.length > 32 ? label.slice(0, 31) + "…" : label;
    const tw = c.measureText(text).width;
    const ly = center.y + 24 * spriteZoom;
    c.fillStyle = "#132218dd";
    c.fillRect(center.x - tw / 2 - 7, ly - 8, tw + 14, 17);
    c.fillStyle = rally ? "#f1d28b" : "#e9f0db";
    c.fillText(text, center.x, ly + 0.5);
    if ("level" in e) {
      c.font = `600 ${Math.max(8, 10 * z)}px "DM Sans", sans-serif`;
      c.fillStyle = "#efe3b5";
      c.strokeStyle = "#18251d";
      c.lineWidth = 3;
      c.strokeText("K" + e.level, center.x, top + 7);
      c.fillText("K" + e.level, center.x, top + 7);
    }
  }
}
