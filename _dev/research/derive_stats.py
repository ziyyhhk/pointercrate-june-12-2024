#!/usr/bin/env python3
"""Task D: derive player stats ONLY from recovered archived records.
Matching: exact name first, then clan-tag-stripped (explicitly flagged).
No fabricated data: unmatched holders listed separately."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
RES = ROOT / "_dev" / "research"

pages = json.load(open(RES / "archived-demon-pages.json", encoding="utf-8"))
ranking = json.load(open(ROOT / "site/api/ranking-20240612.json", encoding="utf-8"))

TAG = re.compile(r"^\s*(?:\[[^\]]*\]\s*)+")


def strip_tags(name):
    return TAG.sub("", name).strip()


# index ranking players: exact, tag-stripped exact, tag-stripped casefolded
exact = {}
stripped = {}
stripped_cf = {}
for p in ranking:
    exact.setdefault(p["name"], []).append(p)
    s = strip_tags(p["name"])
    stripped.setdefault(s, []).append(p)
    stripped_cf.setdefault(s.casefold(), []).append(p)


def match(name):
    """Return (player, match_type) or (None, None). Ambiguous fuzzy matches
    are refused (None) rather than guessed."""
    if name in exact and len(exact[name]) == 1:
        return exact[name][0], "exact"
    s = strip_tags(name)
    if s in stripped and len(stripped[s]) == 1:
        return stripped[s][0], "tag_stripped"
    if s.casefold() in stripped_cf and len(stripped_cf[s.casefold()]) == 1:
        return stripped_cf[s.casefold()][0], "tag_stripped_case_insensitive"
    return None, None


usable = [p for p in pages if p.get("demon_id") is not None]
n_pages = len(usable)
stats = {}
unmatched = {}
fuzzy_log = []
total_records = 0

for pg in usable:
    for rec in pg["records"]:
        total_records += 1
        player, mtype = match(rec["player"])
        entry = {
            "demon": pg["name"],
            "demon_id": pg["demon_id"],
            "position_june12": pg["position_june12"],
            "position_at_capture": pg["position_at_capture"],
            "progress": rec["progress"],
            "video": rec["video"],
            "country": rec["country"],
            "capture_ts": pg["capture_ts"],
            "source_url": pg["source_url"],
        }
        if player is None:
            unmatched.setdefault(rec["player"], 0)
            unmatched[rec["player"]] += 1
            continue
        if mtype != "exact":
            fuzzy_log.append({"record_name": rec["player"], "matched_name": player["name"],
                              "player_id": player["id"], "match_type": mtype,
                              "demon": pg["name"], "capture_ts": pg["capture_ts"]})
        pid = player["id"]
        st = stats.setdefault(pid, {
            "player_id": pid, "name": player["name"], "rank_june12": player["rank"],
            "demons_completed": 0, "hardest_recovered": None,
            "records": [], "sources": set(), "match_types": set(),
        })
        entry["record_name"] = rec["player"]
        entry["match_type"] = mtype
        st["records"].append(entry)
        st["sources"].add(pg["source_url"])
        st["match_types"].add(mtype)

for st in stats.values():
    # completions = distinct demons with a 100% record
    completed = {}
    for r in st["records"]:
        if r["progress"].replace(" ", "") == "100%":
            completed.setdefault(r["demon_id"], r)
    st["demons_completed"] = len(completed)
    if completed:
        # hardest: lowest June-12 position among known; demons absent from the
        # June-12 list rank after all known ones, ordered by capture position.
        def key(r):
            pj = r["position_june12"]
            return (0, pj) if pj is not None else (1, r["position_at_capture"])
        h = min(completed.values(), key=key)
        st["hardest_recovered"] = {
            "name": h["demon"], "demon_id": h["demon_id"],
            "position_june12": h["position_june12"],
            "position_at_capture": h["position_at_capture"],
            "position_basis": "june12" if h["position_june12"] is not None else "capture_time_only",
        }
    st["records"].sort(key=lambda r: (r["position_june12"] is None,
                                      r["position_june12"] or r["position_at_capture"]))
    st["sources"] = sorted(st["sources"])
    st["match_types"] = sorted(st["match_types"])
    st["coverage_note"] = f"partial — only {n_pages} demon pages preserved near June 2024"

out = {
    "generated_from": "archived-demon-pages.json (Wayback id_ captures, 2024)",
    "pages_recovered": n_pages,
    "total_records_parsed": total_records,
    "matching_policy": "exact name first; then leading clan-tag [X] stripped on both sides; case-insensitive only as last resort; ambiguous matches refused",
    "players": sorted(stats.values(), key=lambda s: s["rank_june12"]),
    "fuzzy_matches": fuzzy_log,
    "unmatched_record_holders": [
        {"name": n, "record_count": c} for n, c in sorted(unmatched.items(), key=lambda x: (-x[1], x[0]))
    ],
}
(RES / "recovered-player-stats.json").write_text(
    json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
print(f"pages={n_pages} records={total_records} matched_players={len(stats)} "
      f"fuzzy={len(fuzzy_log)} unmatched_names={len(unmatched)}")
for s in out["players"]:
    print(f"  #{s['rank_june12']} {s['name']}: {s['demons_completed']} completed, "
          f"{len(s['records'])} records, hardest={s['hardest_recovered']}")