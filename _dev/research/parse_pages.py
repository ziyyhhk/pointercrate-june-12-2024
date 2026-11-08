#!/usr/bin/env python3
"""Parse the raw archived demon position pages fetched into pages/.
Extracts ONLY what the archive actually contains: demon identity (from the
page's own permalink clipboard script), the 'by ... verified by ... published
by ...' line, and the server-rendered records table. No invented data."""
import gzip
import html as HTML
import json
import re
from pathlib import Path

ROOT = Path(__file__).parent
PAGES = ROOT / "pages"
PROJ = ROOT.parent.parent
demons_june = {d["id"]: d for d in json.loads(
    (PROJ / "site/static/demonlist/demons-20240612.json").read_text(encoding="utf-8"))}

def load(p):
    b = p.read_bytes()
    if b[:2] == b"\x1f\x8b":
        b = gzip.decompress(b)
    return b.decode("utf-8", errors="replace")

def strip_tags(s):
    s = re.sub(r'<div class="tooltip">.*?</div>\s*</div>', " ", s, flags=re.S)
    s = re.sub(r"<[^>]+>", "", s)
    return re.sub(r"\s+", " ", HTML.unescape(s)).strip()

out = []
for p in sorted(PAGES.glob("*.html")):
    pos_s, ts = p.stem.split("-", 1)
    t = load(p)
    if len(t) < 5000:
        print("SKIP empty:", p.name)
        continue
    m = re.search(r"clipboard\.writeText\('https://pointercrate\.com/demonlist/permalink/(\d+)/", t)
    if not m:
        print("SKIP no permalink:", p.name)
        continue
    did = int(m.group(1))
    h1 = re.search(r'<h1[^>]*id="demon-heading"[^>]*>(.*?)</h1>', t, re.S)
    name = strip_tags(h1.group(1)) if h1 else None
    byline = None
    for hm in re.finditer(r"<h3>(by .*?)</h3>", t, re.S):
        byline = strip_tags(hm.group(1))
        break
    verifier = publisher = None
    if byline:
        vm = re.search(r"verified and published by (.+)$", byline)
        if vm:
            verifier = publisher = vm.group(1).strip()
        else:
            vm = re.search(r", verified by ([^,]+)", byline)
            if vm: verifier = vm.group(1).strip()
            pm = re.search(r", published by ([^,]+)", byline)
            if pm: publisher = pm.group(1).strip()
    if verifier in ("-", ""): verifier = None
    if publisher in ("-", ""): publisher = None

    records = []
    sec = re.search(r'<section class="records.*?</section>', t, re.S)
    if sec:
        for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", sec.group(0), re.S):
            if "<th" in tr:
                continue
            tds = re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)
            if len(tds) < 3:
                continue
            country = re.search(r'title="([^"]*)"', tds[0])
            prog = re.search(r"(\d+)\s*%", tds[2])
            holder = strip_tags(tds[1])
            vid = re.search(r'href="([^"]+)"', tds[3] if len(tds) > 3 else tds[1])
            if not holder or not prog:
                continue
            records.append({"player": holder,
                            "country": HTML.unescape(country.group(1)) if country else None,
                            "progress": int(prog.group(1)),
                            "video": HTML.unescape(vid.group(1)) if vid else None})
    june = demons_june.get(did)
    out.append({
        "file": p.name, "capture_ts": ts, "position_at_capture": int(pos_s),
        "source_url": f"https://web.archive.org/web/{ts}/https://pointercrate.com/demonlist/{pos_s}/",
        "demon_id": did, "name": name, "byline": byline,
        "publisher": publisher, "verifier": verifier,
        "name_june12": june["name"] if june else None,
        "position_june12": june["position"] if june else None,
        "records": records,
    })
    print(f"pos {pos_s:>3} cap {ts} demon {did:>4} {name!r:30} ver={verifier!r} records={len(records)}")

(ROOT / "demon-pages-parsed.json").write_text(
    json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"\nTOTAL: {len(out)} pages, {sum(len(p['records']) for p in out)} records, "
      f"{sum(1 for p in out if p['verifier'])} with verifier")