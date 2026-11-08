#!/usr/bin/env python3
"""Retry failed fetches: timeouts get 2 more attempts (slow Petabox backend);
302s are verified and recorded as unavailable (no cross-date substitution)."""
import concurrent.futures as cf
import gzip
import json
import subprocess
from pathlib import Path

RES = Path(__file__).resolve().parent
PAGES = RES / "pages"
log = json.load(open(RES / "fetch-log.json", encoding="utf-8"))


def retry(r):
    url = r["url"]
    dest = PAGES / r["file"]
    if "http=302" in r.get("error", ""):
        # verify redirect target without downloading body
        try:
            p = subprocess.run(
                ["curl", "-s", "--compressed", "--max-time", "60", "-o", "/dev/null",
                 "-w", "%{http_code} %{redirect_url}", url],
                capture_output=True, text=True, timeout=75)
            code, _, redir = p.stdout.strip().partition(" ")
            r["status"] = "failed"
            r["error"] = f"http={code}; playback redirects to {redir or 'unknown'} (2024 capture unavailable)"
        except Exception as e:
            r["error"] += f"; recheck: {e}"
        return r
    for attempt in (1, 2):
        try:
            p = subprocess.run(
                ["curl", "-s", "--compressed", "--max-time", "150", "-w", "%{http_code}",
                 "-o", str(dest), url],
                capture_output=True, text=True, timeout=170)
            code = (p.stdout or "").strip()[-3:]
            if dest.exists():
                raw = dest.read_bytes()
                if raw[:2] == b"\x1f\x8b":
                    raw = gzip.decompress(raw)
                    dest.write_bytes(raw)
                if code == "200" and len(raw) > 1000:
                    r.update(status="ok", bytes=len(raw), http=code)
                    r.pop("error", None)
                    return r
            err = f"http={code} bytes={dest.stat().st_size if dest.exists() else 0}"
        except Exception as e:
            err = str(e)
    r["status"] = "failed"
    r["error"] = err
    return r


failed = [r for r in log if r["status"] == "failed"]
print(f"retrying {len(failed)} failed fetches", flush=True)
with cf.ThreadPoolExecutor(max_workers=2) as ex:
    futs = [ex.submit(retry, r) for r in failed]
    for i, f in enumerate(cf.as_completed(futs), 1):
        r = f.result()
        print(f"[{i}/{len(failed)}] {r['pos']}-{r['ts']}: {r['status']} {r.get('error','')}", flush=True)
log.sort(key=lambda r: (r["pos"], r["ts"]))
(RES / "fetch-log.json").write_text(json.dumps(log, indent=1), encoding="utf-8")
ok = sum(1 for r in log if r["status"] in ("ok", "cached", "reused-local"))
print(f"final: {ok}/{len(log)} usable", flush=True)