import { readFile } from "node:fs/promises";
const escape = (text) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const format = (text) =>
  escape(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/https:\/\/[^\s<]+/g, (url) => {
      const clean = url.replace(/\.$/, "");
      return `<a href="${clean}">${clean}</a>` + (url.endsWith(".") ? "." : "");
    });
export async function policyPage(filename) {
  const source = await readFile(
    new URL("../" + filename, import.meta.url),
    "utf8",
  );
  const blocks = source
    .trim()
    .split(/\n\s*\n/)
    .map((block) => {
      const heading = block.match(/^(#{1,2}) (.*)$/);
      return heading
        ? `<h${heading[1].length}>${format(heading[2])}</h${heading[1].length}>`
        : `<p>${format(block.replaceAll("\n", " "))}</p>`;
    })
    .join("\n");
  const title = source.split("\n")[0].replace(/^# /, "");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>body{font:16px/1.65 system-ui,sans-serif;color:#24372d;background:#f7f8f4;margin:0;padding:28px}main{max-width:800px;margin:auto}h1{line-height:1.2}h2{margin-top:2em}a{color:#315a43;overflow-wrap:anywhere}code{overflow-wrap:anywhere}nav{display:flex;gap:20px;flex-wrap:wrap}</style></head><body><main><nav><a href="./">Evony Consilium</a><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a></nav>${blocks}</main></body></html>`;
}
