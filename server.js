/* Local prototype server (npm start).
 *
 *  1. Serves the static prototype at http://localhost:8777
 *  2. Exposes POST /api/match and POST /api/phrases, backed by lib/gemini.js —
 *     the ONLY place the Gemini key is used.
 *
 * Why a server at all: an API key cannot live in client-side code. Anyone who
 * opens the page can read it and spend your quota. The browser calls this
 * server; this server holds the key and calls Google.
 *
 * On Vercel the same lib/gemini.js handlers run as functions in api/, and
 * Vercel serves the static files itself (see vercel.json).
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { hasKey, handleMatch, handlePhrases } from "./lib/gemini.js";

const ROOT = process.cwd();
const DEFAULT = "app.html";
const PORT = 8777;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
                ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
                ".md": "text/plain; charset=utf-8" };

const readBody = req => new Promise((res, rej) => {
  let d = ""; req.on("data", c => { d += c; if (d.length > 1e5) req.destroy(); });
  req.on("end", () => { try { res(JSON.parse(d || "{}")); } catch (e) { rej(e); } });
});

const ROUTES = { "/api/match": handleMatch, "/api/phrases": handlePhrases };

http.createServer(async (req, res) => {
  const json = (code, obj) => {
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(obj));
  };

  const route = req.method === "POST" && ROUTES[req.url];
  if (route) {
    let body;
    try { body = await readBody(req); } catch { return json(400, { error: "bad_request" }); }
    const { status, body: out } = await route(body);
    return json(status, out);
  }

  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/" || p === "") p = "/" + DEFAULT;
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end("no"); }
  fs.readFile(file, (e, data) => {
    if (e) { res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
             return res.end('<h1>404</h1><p><a href="/">Open the prototype</a></p>'); }
    // no-cache: the browser always re-checks, so edits show up on a normal refresh.
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream",
                         "Cache-Control": "no-cache" });
    res.end(data);
  });
}).listen(PORT, "0.0.0.0", () => {
  console.log(`\n  http://localhost:${PORT}`);
  console.log(`  Gemini matcher: ${hasKey ? "ready at POST /api/match" : "OFF (GEMINI_API_KEY is empty in .env.local)"}\n`);
});
