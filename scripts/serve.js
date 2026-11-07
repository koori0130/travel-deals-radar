// Minimal static server for local preview. Serves web/ and maps /data/ to the repo's data/ folder.
// Usage: node scripts/serve.js [port]

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };
const port = Number(process.argv[2] ?? 5173);

function resolvePath(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, "");
  const base = clean.startsWith("data") ? ROOT : join(ROOT, "web");
  const full = join(base, clean === "" ? "index.html" : clean);
  return full.startsWith(base) ? full : null;
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const file = resolvePath(url.pathname);
  if (!file) { res.writeHead(403).end("forbidden"); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`http://localhost:${port}/`));
