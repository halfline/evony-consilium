import { project } from "../domain/geometry.js";
import { terrainTileAt } from "../domain/terrain.js";

export function drawTerrain(view, terrain, minX, minY, maxX, maxY, grid) {
  const c = view.ctx;
  const overview = view.image(terrain.overview);
  if (overview) {
    c.save();
    c.imageSmoothingEnabled = false;
    c.transform(grid.ax, grid.ay, grid.bx, grid.by, 0, 0);
    c.drawImage(overview, 0, 0, terrain.width, terrain.height);
    c.restore();
  }
  const count = (maxX - minX) * (maxY - minY);
  if (count > 6000) return;
  const width = Math.abs(grid.ax - grid.bx);
  const scale = width / 256;
  for (const layer of terrain.layers) {
    c.save();
    if (layer.name !== "surface") {
      c.beginPath();
      c.rect(-1000000, -1000000, 2000000, 2000000);
      for (const clearing of terrain.landmarks.filter(
        (landmark) => landmark.groundTile,
      )) {
        const points = [
          [clearing.x, clearing.y],
          [clearing.x + clearing.w, clearing.y],
          [clearing.x + clearing.w, clearing.y + clearing.h],
          [clearing.x, clearing.y + clearing.h],
        ].map(([x, y]) => project(x, y, grid));
        points.forEach((point, index) =>
          index ? c.lineTo(point.x, point.y) : c.moveTo(point.x, point.y),
        );
        c.closePath();
      }
      c.clip("evenodd");
    }
    for (
      let y = Math.max(0, minY - 5);
      y < Math.min(terrain.height, maxY + 5);
      y++
    )
      for (
        let x = Math.max(0, minX - 5);
        x < Math.min(terrain.width, maxX + 5);
        x++
      ) {
        const tile = terrain.tiles[terrainTileAt(terrain, layer, x, y)];
        if (!tile || tile.invisible) continue;
        const image = view.image(tile.src);
        if (!image) continue;
        const anchor = project(x + 0.5, y + 0.5, grid);
        const w = tile.width * scale,
          h = tile.height * scale;
        c.drawImage(
          image,
          anchor.x - w / 2,
          anchor.y + (grid.ay + grid.by) / 2 - h,
          w,
          h,
        );
      }
    c.restore();
  }
}

export function drawMoatOverlay(view, e, p, z) {
  const terrain = view.terrainFor(p.map);
  if (
    !terrain?.foregroundRegions?.length ||
    !e.groundTile ||
    !terrain.landmarks.some((landmark) => landmark.id === e.id)
  )
    return;
  const c = view.ctx;
  // Restore the moat over dirt clearings before any building sprites are drawn.
  c.save();
  view.path(e);
  c.clip();
  c.translate(
    view.width / 2 - view.camera.x * z,
    view.height / 2 - view.camera.y * z,
  );
  c.scale(z, z);
  const scale = Math.abs(p.grid.ax - p.grid.bx) / 256;
  for (const region of terrain.foregroundRegions) {
    const cut = region.exclude;
    for (const layer of terrain.layers.filter(
      (layer) => layer.name === "surface",
    ))
      for (let y = region.y; y < region.y + region.h; y++)
        for (let x = region.x; x < region.x + region.w; x++) {
          if (
            cut &&
            x >= cut.x &&
            x < cut.x + cut.w &&
            y >= cut.y &&
            y < cut.y + cut.h
          )
            continue;
          if (x + 1 < e.x || x > e.x + e.w || y + 1 < e.y || y > e.y + e.h)
            continue;
          const tile = terrain.tiles[layer.tiles[y * terrain.width + x]];
          if (!tile || tile.invisible) continue;
          const image = view.image(tile.src);
          if (!image) continue;
          const anchor = project(x + 0.5, y + 0.5, p.grid);
          const w = tile.width * scale,
            h = tile.height * scale;
          c.drawImage(
            image,
            anchor.x - w / 2,
            anchor.y + (p.grid.ay + p.grid.by) / 2 - h,
            w,
            h,
          );
        }
  }
  c.restore();
}
