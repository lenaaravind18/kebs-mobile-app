// Tiny static server: node server.mjs [port]
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.argv[2]) || Number(process.env.PORT) || 5270;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".mp4": "video/mp4" };

// same proxy as vercel.json: /kebs-api/* → the KEBS API (keeps calls same-origin, so no CORS)
const KEBS_API = "https://primadevprd.kebs.app/api/";
async function proxy(req, res) {
  const chunks = []; for await (const c of req) chunks.push(c);
  const headers = {}; for (const k of ["content-type", "authorization", "accept"]) if (req.headers[k]) headers[k] = req.headers[k];
  try {
    const r = await fetch(KEBS_API + req.url.slice("/kebs-api/".length), { method: req.method, headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) });
    res.writeHead(r.status, { "Content-Type": r.headers.get("content-type") || "application/json", "Cache-Control": "no-store" });
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) { res.writeHead(502, { "Content-Type": "application/json" }).end(JSON.stringify({ err: true, msg: "KEBS unreachable" })); }
}

http.createServer(async (req, res) => {
  if (req.url.startsWith("/kebs-api/")) return proxy(req, res);
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/") p = "/index.html";
  const file = normalize(join(root, p));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    // byte ranges, so video can seek
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
    if (m) {
      const start = m[1] ? +m[1] : body.length - +m[2], end = m[1] && m[2] ? Math.min(+m[2], body.length - 1) : body.length - 1;
      res.writeHead(206, { "Content-Type": types[extname(file)] || "application/octet-stream", "Content-Range": `bytes ${start}-${end}/${body.length}`, "Accept-Ranges": "bytes", "Content-Length": end - start + 1 });
      res.end(body.subarray(start, end + 1));
      return;
    }
    res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(port, () => console.log(`KEBS running on http://localhost:${port}`));
