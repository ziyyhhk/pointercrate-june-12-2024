#!/usr/bin/env python3
"""Build the local mirror from the archived snapshot assets."""
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).parent
SITE = ROOT / "site"
NS = {"svg": "http://www.w3.org/2000/svg", "xhtml": "http://www.w3.org/1999/xhtml"}

# ---------------------------------------------------------------- CSS rewrites
def rewrite_css_urls(path: Path):
    text = path.read_text(encoding="utf-8")
    # /web/20240610134645im_/https://pointercrate.com/static/... -> /static/...
    text = re.sub(r"/web/\d+[a-z_]*/https://pointercrate\.com/", "/", text)
    text = re.sub(r"/web/\d+[a-z_]*/http://pointercrate\.com/", "/", text)
    path.write_text(text, encoding="utf-8")
    return text

for css in (SITE / "static/core/css").glob("*.css"):
    t = rewrite_css_urls(css)
    left = re.findall(r"url\((/web/[^)]*)\)", t)
    if left:
        print(f"  !! {css.name}: leftover wayback urls: {left[:3]}")
rewrite_css_urls(SITE / "static/demonlist/css/statsviewer.css")
print("CSS urls rewritten")

# ---------------------------------------------------------------- JS unwrap
# Wayback's wombat wraps classic scripts in a block with shadowed globals,
# which hides top-level declarations (class DropDown etc.) from inline
# onclick handlers. Remove only that instrumentation so the original site
# code runs at top level exactly as it did on the live site.
def unwrap_wombat_js(path: Path):
    t = path.read_text(encoding="utf-8")
    t = re.sub(r'^var _____WB\$wombat\$assign\$function_____=.*?return this;\}\}\{', '', t, count=1, flags=re.S)
    t = re.sub(r'^let (?:window|self|document|location|top|parent|frames|opener) = _____WB\$wombat\$assign\$function_____\("[a-z]+"\);[ \t]*\n', '', t, flags=re.M)
    t = re.sub(r'\}\s*(?=/\*\s*FILE ARCHIVED ON)', '', t, count=1)
    t = re.sub(r'/\*\s*FILE ARCHIVED ON.*?\*/\s*', '', t, flags=re.S)
    t = re.sub(r'/\*\s*playback timings.*?\*/\s*', '', t, flags=re.S)
    path.write_text(t.strip() + "\n", encoding="utf-8")

for js in ["ui.js", "nav.js", "misc.js"]:
    unwrap_wombat_js(SITE / "static/core/js" / js)
print("core js unwrapped (wombat block removed)")

# ---------------------------------------------------------------- SVG metadata
tree = ET.parse(SITE / "static/demonlist/images/world.svg")
root = tree.getroot()

continents = {}   # continent id -> [country codes]
countries = {}    # code -> {"name":..., "continent":...}
subdivisions = {} # code -> [{"iso_code":..., "name":...}]

def local(tag):
    return tag.split("}")[-1]

def title_of(el):
    for child in el.iter():
        if local(child.tag) == "title" and child.text:
            return child.text.strip()
    return None

for cont in root.iter():
    if local(cont.tag) != "g":
        continue
    cls = cont.get("class", "")
    if "continent" not in cls.split():
        continue
    cid = cont.get("id")
    continents[cid] = []
    for g in cont.iter():
        if g is cont or local(g.tag) != "g":
            continue
        gcls = g.get("class", "").split()
        code = (g.get("id") or "").lower()
        if not re.fullmatch(r"[a-z]{2}", code):
            continue
        if not ({"land", "island", "land-with-states"} & set(gcls)):
            continue
        name = title_of(g) or code.upper()
        countries[code] = {"name": name, "continent": cid}
        continents[cid].append(code)
        subs = []
        for p in g.iter():
            if "state" in (p.get("class", "") or "").split():
                sid = p.get("id", "")
                m = re.fullmatch(r"([A-Za-z]{2})-([A-Za-z0-9]{1,3})", sid)
                if m:
                    subs.append({"iso_code": m.group(2).upper(),
                                 "name": title_of(p) or m.group(2).upper()})
        if subs:
            subs.sort(key=lambda s: s["name"])
            subdivisions[code] = subs

meta = {"continents": continents, "countries": countries, "subdivisions": subdivisions}
(SITE / "api/map-meta.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
print(f"map metadata: {len(continents)} continents, {len(countries)} countries, "
      f"{sum(len(v) for v in subdivisions.values())} subdivisions in {len(subdivisions)} countries")

# point the SVG's embedded stylesheet at the local copy
svg_path = SITE / "static/demonlist/images/world.svg"
svg_text = svg_path.read_text(encoding="utf-8")
svg_text = svg_text.replace('href="/demonlist/statsviewer/heatmap.css"',
                            'href="/static/demonlist/css/heatmap.css"')
svg_path.write_text(svg_text, encoding="utf-8")
print("world.svg stylesheet link rewritten")

# ---------------------------------------------------------------- HTML rewrite
html = (ROOT / "archive.html").read_text(encoding="utf-8")

# drop the wayback playback toolbar scripts/styles
html = re.sub(r'<script type="text/javascript" src="https://web-static\.archive\.org[^"]*"[^>]*></script>\s*', "", html)
html = re.sub(r'<script>window\.RufflePlayer.*?</script>\s*', "", html, flags=re.S)
html = re.sub(r'<script type="text/javascript">\s*__wm\.init.*?</script>\s*', "", html, flags=re.S)
html = re.sub(r'<link rel="stylesheet"[^>]*web-static\.archive\.org[^>]*/>\s*', "", html)
html = re.sub(r'<!-- End Wayback Rewrite JS Include -->\s*', "", html)
# drop google analytics
html = re.sub(r'<script async src="https://web\.archive\.org/[^"]*googletagmanager[^"]*"[^>]*></script>\s*', "", html)
html = re.sub(r"<script>\s*window\.dataLayer.*?</script>\s*", "", html, flags=re.S)
# drop the cloudflare challenge injector at the end
html = re.sub(r"<script>\(function\(\)\{function c\(\).*?</script>", "", html, flags=re.S)
# drop wayback trailing comments
html = re.sub(r"<!--\s*FILE ARCHIVED ON.*?-->", "", html, flags=re.S)
html = re.sub(r"<!--\s*playback timings.*?-->", "", html, flags=re.S)

# rewrite all wayback resource URLs to local paths
html = re.sub(r"https://web\.archive\.org/web/\d+[a-z_]*/https://pointercrate\.com/", "/", html)
html = re.sub(r"/web/\d+[a-z_]*/https://pointercrate\.com/", "/", html)
html = re.sub(r"https://web\.archive\.org/web/\d+[a-z_]*/https://www\.pointercrate\.com/", "/", html)

# jquery -> local vendor copies
html = html.replace("https://web.archive.org/web/20240612173310js_/https://ajax.googleapis.com/ajax/libs/jquery/3.1.1/jquery.min.js",
                    "/static/vendor/jquery.min.js")
html = html.replace("https://web.archive.org/web/20240612173310js_/https://ajax.googleapis.com/ajax/libs/jqueryui/1.12.1/jquery-ui.min.js",
                    "/static/vendor/jquery-ui.min.js")
# montserrat -> local
html = re.sub(r'https://web\.archive\.org/web/\d+cs_/https://fonts\.googleapis\.com/css\?family=Montserrat[^"]*',
              "/static/fonts/montserrat.css", html)

# the archived page duplicated its core script/link tags; dedupe consecutive repeats
for tag in re.findall(r'<script src="/static/core/js/(?:ui|nav|misc)\.js"></script>', html):
    first = html.find(tag)
    rest = html[first + len(tag):]
    html = html[:first + len(tag)] + rest.replace(tag, "")
for tag in re.findall(r'<link rel="stylesheet" href="/static/core/css/[^"]*">', html):
    first = html.find(tag)
    rest = html[first + len(tag):]
    html = html[:first + len(tag)] + rest.replace(tag, "")
for tag in ['<script src="/static/vendor/jquery.min.js"></script>',
            '<script src="/static/vendor/jquery-ui.min.js"></script>',
            '<link rel="stylesheet" href="/static/fonts/montserrat.css">']:
    first = html.find(tag)
    if first != -1:
        rest = html[first + len(tag):]
        html = html[:first + len(tag)] + rest.replace(tag, "")

# demon permalinks stay local -> served by server.js as archived demon detail pages

# ---------------------------------------------------------------- mirror cleanup
# User-requested removals (applied to both pages after URL rewriting):
#  - User Area / login (nav header + footer)
#  - Record Submitter (nav dropdown link; on /demonlist/ also the panel,
#    the player-selection dialog overlay and the "Submit Records" aside promo)
#  - List Editors + List Helpers aside, Discord widget aside
#  - footer "Tweet Us / Developer / Demonlist Team" block
# Kept: copyright line, pointercrate column, Terms of Use, Demonlist column.
def mirror_cleanup(t, demonlist=False):
    t = re.sub(r'<div class="nav-group"><a class="nav-item hover white" href="/login/">.*?</a></div>', "", t, flags=re.S)
    t = re.sub(r'<li><a class="white hover" href="/demonlist/\?submitter=true">Record Submitter</a></li>', "", t)
    t = re.sub(r'<a class="link" href="/login/">User Area</a><br>', "", t)
    t = re.sub(r'<div style="display: flex; justify-content: center; align-items: center"><i class="fab fa-twitter.*?</div>(?=</footer>)', "", t, flags=re.S)
    if demonlist:
        t = re.sub(r'<section class="panel fade closable" id="submitter".*?</section>', "", t, flags=re.S)
        t = re.sub(r'<div class="overlay closable"><div class="dialog" id="submission-holder-dialog">.*?(?=<section)', "", t, flags=re.S)
        t = re.sub(r'<section[^>]*\bid="(?:editors|submit|discord)"[^>]*>.*?</section>', "", t, flags=re.S)
    return t

html = mirror_cleanup(html)
for gone in ["User Area", "Record Submitter", "Tweet Us", "/login/"]:
    assert gone not in html, f"statsviewer cleanup missed: {gone}"

leftover = re.findall(r'(?:src|href)="(/web/[^"]*|https://web\.archive\.org[^"]*)"', html)
leftover = [u for u in leftover if "twitter.com" not in u and "web-static" not in u]
if leftover:
    print("  !! leftover wayback refs:", leftover[:10])

# ---------------------------------------------------------------- mirror additions
banner_css = """
<style id="mirror-css">
#mirror-banner{position:relative;z-index:50;display:flex;align-items:center;gap:.6em;justify-content:center;
 background:linear-gradient(90deg,#1b1b1f,#2a2a31);color:#e8e8ec;font-size:12px;letter-spacing:.02em;
 padding:7px 34px 7px 14px;text-align:center;box-shadow:0 1px 0 rgba(0,0,0,.25)}
#mirror-banner b{color:#ffb3c6;font-weight:700}
#mirror-banner a{color:#ff8fab;text-decoration:none;border-bottom:1px dotted #ff8fab}
#mirror-banner a:hover{color:#ffc2d1}
#mirror-banner .mb-dot{width:7px;height:7px;border-radius:50%;background:#ff2457;flex:none;
 box-shadow:0 0 8px #ff2457;animation:mb-pulse 2.4s ease-in-out infinite}
@keyframes mb-pulse{0%,100%{opacity:1}50%{opacity:.35}}
#mirror-close{position:absolute;right:8px;top:50%;transform:translateY(-50%);border:0;background:none;
 color:#9a9aa2;font-size:15px;cursor:pointer;line-height:1;padding:4px}
#mirror-close:hover{color:#fff}
.mirror-na{color:#9a9aa2;font-style:italic;font-size:.85em}
#mirror-notice{margin:10px 0 2px;padding:8px 10px;border-left:3px solid #ff2457;background:rgba(255,36,87,.06);
 font-size:11.5px;color:#6a6a70;line-height:1.45;border-radius:0 4px 4px 0}
#mirror-notice a{color:#d16432}
@media(max-width:767px){#mirror-banner{font-size:11px;padding:6px 30px 6px 10px}}
</style>
"""
html = html.replace("</head>", banner_css + "</head>", 1)

# mirror.js runs as a module after individual.js so its load handler fires second
html = html.replace('<script src="/static/demonlist/js/statsviewer/individual.js" type="module"></script>',
                    '<script src="/static/demonlist/js/statsviewer/individual.js" type="module"></script>'
                    '<script src="/static/mirror.js" type="module"></script>', 1)

(SITE / "index.html").write_text(html, encoding="utf-8")
print(f"index.html written ({len(html)} bytes)")

# ---------------------------------------------------------------- demonlist page
# Real archived /demonlist/ HTML (capture 20240613001316 = June 12 evening PDT),
# server-rendered with the full 709-demon ranking as it stood that day.
dl = (ROOT / "demonlist-archive.html").read_text(encoding="utf-8")

# strip wayback playback toolbar
dl = re.sub(r'<script type="text/javascript" src="https://web-static\.archive\.org[^"]*"[^>]*></script>\s*', "", dl)
dl = re.sub(r'<script>window\.RufflePlayer.*?</script>\s*', "", dl, flags=re.S)
dl = re.sub(r'<script type="text/javascript">\s*__wm\.init.*?</script>\s*', "", dl, flags=re.S)
dl = re.sub(r'<link rel="stylesheet"[^>]*web-static\.archive\.org[^>]*/>\s*', "", dl)
dl = re.sub(r'<!-- End Wayback Rewrite JS Include -->\s*', "", dl)
# strip the external google analytics loader; KEEP the inline dataLayer block,
# which defines gtag() locally so the submitter/time-machine handlers work offline
dl = re.sub(r'<script async src="https://web\.archive\.org/[^"]*googletagmanager[^"]*"[^>]*></script>\s*', "", dl)
# strip cloudflare challenge injector and wayback trailing comments
dl = re.sub(r"<script>\(function\(\)\{function c\(\).*?</script>", "", dl, flags=re.S)
dl = re.sub(r"<!--\s*FILE ARCHIVED ON.*?-->", "", dl, flags=re.S)
dl = re.sub(r"<!--\s*playback timings.*?-->", "", dl, flags=re.S)

# rewrite wayback resource URLs to local paths
dl = re.sub(r"https://web\.archive\.org/web/\d+[a-z_]*/https://pointercrate\.com/", "/", dl)
dl = re.sub(r"/web/\d+[a-z_]*/https://pointercrate\.com/", "/", dl)
dl = re.sub(r"https://web\.archive\.org/web/\d+[a-z_]*/https://www\.pointercrate\.com/", "/", dl)
dl = re.sub(r'https://web\.archive\.org/web/\d+js_/https://ajax\.googleapis\.com/ajax/libs/jquery/3\.1\.1/jquery\.min\.js',
            "/static/vendor/jquery.min.js", dl)
dl = re.sub(r'https://web\.archive\.org/web/\d+js_/https://ajax\.googleapis\.com/ajax/libs/jqueryui/1\.12\.1/jquery-ui\.min\.js',
            "/static/vendor/jquery-ui.min.js", dl)
dl = re.sub(r'https://web\.archive\.org/web/\d+cs_/https://fonts\.googleapis\.com/css\?family=Montserrat[^"]*',
            "/static/fonts/montserrat.css", dl)
# remaining wayback-wrapped externals (schema.org, twitter, youtube) -> direct URLs
dl = re.sub(r"https://web\.archive\.org/web/\d+[a-z_]*/", "", dl)

# demon permalinks stay local -> server.js renders archived demon detail pages

dl = mirror_cleanup(dl, demonlist=True)
for gone in ["User Area", "Record Submitter", "Tweet Us", "/login/", 'id="editors"', 'id="discord"', 'id="submitter"', "submission-holder-dialog", 'id="submit"']:
    assert gone not in dl, f"demonlist cleanup missed: {gone}"

# the page script must not initialize the removed record submitter
pjs = SITE / "static/demonlist/js/demonlist.js"
t = pjs.read_text(encoding="utf-8")
t = t.replace("initializeRecordSubmitter();", "")
t = t.replace("import{initializeRecordSubmitter,initializeTimeMachine,}", "import{initializeTimeMachine,}")
pjs.write_text(t, encoding="utf-8")

# dedupe the archived page's repeated script/link tags (keep first occurrence)
for tag in re.findall(r'<script src="/static/core/js/(?:ui|nav|misc)\.js"></script>', dl):
    first = dl.find(tag)
    rest = dl[first + len(tag):]
    dl = dl[:first + len(tag)] + rest.replace(tag, "")
for tag in re.findall(r'<link rel="stylesheet" href="/static/core/css/[^"]*">', dl):
    first = dl.find(tag)
    rest = dl[first + len(tag):]
    dl = dl[:first + len(tag)] + rest.replace(tag, "")
for tag in ['<script src="/static/vendor/jquery.min.js"></script>',
            '<script src="/static/vendor/jquery-ui.min.js"></script>',
            '<link rel="stylesheet" href="/static/fonts/montserrat.css">']:
    first = dl.find(tag)
    if first != -1:
        rest = dl[first + len(tag):]
        dl = dl[:first + len(tag)] + rest.replace(tag, "")

leftover = re.findall(r'(?:src|href)="(/web/[^"]*|https://web\.archive\.org[^"]*)"', dl)
if leftover:
    print("  !! demonlist leftover wayback refs:", leftover[:10])

# panel notes for the submitter / time-machine (no top banner)
dl_css = banner_css.replace("</style>",
 ".mirror-panel-note{margin:10px 0;padding:8px 10px;border-left:3px solid #ff2457;"
 "background:rgba(255,36,87,.06);font-size:11.5px;color:#6a6a70;line-height:1.45;"
 "border-radius:0 4px 4px 0}\n</style>")
dl = dl.replace("</head>", dl_css + "</head>", 1)

dl = dl.replace('<script src="/static/demonlist/js/demonlist.js" type="module"></script>',
                '<script src="/static/demonlist/js/demonlist.js" type="module"></script>'
                '<script src="/static/mirror-demonlist.js" type="module"></script>', 1)

(SITE / "demonlist").mkdir(exist_ok=True)
(SITE / "demonlist/index.html").write_text(dl, encoding="utf-8")
print(f"demonlist/index.html written ({len(dl)} bytes)")

# ---------------------------------------------------------------- demon data
# Extract the real per-demon fields preserved in the archived page (position,
# name, publisher from the list dropdowns; verification video from the top-150
# featured panels) so local demon detail pages can render them. No records are
# invented — the victors list was never archived.
import html as HTML
raw_dl = (ROOT / "demonlist-archive.html").read_text(encoding="utf-8")
demons = {}
for mm in re.finditer(r'<li[^>]*title="#(\d+) - ([^"]*)"[^>]*><a href="[^"]*?/permalink/(\d+)/">(.*?)<br><i>(.*?)</i></a></li>', raw_dl, re.S):
    pos, title, did, _text, pub = mm.groups()
    demons[int(did)] = {"id": int(did), "position": int(pos),
                        "name": HTML.unescape(title).strip(),
                        "publisher": HTML.unescape(pub).strip()}
for panel in re.findall(r'<section class="panel fade" style="overflow:hidden">(.*?)</section>', raw_dl, re.S):
    did = re.search(r'/permalink/(\d+)/', panel)
    vid = re.search(r'vi/([\w-]+)/mqdefault', panel) or re.search(r'youtube\.com/watch\?v=([\w-]+)', panel)
    if did and vid and int(did.group(1)) in demons:
        demons[int(did.group(1))]["video"] = vid.group(1)
demon_list = sorted(demons.values(), key=lambda d: d["position"])
(SITE / "static/demonlist").mkdir(parents=True, exist_ok=True)
(SITE / "static/demonlist/demons-20240612.json").write_text(
    json.dumps(demon_list, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"demon data: {len(demon_list)} demons, {sum(1 for d in demon_list if 'video' in d)} with verification video")

# ---------------------------------------------------------------- recovered data
# Merge genuinely recovered research data (_dev/research) — nothing invented:
#  * verifier: archived demon pages (period-accurate names) take priority; the
#    pointercrate database's verifier field is the fallback (a demon's verifier
#    is a fixed historical fact, valid for June 2024). Display names come from
#    the archived June-2024 ranking wherever the id is preserved there.
#  * player stats: published demons (archived June list), verified demons
#    (verifier facts), and completion/progress records recovered from the
#    server-rendered tables of archived demon pages (partial, labelled).
RES = ROOT / "_dev/research"
parsed_f, verlive_f = RES / "demon-pages-parsed.json", RES / "verifiers-live.json"
if parsed_f.exists() or verlive_f.exists():
    ranking = json.loads((SITE / "api/ranking-20240612.json").read_text(encoding="utf-8"))
    archived_names = {p["id"]: p["name"] for p in ranking}
    for p in json.loads((SITE / "api/players-20240529.json").read_text(encoding="utf-8")):
        archived_names.setdefault(p["id"], p["name"])
    parsed = json.loads(parsed_f.read_text(encoding="utf-8")) if parsed_f.exists() else []
    verlive = json.loads(verlive_f.read_text(encoding="utf-8")) if verlive_f.exists() else {}
    by_id = {d["id"]: d for d in demon_list}

    arch_ver = {}
    for pg in sorted(parsed, key=lambda p: abs(int(p["capture_ts"]) - 20240612120000)):
        if pg["verifier"] and pg["demon_id"] in by_id:
            arch_ver[pg["demon_id"]] = pg["verifier"]  # closest-to-June capture wins
    n_arch = n_live = 0
    for d in demon_list:
        v = arch_ver.get(d["id"])
        if v:
            n_arch += 1
        else:
            lv = verlive.get(str(d["id"]))
            if lv and lv.get("verifier_id"):
                v = archived_names.get(lv["verifier_id"], lv["verifier_name"])
                n_live += 1
        if v:
            d["verifier"] = v
    (SITE / "static/demonlist/demons-20240612.json").write_text(
        json.dumps(demon_list, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"verifiers merged: {n_arch} from archived pages + {n_live} from database facts "
          f"= {sum(1 for d in demon_list if 'verifier' in d)}/{len(demon_list)}")

    def norm(s):
        return re.sub(r"\s+", " ", re.sub(r"\[[^\]]*\]\s*", "", s)).strip().lower()
    norm_count = {}
    for pl in ranking:
        norm_count[norm(pl["name"])] = norm_count.get(norm(pl["name"]), 0) + 1
    def match_player(name):
        for pl in ranking:
            if pl["name"] == name:
                return pl["id"]
        n = norm(name)
        if norm_count.get(n) == 1:
            return next(pl["id"] for pl in ranking if norm(pl["name"]) == n)
        return None

    players = {pl["id"]: {"id": pl["id"], "name": pl["name"],
                          "published": [], "verified": [], "records": []} for pl in ranking}
    for d in demon_list:
        ref = {"id": d["id"], "name": d["name"], "position": d["position"]}
        pid = match_player(d["publisher"])
        if pid is not None:
            players[pid]["published"].append(ref)
        lv = verlive.get(str(d["id"]))
        vid = lv.get("verifier_id") if lv else None
        vname = d.get("verifier")
        for pl in ranking:
            if (vid is not None and vid == pl["id"]) or \
               (vname and (vname == pl["name"] or
                           (norm(vname) == norm(pl["name"]) and norm_count.get(norm(pl["name"])) == 1))):
                players[pl["id"]]["verified"].append(ref)
    seen = set()
    for pg in sorted(parsed, key=lambda p: abs(int(p["capture_ts"]) - 20240612120000), reverse=True):
        for r in pg["records"]:
            pid = match_player(r["player"])
            if pid is None:
                continue
            key = (pid, pg["demon_id"], r["progress"])
            if key in seen:
                continue
            seen.add(key)
            players[pid]["records"].append({
                "demon": {"id": pg["demon_id"],
                          "name": pg["name_june12"] or pg["name"],
                          "position": pg["position_june12"] or pg["position_at_capture"]},
                "progress": r["progress"], "video": r["video"],
                "capture_ts": pg["capture_ts"], "source": pg["source_url"]})
    for p in players.values():
        p["published"].sort(key=lambda d: d["position"])
        p["verified"].sort(key=lambda d: d["position"])
        p["records"].sort(key=lambda r: (r["demon"]["position"], -r["progress"]))
    ts_all = [p["capture_ts"] for p in parsed]
    stats = {"_meta": {
        "snapshot": "2024-06-12",
        "record_pages": len(parsed),
        "record_captures_range": [min(ts_all), max(ts_all)] if ts_all else [],
        "records_recovered": sum(len(p["records"]) for p in players.values()),
        "note": "published/verified/hardest are real list facts; completion records are a "
                "partial sample recovered from archived demon pages, not full player history"}}
    stats["players"] = players
    (SITE / "static/player-stats-2024.json").write_text(
        json.dumps(stats, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"player stats: {sum(1 for p in players.values() if p['verified'])} with verified demons, "
          f"{sum(1 for p in players.values() if p['published'])} with published, "
          f"{sum(1 for p in players.values() if p['records'])} with recovered records "
          f"({stats['_meta']['records_recovered']} records matched to the top 50)")