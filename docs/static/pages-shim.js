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
