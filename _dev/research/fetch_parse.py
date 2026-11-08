#!/usr/bin/env python3
"""Fetch archived pointercrate demon pages (Wayback id_ captures) and parse
verifier + records data. RESEARCH ONLY. Writes only under _dev/research/.
Data authenticity: everything comes from the archived HTML; failures recorded.
"""
import concurrent.futures as cf
import gzip
import json
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent.parent  # project root
RES = ROOT / "_dev" / "research"
PAGES = RES / "pages"
PAGES.mkdir(parents=True, exist_ok=True)

KNOWN = [
    ("20240515165042", "pointercrate.com", 419),
    ("20240515165100", "pointercrate.com", 201),
    ("20240515165137", "pointercrate.com", 416),
    ("20240515165142", "pointercrate.com", 435),
    ("20240515165149", "pointercrate.com", 218),
    ("20240515165152", "pointercrate.com", 166),
    ("20240522004314", "pointercrate.com", 415),
    ("20240522004332", "pointercrate.com", 374),
    ("20240522004341", "pointercrate.com", 300),
    ("20240522004352", "pointercrate.com", 274),
    ("20240522004358", "pointercrate.com", 160),
    ("20240522004429", "pointercrate.com", 149),
    ("20240522093025", "pointercrate.com", 237),
    ("20240619191315", "pointercrate.com", 243),
    ("20240704023209", "www.pointercrate.com", 185),
    ("20240723013134", "pointercrate.com", 230),
    ("20240723013146", "pointercrate.com", 231),
    ("20240723221133", "pointercrate.com", 203),
]


def extra_candidates():
    """Reuse the already-fetched full-year CDX (cdx-demonlist-2024.json at root,
    verified to contain exactly the 18 known May-July captures). Pick per-URL
    capture closest to 2024-06-12 12:00, exclude known, cap at 40."""
    rows = json.load(open(ROOT / "cdx-demonlist-2024.json", encoding="utf-8"))[1:]
    target = datetime(2024, 6, 12, 12, 0, 0)
    known_ts = {t for t, _, _ in KNOWN}
    best = {}
    for r in rows:
        ts, url = r[1], r[2]
        m = re.match(r"https?://(www\.)?pointercrate\.com/demonlist/(\d+)/?$", url)
        if not m or ts in known_ts:
            continue
        host = "www.pointercrate.com" if m.group(1) else "pointercrate.com"
        pos = int(m.group(2))
        dt = datetime.strptime(ts, "%Y%m%d%H%M%S")
        d = abs((dt - target).total_seconds())
        key = (host, pos)
        if key not in best or (d, ts) < best[key][:2]:
            best[key] = (d, ts, host, pos)
    cands = sorted(best.values(), key=lambda x: (x[0], x[1]))[:40]
    return [(ts, host, pos) for _, ts, host, pos in cands]


def fetch(ts, host, pos):
    dest = PAGES / f"{pos}-{ts}.html"
    url = f"https://web.archive.org/web/{ts}id_/https://{host}/demonlist/{pos}/"
    if dest.exists() and dest.stat().st_size > 1000:
        return {"ts": ts, "host": host, "pos": pos, "url": url, "file": dest.name,
                "status": "cached", "bytes": dest.stat().st_size}
    # position 149 already fetched+decompressed by the user
    if pos == 149 and ts == "20240522004429" and (RES / "pos149.html").exists():
        dest.write_bytes((RES / "pos149.html").read_bytes())
        return {"ts": ts, "host": host, "pos": pos, "url": url, "file": dest.name,
                "status": "reused-local", "bytes": dest.stat().st_size}
    for attempt in (1, 2):
        try:
            p = subprocess.run(
                ["curl", "-s", "--compressed", "--max-time", "75", "-w", "%{http_code}",
                 "-o", str(dest), url],
                capture_output=True, text=True, timeout=90)
            code = (p.stdout or "").strip()[-3:]
            if dest.exists():
                raw = dest.read_bytes()
                if raw[:2] == b"\x1f\x8b":  # gzip even with --compressed
                    raw = gzip.decompress(raw)
                    dest.write_bytes(raw)
                if code == "200" and len(raw) > 1000:
                    return {"ts": ts, "host": host, "pos": pos, "url": url,
                            "file": dest.name, "status": "ok", "bytes": len(raw),
                            "http": code}
            err = f"http={code} bytes={dest.stat().st_size if dest.exists() else 0}"
        except Exception as e:
            err = str(e)
        if attempt == 1:
            continue
    return {"ts": ts, "host": host, "pos": pos, "url": url, "file": dest.name,
            "status": "failed", "error": err}


def parse_page(path, ts, host, pos, source_url):
    html = path.read_text(encoding="utf-8", errors="replace")
    soup = BeautifulSoup(html, "html.parser")
    out = {"capture_ts": ts, "source_url": source_url, "demon_id": None,
           "name": None, "position_at_capture": pos, "position_june12": None,
           "publisher": None, "verifier": None, "records": [], "notes": []}
    # demon_id MUST come from the heading's clipboard script, not the nav
    # sidebar (which lists every demon's permalink, starting with #1).
    m = re.search(r"clipboard\.writeText\(\s*'https?://[^']*?/demonlist/permalink/(\d+)/", html)
    if not m:
        m = re.search(r"demon-heading[\s\S]{0,600}?/demonlist/permalink/(\d+)/", html)
    if m:
        out["demon_id"] = int(m.group(1))
    else:
        out["notes"].append("no clipboard permalink reference found")
    h1 = soup.find("h1", id="demon-heading")
    if h1:
        for a in h1.find_all("a"):
            a.decompose()
        out["name"] = h1.get_text(" ", strip=True)
    else:
        out["notes"].append("no demon-heading found")
    # publisher / verifier line
    for h3 in soup.find_all("h3"):
        t = h3.get_text(" ", strip=True)
        m = re.match(r"^by\s+(.+?)(?:,\s*verified\s+by\s+(.+))?$", t)
        if m:
            out["publisher"] = m.group(1).strip()
            out["verifier"] = m.group(2).strip() if m.group(2) else None
            break
    if out["publisher"] is None:
        out["notes"].append("no 'by X[, verified by Y]' line found")
    # records section
    sec = soup.find("section", class_="records")
    if sec is None:
        out["notes"].append("no records section")
    else:
        h4 = sec.find("h4")
        if h4:
            out["records_summary"] = h4.get_text(" ", strip=True)
        table = sec.find("table")
        if table is None:
            out["notes"].append("records section has no table")
        else:
            for tr in table.find_all("tr"):
                tds = tr.find_all("td")
                if len(tds) < 3:
                    continue  # header row (th) or malformed
                flag = tds[0].find("span", class_="flag-icon")
                country = flag.get("title") if flag else None
                a = tds[1].find("a")
                player = tds[1].get_text(" ", strip=True)
                video = a.get("href") if a else None
                progress = tds[2].get_text(" ", strip=True)
                if not video and len(tds) > 3:
                    a2 = tds[3].find("a")
                    video = a2.get("href") if a2 else None
                if not player:
                    continue
                out["records"].append({"player": player, "country": country,
                                       "progress": progress, "video": video})
        stated = re.search(r"(\d+)\s+records registered", out.get("records_summary", ""))
        if stated and int(stated.group(1)) != len(out["records"]):
            out["notes"].append(
                f"record count mismatch: stated {stated.group(1)}, parsed {len(out['records'])}")
    return out


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    if mode in ("all", "fetch"):
        targets = KNOWN + extra_candidates()
        print(f"fetching {len(targets)} pages (18 known + {len(targets)-18} extra)", flush=True)
        results = []
        with cf.ThreadPoolExecutor(max_workers=4) as ex:
            futs = {ex.submit(fetch, t, h, p): (t, h, p) for t, h, p in targets}
            for i, f in enumerate(cf.as_completed(futs), 1):
                r = f.result()
                results.append(r)
                print(f"[{i}/{len(targets)}] {r['pos']}-{r['ts']}: {r['status']}"
                      + (f" ({r.get('error','')})" if r["status"] == "failed" else ""), flush=True)
        results.sort(key=lambda r: (r["pos"], r["ts"]))
        (RES / "fetch-log.json").write_text(json.dumps(results, indent=1), encoding="utf-8")
        ok = sum(1 for r in results if r["status"] in ("ok", "cached", "reused-local"))
        print(f"fetch done: {ok}/{len(results)} usable", flush=True)
    if mode in ("all", "parse"):
        demons = json.load(open(ROOT / "site/static/demonlist/demons-20240612.json",
                                encoding="utf-8"))
        by_id = {d["id"]: d for d in demons}
        log = json.load(open(RES / "fetch-log.json", encoding="utf-8"))
        pages = []
        for r in log:
            if r["status"] not in ("ok", "cached", "reused-local"):
                pages.append({"capture_ts": r["ts"], "source_url": r["url"],
                              "demon_id": None, "name": None,
                              "position_at_capture": r["pos"], "position_june12": None,
                              "publisher": None, "verifier": None, "records": [],
                              "notes": [f"fetch failed: {r.get('error','unknown')}"]})
                continue
            p = parse_page(PAGES / r["file"], r["ts"], r["host"], r["pos"], r["url"])
            dj = by_id.get(p["demon_id"])
            if dj:
                p["position_june12"] = dj["position"]
                p["name_june12"] = dj["name"]
            else:
                p["notes"].append("demon_id not in June-12-2024 list (559 demons)")
            pages.append(p)
        pages.sort(key=lambda p: (p["position_at_capture"], p["capture_ts"]))
        (RES / "archived-demon-pages.json").write_text(
            json.dumps(pages, indent=1, ensure_ascii=False), encoding="utf-8")
        nrec = sum(len(p["records"]) for p in pages)
        nver = sum(1 for p in pages if p["verifier"])
        print(f"parsed {len(pages)} pages, {nrec} records, {nver} verifiers", flush=True)


if __name__ == "__main__":
    main()