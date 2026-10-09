export function assetFile(name) {
  return `${process.env.SERVE_DIR || "web"}/assets/${name}`;
}
