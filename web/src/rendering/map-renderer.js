import { project, unproject } from "../domain/geometry.js";

export class MapRenderer {
  constructor(canvas, getPlan, { onDraw = () => {} } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.getPlan = getPlan;
    this.onDraw = onDraw;
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
  fit() {
    const p = this.getPlan();
    const extent = p.extent;
    const points = [[0, 0], [extent, 0], [0, extent], [extent, extent]]
      .map(([x, y]) => project(x, y, p.grid));
    const xs = points.map(({ x }) => x), ys = points.map(({ y }) => y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    this.camera = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      zoom: Math.max(0.002, Math.min(1.1,
        (this.width - 80) / (maxX - minX + 80),
        (this.height - 80) / (maxY - minY + 80))),
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
    this.onDraw({ zoom: this.camera.zoom });
  }
}
