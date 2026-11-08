#!/usr/bin/env node
/*
 * Emulates GitHub Pages for the static bundle: serves docs/ under a
 * "/<repo>/" path prefix and nothing else. There is deliberately no /api
 * support, so a passing test proves pages-shim.js answers every request.
 *   node _dev/serve-pages.js [port]
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PREFIX = process.env.PAGES_PREFIX || "/pointercrate-june-12-2024/";
const ROOT = path.join(__dirname, "..", "docs");
const PORT = Number(process.argv[2] || 8799);

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject", ".ico": "image/x-icon",
};

http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (!url.startsWith(PREFIX)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("404: outside the Pages prefix");
  }
  let rel = url.slice(PREFIX.length);
  if (rel === "" || rel.endsWith("/")) rel += "index.html";
  let file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end("forbidden"); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("404: " + rel);
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Pages emulator -> http://localhost:${PORT}${PREFIX}`));
