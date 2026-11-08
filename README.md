# Pointercrate — June 12, 2024

A local, offline mirror of the **June 12, 2024** Wayback Machine snapshot of
[`pointercrate.com/demonlist/statsviewer/`](https://web.archive.org/web/20240612173310/https://pointercrate.com/demonlist/statsviewer/)
— the Geometry Dash demonlist stats viewer, frozen at that date and served with
real archived data only.

**Live demo (GitHub Pages):** https://ziyyhhk.github.io/pointercrate-june-12-2024/
· demonlist: https://ziyyhhk.github.io/pointercrate-june-12-2024/demonlist/

## What is real, and what is missing

The snapshot is reproduced honestly: nothing is invented, and every field the
Wayback Machine never captured is left empty rather than filled with 2026 data.

| Kept from the snapshot | Never archived for that date |
| --- | --- |
| Top-50 player ranking (rank, score, nationality, flag) | Per-player record details: demons completed / created / published / verified, hardest demon, progress |
| The full demonlist — 559 demons with position, name, publisher | Demon permalink pages for June 2024 |
| Verification videos for the top 150 demons | Player record tables on the archived pages |
| Verifiers for all 559 demons (immutable fact, recovered from archived demon position pages and the pointercrate database) | Demon history / audit trail (time machine data) |

So the player detail panel shows the archived **labels** — *Demonlist stats,
Hardest demon, Demons completed, Demons created, Demons published, Demons
verified, Progress on* — with **empty values**, while rank and score are filled
from the real snapshot.

The only non-archived entries in the ranking are ranks **51–53**, a joke list
(`[BT] Ak1ra`, `[67] L4zy`, `[CC] Val`) that the Next button pages into; the
detail panel labels them as a joke so nobody mistakes them for data.

## Running it

**GitHub Pages** — the links above need nothing; `docs/` is a fully static build
whose `/api/v1/...` calls are answered in the browser by `docs/static/pages-shim.js`.

**Locally, with the real API server** (Node.js, zero dependencies):

```
start.bat            # Windows
node server.js       # anywhere else  ->  http://localhost:8642/
```

## Layout

```
server.js             zero-dependency API + static server (port 8642)
site/                 the archived page tree, rewritten to load offline
  api/*.json          archived ranking, list info, players, subdivisions, joke list
  static/mirror.js     local enhancements: empty stat fields, ranking row layout
  static/demon-detail.js  local demon pages (published by / verified by / video)
build.py              re-fetches and rebuilds site/ from the Wayback snapshot
build-pages.py        regenerates docs/ from site/ for GitHub Pages
docs/                 static Pages bundle (generated, committed)
_dev/                 test drivers (headless Chrome over CDP) + research data
_dev/research/        raw archived demon position pages + parsed records
```

Rebuild either half with `python build.py` (needs internet) or
`python build-pages.py` (offline; `--base /other-prefix/` if you rename the repo
or deploy somewhere else).

## Verifying

The `_dev/cdp-*.js` drivers drive a headless Chrome over CDP and assert the
rendered DOM: `node _dev/serve-pages.js` then `node _dev/cdp-pages.js` walks the
statsviewer, the pagination, the joke page, the demonlist and a demon page, and
reports every failed network request and console error.

## License

MIT for the mirroring tooling — see [LICENSE](LICENSE), which also states that
the archived pointercrate assets and demonlist data belong to pointercrate and
their authors. Snapshot courtesy of the
[Internet Archive](https://web.archive.org/web/20240612173310/https://pointercrate.com/demonlist/statsviewer/).
