#!/usr/bin/env node
/*
 * Local mirror server for the June 12, 2024 Wayback snapshot of
 * pointercrate.com/demonlist/statsviewer/ and /demonlist/.
 *
 * Serves the archived static assets plus a small API shim backed by the
 * *actual* archived ranking JSON (captured 2024-06-12 17:33:13 UTC).
 * Zero dependencies. Run:  node server.js   ->   http://localhost:8642/
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const SITE = path.join(__dirname, "site");
const PORT = Number(process.env.PORT || 8642);

const ranking = JSON.parse(fs.readFileSync(path.join(SITE, "api/ranking-20240612.json"), "utf8"));
const listInfo = JSON.parse(fs.readFileSync(path.join(SITE, "api/list_information.json"), "utf8"));
const mapMeta = JSON.parse(fs.readFileSync(path.join(SITE, "api/map-meta.json"), "utf8"));
// First page of /api/v1/players/ as archived 2024-05-29 (50 real players, ids 1-64).
// Only these exact fields were captured; no record data is invented.
const archivedPlayers = JSON.parse(fs.readFileSync(path.join(SITE, "api/players-20240529.json"), "utf8"));

// Ranks 51-53: a joke list the user asked to be able to page into. These are NOT
// archived data and are flagged with joke:true; the client labels them as a joke.
// Shared with the static GitHub Pages build (build-pages.py) via this JSON file.
const jokePlayers = JSON.parse(fs.readFileSync(path.join(SITE, "api/joke-players.json"), "utf8"));
const fullRanking = ranking.concat(jokePlayers);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
};

function sendJson(res, code, obj, extraHeaders = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body),
    ...extraHeaders,
  });
  res.end(body);
}

const continentOf = (cc) => (mapMeta.countries[cc.toLowerCase()] || {}).continent || null;
const normContinent = (s) => s.toLowerCase().replace(/\s+/g, "-");

// ------------------------------------------------------------- ranking API
function handleRanking(res, q) {
  let rows = fullRanking.slice();

  const name = (q.get("name_contains") || "").toLowerCase();
  if (name) rows = rows.filter((p) => p.name.toLowerCase().includes(name));

  const nation = q.get("nation");
  if (nation) rows = rows.filter((p) => p.nationality && p.nationality.country_code === nation.toUpperCase());

  const continent = q.get("continent");
  if (continent) rows = rows.filter((p) => p.nationality && continentOf(p.nationality.country_code) === normContinent(continent));

  const subdivision = q.get("subdivision");
  if (subdivision) rows = rows.filter((p) => p.nationality && p.nationality.subdivision &&
    p.nationality.subdivision.iso_code === subdivision.toUpperCase());

  const limit = Math.max(1, Math.min(parseInt(q.get("limit") || "50", 10) || 50, 50));
  const after = parseInt(q.get("after") || "0", 10) || 0;
  const before = parseInt(q.get("before") || "0", 10) || 0;

  let start = 0;
  if (after) {
    const i = rows.findIndex((p) => p.rank === after);
    start = i === -1 ? rows.length : i + 1;
  }

  let page;
  if (before) {
    const i = rows.findIndex((p) => p.rank === before);
    const end = i === -1 ? rows.length : i;
    start = Math.max(0, end - limit);
    page = rows.slice(start, end);
  } else {
    page = rows.slice(start, start + limit);
  }

  const params = new URLSearchParams();
  for (const k of ["name_contains", "nation", "continent", "subdivision"]) {
    const v = q.get(k);
    if (v) params.set(k, v);
  }
  params.set("limit", String(limit));

  const links = [];
  if (start + limit < rows.length && page.length) {
    const n = new URLSearchParams(params);
    n.set("after", String(page[page.length - 1].rank));
    links.push(`</api/v1/players/ranking/?${n}>; rel=next`);
  }
  if (start > 0 && page.length) {
    const p = new URLSearchParams(params);
    p.set("before", String(page[0].rank));
    links.push(`</api/v1/players/ranking/?${p}>; rel=prev`);
  }

  sendJson(res, 200, page, links.length ? { Links: links.join(", ") } : {});
}

// ------------------------------------------------------------- request router
const server = http.createServer((req, res) => {
  const u = new URL(req.url, "http://localhost");
  const pathname = decodeURIComponent(u.pathname);

  if (req.method !== "GET" && req.method !== "HEAD") {
    return sendJson(res, 405, { code: 40500, message: "This mirror is read-only." });
  }

  // --- API shim (archived data) ---
  if (pathname === "/api/v1/players/ranking/" || pathname === "/api/v1/players/ranking") {
    return handleRanking(res, u.searchParams);
  }
  if (pathname === "/api/v1/list_information/" || pathname === "/api/v1/list_information") {
    return sendJson(res, 200, listInfo);
  }
  let m = pathname.match(/^\/api\/v1\/nationalities\/([A-Za-z]+)\/subdivisions\/?$/);
  if (m) {
    const f = path.join(SITE, "api/subdivisions", m[1].toUpperCase() + ".json");
    if (/^[A-Z]{2}$/.test(m[1].toUpperCase()) && fs.existsSync(f)) {
      return sendJson(res, 200, JSON.parse(fs.readFileSync(f, "utf8")));
    }
    return sendJson(res, 200, []);
  }
  if (pathname === "/api/v1/players/" || pathname === "/api/v1/players") {
    // Archived first page only; name_contains filters the real captured rows.
    const name = (u.searchParams.get("name_contains") || "").toLowerCase();
    const rows = name ? archivedPlayers.filter((p) => p.name.toLowerCase().includes(name)) : archivedPlayers;
    return sendJson(res, 200, rows.slice(0, 50));
  }
  m = pathname.match(/^\/api\/v1\/players\/(\d+)\/?$/);
  if (m) {
    const archived = archivedPlayers.find((p) => p.id === Number(m[1]));
    if (archived) return sendJson(res, 200, { data: archived });
    const joke = jokePlayers.find((p) => p.id === Number(m[1]));
    if (joke) return sendJson(res, 200, { data: joke });
    const player = ranking.find((p) => p.id === Number(m[1]));
    return sendJson(res, 404, {
      code: 40400,
      message: player
        ? `Record details for ${player.name} were not preserved by the Wayback Machine — only the archived top-50 ranking (rank, score, nationality) is available in this mirror.`
        : "This player is not inside the archived top 50.",
      data: null,
    });
  }
  if (pathname.startsWith("/api/")) {
    return sendJson(res, 404, { code: 40400, message: "Endpoint not preserved in this snapshot.", data: null });
  }

  // --- local demon detail pages: /demonlist/permalink/{id}/ and position links
  // (/demonlist/1/, /demonlist/76/, /demonlist/151/ from the footer) ---
  m = pathname.match(/^\/demonlist\/(?:permalink\/)?(\d+)\/?$/);
  if (m) {
    const file = path.join(SITE, "demonlist/demon.html");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
    return;
  }

  // --- static files ---
  let rel = pathname === "/" || pathname === "/demonlist/statsviewer/" || pathname === "/demonlist/statsviewer/index.html"
    ? "index.html"
    : pathname.replace(/^\/+/, "");
  let file = path.normalize(path.join(SITE, rel));
  if (!file.startsWith(SITE)) {
    res.writeHead(403); return res.end("Forbidden");
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");

  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": /\.(png|svg|woff2?|ttf|ico)$/.test(file) ? "public, max-age=3600" : "no-store",
    });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
    return;
  }

  // page-like routes that weren't mirrored -> live site; missing assets -> 404
  if (!path.extname(pathname)) {
    res.writeHead(302, { Location: "https://pointercrate.com" + req.url });
    return res.end();
  }
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found in mirror: " + pathname);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`Mirror is already running -> http://localhost:${PORT}/  (this window can be closed)`);
    process.exit(0);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`Pointercrate mirror (2024-06-12 snapshot) -> http://localhost:${PORT}/  |  demonlist: /demonlist/`);
});