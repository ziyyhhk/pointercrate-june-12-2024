#!/usr/bin/env python3
"""
Build the fully static GitHub Pages bundle in docs/ from site/.

GitHub Pages only serves files, so the API that server.js provides has to be
answered in the browser instead. This build:

  1. copies site/ -> docs/
  2. inlines the API data as docs/static/pages-data.js and adds a small
     XMLHttpRequest/fetch shim (docs/static/pages-shim.js) that answers every
     /api/v1/... request from that data, including the Links pagination header
  3. makes every URL work under a "<username>.github.io/<repo>/" prefix:
     a build-time <base href> for the app root (see BASE below), root-absolute
     href/src/data/url() values made relative, CSS url() values made
     file-relative, ES module import specifiers made file-relative
  4. points demon pages at demon.html?id=<id> (Pages has no path routing) and
     the un-mirrored Documentation / Guidelines nav items at pointercrate.com
"""
import json
import os
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SITE = ROOT / "site"
DOCS = ROOT / "docs"

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
counts = {}


def bump(key, n=1):
    counts[key] = counts.get(key, 0) + n


# --------------------------------------------------------------- 1. fresh copy
if DOCS.exists():
    shutil.rmtree(DOCS)
shutil.copytree(SITE, DOCS)

# ------------------------------------------------------------- 2. data bundle
ranking = json.loads((SITE / "api/ranking-20240612.json").read_text(encoding="utf-8"))
jokes = json.loads((SITE / "api/joke-players.json").read_text(encoding="utf-8"))
players = json.loads((SITE / "api/players-20240529.json").read_text(encoding="utf-8"))
list_info = json.loads((SITE / "api/list_information.json").read_text(encoding="utf-8"))
map_meta = json.loads((SITE / "api/map-meta.json").read_text(encoding="utf-8"))
subs = {}
sub_dir = SITE / "api/subdivisions"
if sub_dir.is_dir():
    for f in sorted(sub_dir.glob("*.json")):
        subs[f.stem.upper()] = json.loads(f.read_text(encoding="utf-8"))

data = {
    "ranking": ranking,
    "jokePlayers": jokes,
    "players": players,
    "listInformation": list_info,
    "mapMeta": map_meta,
    "subdivisions": subs,
}
(DOCS / "static/pages-data.js").write_text(
    "window.__PAGES_DATA__ = " + json.dumps(data, separators=(",", ":")) + ";\n", encoding="utf-8")

SHIM = r"""
/* Static-build API shim: answers every /api/v1/... request from pages-data.js so
   the archived statsviewer JavaScript works on GitHub Pages without server.js.
   Mirrors the routing in server.js exactly. */
(function () {
  "use strict";
  var D = window.__PAGES_DATA__ || {};
  var ARCH = D.ranking || [];
  var JOKES = D.jokePlayers || [];
  var FULL = ARCH.concat(JOKES);
  var PLAYERS = D.players || [];
  var LIST_INFO = D.listInformation || {};
  var MAP = D.mapMeta || { countries: {} };
  var SUBS = D.subdivisions || {};

  var BASE = (function () {
    var m = location.pathname.match(/^(\/[^/]+\/)/);
    return m ? m[1] : "/";
  })();

  function continentOf(cc) {
    var c = MAP.countries[String(cc).toLowerCase()];
    return c ? c.continent || null : null;
  }
  function normContinent(s) { return s.toLowerCase().replace(/\s+/g, "-"); }
  function rankIndex(rows, rank) {
    for (var i = 0; i < rows.length; i++) if (rows[i].rank === rank) return i;
    return -1;
  }
  function byId(list, id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function split(url) {
    var a;
    try { a = new URL(String(url), location.href); } catch (e) { return { path: "/", q: new URLSearchParams(), abs: String(url) }; }
    var p = a.pathname, i = p.indexOf("/api/");
    if (i === -1) i = p.indexOf("/static/");
    return { path: i === -1 ? p : p.slice(i), q: a.searchParams, abs: a.pathname + a.search };
  }

  function handleRanking(q) {
    var rows = FULL.slice();
    var name = (q.get("name_contains") || "").toLowerCase();
    if (name) rows = rows.filter(function (p) { return p.name.toLowerCase().indexOf(name) !== -1; });
    var nation = q.get("nation");
    if (nation) rows = rows.filter(function (p) { return p.nationality && p.nationality.country_code === nation.toUpperCase(); });
    var cont = q.get("continent");
    if (cont) rows = rows.filter(function (p) { return p.nationality && continentOf(p.nationality.country_code) === normContinent(cont); });
    var sub = q.get("subdivision");
    if (sub) rows = rows.filter(function (p) { return p.nationality && p.nationality.subdivision && p.nationality.subdivision.iso_code === sub.toUpperCase(); });

    var limit = Math.max(1, Math.min(parseInt(q.get("limit") || "50", 10) || 50, 50));
    var after = parseInt(q.get("after") || "0", 10) || 0;
    var before = parseInt(q.get("before") || "0", 10) || 0;

    var start = 0;
    if (after) { var ai = rankIndex(rows, after); start = ai === -1 ? rows.length : ai + 1; }

    var page;
    if (before) {
      var bi = rankIndex(rows, before);
      var end = bi === -1 ? rows.length : bi;
      start = Math.max(0, end - limit);
      page = rows.slice(start, end);
    } else {
      page = rows.slice(start, start + limit);
    }

    var params = [];
    ["name_contains", "nation", "continent", "subdivision"].forEach(function (k) {
      var v = q.get(k);
      if (v) params.push(k + "=" + encodeURIComponent(v));
    });
    params.push("limit=" + limit);
    var qs = params.join("&");

    var links = [];
    if (start + limit < rows.length && page.length) {
      links.push("</api/v1/players/ranking/?" + qs + "&after=" + page[page.length - 1].rank + ">; rel=next");
    }
    if (start > 0 && page.length) {
      links.push("</api/v1/players/ranking/?" + qs + "&before=" + page[0].rank + ">; rel=prev");
    }
    return { status: 200, obj: page, headers: links.length ? { links: links.join(", ") } : {} };
  }

  function notFound(msg) {
    return { status: 404, obj: { code: 40400, message: msg, data: null }, headers: {} };
  }

  function route(url, method) {
    var s = split(url);
    var p = s.path;
    if (p.indexOf("/api/") !== 0) return null;
    var m;
    if (method && method.toUpperCase() !== "GET") {
      return { status: 405, obj: { code: 40500, message: "This mirror is read-only." }, headers: {} };
    }
    if (p === "/api/v1/players/ranking/" || p === "/api/v1/players/ranking") return handleRanking(s.q);
    if (p === "/api/v1/list_information/" || p === "/api/v1/list_information") {
      return { status: 200, obj: LIST_INFO, headers: {} };
    }
    m = p.match(/^\/api\/v1\/nationalities\/([A-Za-z]+)\/subdivisions\/?$/);
    if (m) return { status: 200, obj: SUBS[m[1].toUpperCase()] || [], headers: {} };
    if (p === "/api/v1/players/" || p === "/api/v1/players") {
      var name = (s.q.get("name_contains") || "").toLowerCase();
      var rows = name ? PLAYERS.filter(function (x) { return x.name.toLowerCase().indexOf(name) !== -1; }) : PLAYERS;
      return { status: 200, obj: rows.slice(0, 50), headers: {} };
    }
    m = p.match(/^\/api\/v1\/players\/(\d+)\/?$/);
    if (m) {
      var id = Number(m[1]);
      var archived = byId(PLAYERS, id);
      if (archived) return { status: 200, obj: { data: archived }, headers: {} };
      var joke = byId(JOKES, id);
      if (joke) return { status: 200, obj: { data: joke }, headers: {} };
      var known = byId(ARCH, id);
      return notFound(known
        ? "Record details for " + known.name + " were not preserved by the Wayback Machine - only the archived top-50 ranking (rank, score, nationality) is available in this mirror."
        : "This player is not inside the archived top 50.");
    }
    if (p.indexOf("/api/v2/demons/") === 0) {
      return notFound("Demon history (audit/movement) was not preserved in this snapshot.");
    }
    return notFound("Endpoint not preserved in this snapshot.");
  }

  function fixStatic(url) {
    // root-absolute /static/... must become app-root-relative under Pages.
    var s = split(url);
    if (s.path.indexOf("/static/") === 0) {
      try {
        var a = new URL(String(url), location.href);
        return BASE + s.path.slice(1) + a.search;
      } catch (e) { /* fall through */ }
    }
    return url;
  }

  var RealXHR = window.XMLHttpRequest;

  function ShimXHR() {
    this._url = ""; this._method = "GET"; this._real = null; this._headers = {};
    this.readyState = 0; this.status = 0; this.responseText = ""; this.response = "";
    this.onload = null; this.onerror = null; this.onreadystatechange = null;
    this.withCredentials = false; this.timeout = 0; this.ontimeout = null;
  }
  ShimXHR.prototype.open = function (method, url) {
    this._method = method; this._url = url;
    this._result = route(url, method);
    if (this._result === null) {
      this._real = new RealXHR();
      var self = this;
      this._real.open(method, fixStatic(url), true);
      this._real.onloadend = function () {
        self.readyState = 4; self.status = self._real.status;
        self.responseText = self._real.responseText; self.response = self._real.responseText;
        self._headers = {};
        var raw = self._real.getAllResponseHeaders() || "";
        raw.split("\r\n").forEach(function (line) {
          var i = line.indexOf(": ");
          if (i > 0) self._headers[line.slice(0, i).toLowerCase()] = line.slice(i + 2);
        });
        if (self.onreadystatechange) self.onreadystatechange();
        if (self.onload) self.onload();
      };
      this._real.onerror = function () { if (self.onerror) self.onerror(); };
    }
  };
  ShimXHR.prototype.setRequestHeader = function (k, v) { if (this._real) this._real.setRequestHeader(k, v); };
  ShimXHR.prototype.getAllResponseHeaders = function () {
    var out = [];
    for (var k in this._headers) out.push(k + ": " + this._headers[k]);
    return out.join("\r\n");
  };
  ShimXHR.prototype.getResponseHeader = function (k) { return this._headers[String(k).toLowerCase()]; };
  ShimXHR.prototype.overrideMimeType = function () {};
  ShimXHR.prototype.abort = function () { if (this._real) this._real.abort(); };
  ShimXHR.prototype.send = function (body) {
    if (this._real) { this._real.send(body); return; }
    var self = this;
    setTimeout(function () {
      var r = self._result;
      self._headers = Object.assign({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }, r.headers);
      self.readyState = 4; self.status = r.status;
      self.responseText = JSON.stringify(r.obj); self.response = self.responseText;
      if (self.onreadystatechange) self.onreadystatechange();
      if (self.onload) self.onload();
    }, 0);
  };
  window.XMLHttpRequest = ShimXHR;

  var RealFetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    var method = (init && init.method) || (input && input.method) || "GET";
    var r = route(url, method);
    if (r !== null) {
      var headers = Object.assign({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }, r.headers);
      return Promise.resolve(new Response(JSON.stringify(r.obj), { status: r.status, headers: headers }));
    }
    if (!RealFetch) return Promise.reject(new Error("fetch unavailable"));
    return RealFetch(fixStatic(url), init);
  };

  window.__PAGES_BASE__ = BASE;
})();
"""
(DOCS / "static/pages-shim.js").write_text(SHIM.strip() + "\n", encoding="utf-8")

# -------------------------------------------------------------- 3. HTML rewrites
# GitHub Pages serves this copy of site/ at https://<user>.github.io/<repo>/, so
# every page has to know that prefix. A <base> written at runtime by a script is
# too late: Chrome's preload scanner has already requested the head's CSS/JS
# relative to the document URL. So the prefix is baked in at build time.
# Override with:  python build-pages.py --base /some-other-prefix/   ("" = at root)
BASE = "/pointercrate-june-12-2024/"
if "--base" in sys.argv:
    BASE = sys.argv[sys.argv.index("--base") + 1]
if BASE and not (BASE.startswith("/") and BASE.endswith("/")):
    raise SystemExit("--base must look like /repo-name/ or be empty for a root deployment")

HEAD_SNIPPET = (
    '<base href="' + BASE + '">'
    '<script src="' + BASE + 'static/pages-data.js"></script>'
    '<script src="' + BASE + 'static/pages-shim.js"></script>'
)


def rel_from(base_dir: Path, target: Path) -> str:
    r = os.path.relpath(str(target), str(base_dir)).replace("\\", "/")
    return r if r.startswith(".") else "./" + r


def rewrite_html(text: str, html_file: Path) -> str:
    # demon pages -> query-string URLs (Pages cannot route /demonlist/<n>/ paths)
    text, n = re.subn(r'href="/demonlist/(?:permalink/)?(\d+)/"', r'href="demonlist/demon.html?id=\1"', text)
    bump("html: demon links", n)

    # nav targets that were never mirrored -> the live site
    for target, url in [("/documentation/", "https://pointercrate.com/documentation/"),
                        ("/guidelines/", "https://pointercrate.com/demonlist/guidelines/"),
                        ("/", "https://pointercrate.com/")]:
        text = text.replace('href="%s"' % target, 'href="%s"' % url)
        bump("html: external links")

    # root-absolute -> base-relative (attributes, inline url(), and the
    # <object data="..."> that holds the world map)
    text, n = re.subn(r'(href|src|data)="/(?!/)', r'\1="', text)
    bump("html: root-absolute attrs", n)
    text, n = re.subn(r'url\(/(?!/)', "url(", text)
    bump("html: root-absolute url()", n)

    # ...and only then the <base> + shim, whose own URLs must stay absolute
    if "pages-shim.js" not in text:
        new_text, n = re.subn(r"<head[^>]*>", lambda mm: mm.group(0) + HEAD_SNIPPET, text, count=1)
        if not n:
            raise SystemExit(f"{html_file}: no <head> tag found")
        text = new_text
        bump("html: head snippet")
    return text


for html_file in sorted(DOCS.rglob("*.html")):
    src = html_file.read_text(encoding="utf-8", errors="replace")
    html_file.write_text(rewrite_html(src, html_file), encoding="utf-8")

# statsviewer link target: /demonlist/statsviewer/ needs a real file
sv_dir = DOCS / "demonlist/statsviewer"
sv_dir.mkdir(parents=True, exist_ok=True)
shutil.copyfile(DOCS / "index.html", sv_dir / "index.html")
bump("html: statsviewer copy")

# GitHub Pages would otherwise run the bundle through Jekyll, which silently
# drops files starting with an underscore and can choke on archived markup.
(DOCS / ".nojekyll").write_text("", encoding="utf-8")
bump("nojekyll marker")

# ---------------------------------------------------------------- 4. CSS files
for css_file in sorted(DOCS.rglob("*.css")):
    src = css_file.read_text(encoding="utf-8", errors="replace")
    def css_sub(m):
        # the pattern stops before the closing ")" of url(...), so don't add one
        return "url(" + rel_from(css_file.parent, DOCS / m.group(1))
    out, n = re.subn(r'url\(/((?:static|api|demonlist)/[^)"\']+)', css_sub, src)
    if n:
        css_file.write_text(out, encoding="utf-8")
        bump("css: url() rewritten", n)

# ------------------------------------------------------------- 4b. SVG documents
# world.svg is loaded through <object> and pulls in heatmap.css itself; inside an
# SVG those URLs resolve against the SVG file, not the page.
for svg_file in sorted(DOCS.rglob("*.svg")):
    src = svg_file.read_text(encoding="utf-8", errors="replace")
    def svg_sub(m):
        return 'href="' + rel_from(svg_file.parent, DOCS / m.group(1)) + '"'
    out, n = re.subn(r'href="/((?:static|api|demonlist)/[^"]+)"', svg_sub, src)
    if n:
        svg_file.write_text(out, encoding="utf-8")
        bump("svg: href rewritten", n)

# ------------------------------------------------------------------ 5. JS files
for js_file in sorted((DOCS / "static").rglob("*.js")):
    if js_file.name in ("pages-shim.js", "pages-data.js"):
        continue
    src = js_file.read_text(encoding="utf-8", errors="replace")

    # ES module specifiers resolve against the importing file, not <base>
    def import_sub(m):
        return 'from "' + rel_from(js_file.parent, DOCS / m.group(1)) + '"'
    src, n = re.subn(r'from "/(static/[^"]+)"', import_sub, src)
    bump("js: import specifiers", n)

    # demon permalinks built at runtime
    src, n = re.subn(r'"/demonlist/permalink/"\+([A-Za-z0-9_.]+)\+"/"', r'"demonlist/demon.html?id=" + \1', src)
    bump("js: permalink concat", n)
    src, n = re.subn(r'/demonlist/permalink/\$\{([^}]+)\}/', r'demonlist/demon.html?id=${\1}', src)
    bump("js: permalink template", n)
    src, n = re.subn(r'"/demonlist/"', '"demonlist/"', src)
    bump("js: /demonlist/ strings", n)

    # inline-style flag urls and fetch()ed json -> base-relative
    src, n = re.subn(r'url\(/(static/)', r"url(\1", src)
    bump("js: url(/static)", n)
    js_file.write_text(src, encoding="utf-8")

# --------------------------------------------------------------------- summary
# cheap self-checks: a botched url() rewrite silently kills icon fonts
problems = []
for css_file in sorted(DOCS.rglob("*.css")):
    t = css_file.read_text(encoding="utf-8", errors="replace")
    if t.count("(") != t.count(")"):
        problems.append(f"{css_file.relative_to(ROOT)}: unbalanced parentheses")
    if re.search(r"url\(/(?!/)", t):
        problems.append(f"{css_file.relative_to(ROOT)}: absolute url() left")
for html_file in sorted(DOCS.rglob("*.html")):
    t = html_file.read_text(encoding="utf-8", errors="replace")
    if f'<base href="{BASE}">' not in t:
        problems.append(f"{html_file.relative_to(ROOT)}: missing <base>")
if problems:
    raise SystemExit("BUILD NOT SAFE:\n  " + "\n  ".join(problems))

total = sum(v for k, v in counts.items())
for k in sorted(counts):
    print(f"  {k:28} {counts[k]}")
files = sum(1 for _ in DOCS.rglob("*") if _.is_file())
size = sum(f.stat().st_size for f in DOCS.rglob("*") if f.is_file())
print(f"docs/: {files} files, {size/1024/1024:.1f} MB ({total} rewrites)")
