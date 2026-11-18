// Vercel function: same-origin proxy to a client's KEBS workspace API.
// /kx/<workspace>.kebs.app/<path>  →  https://<workspace>.kebs.app/api/<path>   (rewrite in vercel.json)
// Only *.kebs.app hosts are allowed. Nothing is stored or logged; headers are passed through allow-listed.
const HOST_OK = /^[a-z0-9-]{1,63}\.kebs\.app$/;
const PASS = ["content-type", "authorization", "accept", "context-id", "routing-key", "bucket-name", "document-type"];

module.exports = async (req, res) => {
  const host = String(req.query.host || "").toLowerCase();
  const path = [].concat(req.query.path || []).join("/");
  if (!HOST_OK.test(host) || !path || path.includes("..")) { res.statusCode = 400; res.setHeader("Content-Type", "application/json"); return res.end('{"err":true,"msg":"Unknown KEBS workspace"}'); }
  const qs = Object.entries(req.query).filter(([k]) => k !== "host" && k !== "path").map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const headers = {}; for (const k of PASS) if (req.headers[k]) headers[k] = req.headers[k];
  const fwd = req.headers["x-forwarded-for"]; if (fwd) headers["x-forwarded-for"] = fwd;
  const chunks = []; for await (const c of req) chunks.push(c);
  try {
    const r = await fetch(`https://${host}/api/${path}${qs ? `?${qs}` : ""}`, { method: req.method, headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks), redirect: "manual" });
    res.statusCode = r.status;
    res.setHeader("Content-Type", r.headers.get("content-type") || "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch { res.statusCode = 502; res.setHeader("Content-Type", "application/json"); res.end('{"err":true,"msg":"KEBS unreachable"}'); }
};
