import { policyPage } from "./policy-pages.js";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
const root = resolve(process.env.SERVE_DIR || "web");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};
http
  .createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (pathname === "/privacy.html" || pathname === "/terms.html") {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(
          await policyPage(
            pathname === "/privacy.html" ? "PRIVACY.md" : "TERMS.md",
          ),
        );
        return;
      }
      const file = resolve(
        root,
        "." + (pathname.endsWith("/") ? pathname + "index.html" : pathname),
      );
      if (!file.startsWith(root + sep)) throw new Error("Invalid path");
      res.setHeader(
        "Content-Type",
        types[extname(file)] || "application/octet-stream",
      );
      res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(Number(process.env.PORT || 4173), "127.0.0.1", () =>
    console.log("Planner: http://127.0.0.1:" + (process.env.PORT || 4173)),
  );
