import { project, unproject } from "../domain/geometry.js";
import { ImageCache } from "./image-cache.js";
import { drawSubcities } from "./subcity-painter.js";
import { drawTerrain, drawMoatOverlay } from "./terrain-painter.js";
import { drawEntity } from "./entity-painter.js";

export class MapRenderer {
  constructor(canvas, getPlan, { onDraw = () => {}, subcityTypes = [], terrainFor = () => undefined, assets = new Map() } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.getPlan = getPlan;
    this.onDraw = onDraw;
    this.subcityTypes = subcityTypes;
    this.terrainFor = terrainFor;
    this.assets = assets;
    this.hits = [];
    this.selected = null;
    this.selectedIds = new Set();
    this.preview = null;
    this.previews = null;
    this.selectionBox = null;
    this.subcityHits = [];
    this.images = new ImageCache(() => this.draw());
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.width = 0;
    this.height = 0;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas.parentElement);
  }
  resize() {
    const box = this.canvas.getBoundingClientRect();
    this.width = box.width;
    this.height = box.height;
    const dpr = devicePixelRatio || 1;
    this.canvas.width = Math.round(box.width * dpr);
    this.canvas.height = Math.round(box.height * dpr);
    this.draw();
  }
  image(src) { return this.images.get(src); }
  hit(x, y) {
    return [...this.hits].reverse().find((region) =>
      x >= region.left && x <= region.right && y >= region.top && y <= region.bottom)?.id || null;
  }
  path(entity) {
    const points = [
      [entity.x, entity.y],
      [entity.x + entity.w, entity.y],
      [entity.x + entity.w, entity.y + entity.h],
      [entity.x, entity.y + entity.h],
    ].map(([x, y]) => this.screen(x, y));
    this.ctx.beginPath();
    points.forEach((point, index) => index
      ? this.ctx.lineTo(point.x, point.y)
      : this.ctx.moveTo(point.x, point.y));
    this.ctx.closePath();
  }
  drawMoatOverlay(...args) {
    drawMoatOverlay(this, ...args);
  }
  hitSubcity(x, y) {
    return [...this.subcityHits].reverse().find((hit) =>
      x >= hit.left && x <= hit.right && y >= hit.top && y <= hit.bottom)?.id || null;
  }
  screen(x, y) {
    const p = project(x, y, this.getPlan().grid);
    return {
      x: (p.x - this.camera.x) * this.camera.zoom + this.width / 2,
      y: (p.y - this.camera.y) * this.camera.zoom + this.height / 2,
    };
  }
  world(x, y) {
    return unproject(
      (x - this.width / 2) / this.camera.zoom + this.camera.x,
      (y - this.height / 2) / this.camera.zoom + this.camera.y,
      this.getPlan().grid,
    );
  }
  center(x, y) {
    const p = project(x, y, this.getPlan().grid);
    this.camera.x = p.x;
    this.camera.y = p.y;
    this.draw();
  }
  zoom(factor, sx = this.width / 2, sy = this.height / 2) {
    const before = this.world(sx, sy);
    this.camera.zoom = Math.max(0.002, Math.min(3, this.camera.zoom * factor));
    const after = this.world(sx, sy);
    const delta = project(after.x - before.x, after.y - before.y, this.getPlan().grid);
    this.camera.x -= delta.x;
    this.camera.y -= delta.y;
    this.draw();
  }
  fit(whole = false) {
    const p = this.getPlan();
    const extent = this.terrainFor(p.map)?.extent ?? p.extent;
    const placed = [...p.keeps, ...p.structures, ...p.obstacles]
      .filter((entity) => entity.x !== null);
    let points;
    if (whole) points = [[0, 0], [extent, 0], [0, extent], [extent, extent]]
      .map(([x, y]) => project(x, y, p.grid));
    else if (placed.length) points = placed.flatMap((entity) => [
      [entity.x, entity.y], [entity.x + entity.w, entity.y],
      [entity.x, entity.y + entity.h], [entity.x + entity.w, entity.y + entity.h],
    ].map(([x, y]) => project(x, y, p.grid)));
    else {
      this.camera.zoom = 1;
      this.center(p.center.x, p.center.y);
      return;
    }
    const xs = points.map(({ x }) => x), ys = points.map(({ y }) => y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    this.camera = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2 - 30,
      zoom: Math.max(0.002, Math.min(1.1,
        (this.width - 130) / (maxX - minX + 180),
        (this.height - 220) / (maxY - minY + 180))),
    };
    this.draw();
  }
  draw() {
    if (!this.width || !this.height) return;
    const c = this.ctx, p = this.getPlan(), dpr = devicePixelRatio || 1;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const map = p.mapPresets.find(({ id }) => id === p.map);
    c.fillStyle = map?.color || "#647947";
    c.fillRect(0, 0, this.width, this.height);
    const terrain = this.terrainFor(p.map);
    if (terrain) {
      const corners = [[0, 0], [this.width, 0], [0, this.height], [this.width, this.height]]
        .map(([x, y]) => this.world(x, y));
      const minX = Math.max(0, Math.floor(Math.min(...corners.map(({ x }) => x))));
      const maxX = Math.min(terrain.extent, Math.ceil(Math.max(...corners.map(({ x }) => x))));
      const minY = Math.max(0, Math.floor(Math.min(...corners.map(({ y }) => y))));
      const maxY = Math.min(terrain.extent, Math.ceil(Math.max(...corners.map(({ y }) => y))));
      c.save();
      c.translate(this.width / 2 - this.camera.x * this.camera.zoom,
        this.height / 2 - this.camera.y * this.camera.zoom);
      c.scale(this.camera.zoom, this.camera.zoom);
      drawTerrain(this, terrain, minX, minY, maxX, maxY, p.grid);
      c.restore();
    }
    const background = p.backgrounds[p.map];
    if (background) {
      const image = this.image(background.src);
      if (image) {
        const anchor = project(background.x, background.y, p.grid);
        c.save();
        c.translate(this.width / 2 - this.camera.x * this.camera.zoom,
          this.height / 2 - this.camera.y * this.camera.zoom);
        c.scale(this.camera.zoom, this.camera.zoom);
        c.globalAlpha = background.opacity;
        c.drawImage(image, anchor.x, anchor.y, background.width, background.height);
        c.restore();
      }
    }
    if (p.showGrid) {
      const corners = [[0, 0], [this.width, 0], [0, this.height], [this.width, this.height]]
        .map(([x, y]) => this.world(x, y));
      const minX = Math.max(0, Math.floor(Math.min(...corners.map(({ x }) => x))));
      const maxX = Math.min(p.extent, Math.ceil(Math.max(...corners.map(({ x }) => x))));
      const minY = Math.max(0, Math.floor(Math.min(...corners.map(({ y }) => y))));
      const maxY = Math.min(p.extent, Math.ceil(Math.max(...corners.map(({ y }) => y))));
      const stride = this.camera.zoom < 0.25 ? 10 : 1;
      c.strokeStyle = "#17261b35";
      c.lineWidth = 0.6;
      c.beginPath();
      for (let x = minX; x <= maxX; x += stride) {
        const a = this.screen(x, minY), b = this.screen(x, maxY);
        c.moveTo(a.x, a.y); c.lineTo(b.x, b.y);
      }
      for (let y = minY; y <= maxY; y += stride) {
        const a = this.screen(minX, y), b = this.screen(maxX, y);
        c.moveTo(a.x, a.y); c.lineTo(b.x, b.y);
      }
      c.stroke();
    }
    this.hits = [];
    const entities = [...p.obstacles, ...p.structures, ...p.keeps]
      .filter((entity) => entity.x !== null && entity.y !== null)
      .sort((a, b) =>
        project(a.x + a.w, a.y + a.h, p.grid).y -
        project(b.x + b.w, b.y + b.h, p.grid).y);
    for (const entity of entities)
      drawEntity(this, entity, p, this.camera.zoom);
    drawSubcities(this, p, this.subcityTypes);
    for (const preview of this.previews || (this.preview ? [this.preview] : [])) {
      this.path(preview);
      c.fillStyle = preview.valid ? "#cfe3a944" : "#e85e4a66";
      c.fill();
      c.strokeStyle = preview.valid ? "#e4f7b4" : "#ffad98";
      c.lineWidth = 2;
      c.stroke();
    }
    if (this.selectionBox) {
      const box = this.selectionBox;
      c.fillStyle = "#cfe3a922";
      c.fillRect(box.x, box.y, box.w, box.h);
      c.strokeStyle = "#e4f7b4";
      c.strokeRect(box.x, box.y, box.w, box.h);
    }
    this.onDraw({ zoom: this.camera.zoom });
  }
}
