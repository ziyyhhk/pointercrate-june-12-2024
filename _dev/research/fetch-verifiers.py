#!/usr/bin/env python3
"""Fetch ONLY the verifier field for the 559 demons of the June 12, 2024 list.

Research-only: reads site/static/demonlist/demons-20240612.json (never modified),
writes _dev/research/verifiers-live.json. Current positions/records from the live
API are deliberately NOT extracted or stored -- only verifier id/name, the API's
demon name (for id-reuse sanity checks), and a case-insensitive name_match flag.

Politeness: ~0.2 s between requests, up to 3 retries with exponential backoff on
429/5xx/timeouts (Retry-After honored on 429), 404 recorded as missing.
Checkpoint written every 20 demons so progress survives interruption.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
INPUT = os.path.join(ROOT, "site", "static", "demonlist", "demons-20240612.json")
OUTDIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT = os.path.join(OUTDIR, "verifiers-live.json")
ENDPOINT = "https://pointercrate.com/api/v2/demons/{id}/"
UA = "wayback-mirror-research/1.0 (historical verifier lookup; contact: local mirror project)"
SLEEP = 0.2
TIMEOUT = 20
MAX_RETRIES = 3  # retries after the initial attempt


def fetch(demon_id):
    """Return (status, payload). status in {'ok','missing','error'}."""
    url = ENDPOINT.format(id=demon_id)
    delay = 1.0
    last_err = None
    for attempt in range(MAX_RETRIES + 1):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                body = json.loads(resp.read().decode("utf-8"))
            return "ok", body
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return "missing", None
            if e.code == 429 or 500 <= e.code < 600:
                last_err = "HTTP %d" % e.code
                if e.code == 429:
                    try:
                        ra = float(e.headers.get("Retry-After", "0"))
                        delay = max(delay, min(ra, 30.0))
                    except (TypeError, ValueError):
                        pass
            else:
                return "error", "HTTP %d" % e.code
        except Exception as e:  # timeouts, connection resets, DNS, JSON issues
            last_err = "%s: %s" % (type(e).__name__, e)
        if attempt < MAX_RETRIES:
            time.sleep(delay)
            delay *= 2
    return "error", last_err


def atomic_write(path, obj):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def main():
    with open(INPUT, encoding="utf-8") as f:
        demons = json.load(f)
    results = {}
    counts = {"with_verifier": 0, "missing_404": 0, "errors": 0, "null_verifier": 0}
    mismatches = []
    t0 = time.time()
    for i, d in enumerate(demons, 1):
        did = str(d["id"])
        status, payload = fetch(d["id"])
        if status == "missing":
            results[did] = {"verifier_id": None, "verifier_name": None,
                            "api_name": None, "name_match": None, "missing": True}
            counts["missing_404"] += 1
        elif status == "error":
            results[did] = {"verifier_id": None, "verifier_name": None,
                            "api_name": None, "name_match": None, "error": payload}
            counts["errors"] += 1
            print("ERROR id=%s (%s): %s" % (did, d["name"], payload), flush=True)
        else:
            data = payload.get("data", {})
            v = data.get("verifier") or {}
            api_name = data.get("name")
            # case-insensitive equality (outer whitespace stripped to avoid noise)
            match = (api_name or "").strip().casefold() == d["name"].strip().casefold()
            results[did] = {"verifier_id": v.get("id"), "verifier_name": v.get("name"),
                            "api_name": api_name, "name_match": match}
            if v.get("id") is None:
                counts["null_verifier"] += 1
            else:
                counts["with_verifier"] += 1
            if not match:
                mismatches.append({"id": d["id"], "archived_name": d["name"], "api_name": api_name})
                print("MISMATCH id=%s archived=%r api=%r" % (did, d["name"], api_name), flush=True)
        if i % 20 == 0 or i == len(demons):
            meta = {
                "source_input": "site/static/demonlist/demons-20240612.json",
                "endpoint": ENDPOINT,
                "fetched_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "note": "verifier is immutable historical data; verifier_name is the player's CURRENT display name (2026), not the June-2024 name. No positions/records stored.",
                "total": len(demons), "processed": i, **counts,
                "name_mismatches": mismatches,
            }
            atomic_write(OUTPUT, {**results, "_meta": meta})
            print("progress %d/%d  ok=%d missing=%d errors=%d  elapsed=%.0fs"
                  % (i, len(demons), counts["with_verifier"], counts["missing_404"],
                     counts["errors"], time.time() - t0), flush=True)
        time.sleep(SLEEP)
    print("DONE", json.dumps({k: v for k, v in counts.items()}), flush=True)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    main()