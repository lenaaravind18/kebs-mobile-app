// Tiny static server: node server.mjs [port]
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.argv[2]) || Number(process.env.PORT) || 5270;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".mp4": "video/mp4" };

// Dev-only read proxy to KEBS, so the browser preview can reach it (browsers block cross-site calls).
// Reads + login only; write endpoints are refused. The app sends /kebs/<env>/<api path>.
const KEBS_HOSTS = { zifo: "primadevprd.kebs.app", maveric: "vertex-maveric-devprd.kebs.app" };
const KEBS_BLOCK = /saveAssocTSData|submitAssocTSData|\/(save|submit|delete|update|insert|remove)/i;

http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);

  if (p.startsWith("/kebs/")) {
    const parts = p.split("/").filter(Boolean); // ["kebs", env, ...apiPath]
    const env = parts[1], apiPath = parts.slice(2).join("/");
    const host = KEBS_HOSTS[env];
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "POST, GET, OPTIONS" };
    if (req.method === "OPTIONS") { res.writeHead(204, cors).end(); return; }
    if (!host) { res.writeHead(404, cors).end('{"err":true,"msg":"unknown environment"}'); return; }
    if (KEBS_BLOCK.test(apiPath)) { res.writeHead(403, cors).end('{"err":true,"msg":"read-only proxy: write endpoints are blocked"}'); return; }
    const chunks = []; for await (const c of req) chunks.push(c);
    try {
      const r = await fetch(`https://${host}/api/${apiPath}`, {
        method: req.method,
        headers: { "Content-Type": "application/json", ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}) },
        body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks),
      });
      const text = await r.text();
      res.writeHead(r.status, { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors });
      res.end(text);
    } catch (e) { res.writeHead(502, { "Content-Type": "application/json", ...cors }).end(JSON.stringify({ err: true, msg: String(e) })); }
    return;
  }

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
