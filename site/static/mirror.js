// Local-mirror enhancement, loaded as a module after individual.js.
//
// 1) Ranking rows: the archived markup puts flag / "#N" / name / score as plain
//    inline children of a block <li>, so long names ("[VDL] ViperVenom95") wrapped
//    onto a second line under the flag. Each row is now a flex row: the name lives
//    in its own column and wraps inside it, the score stays pinned to the right.
// 2) Player detail: the June 12, 2024 snapshot preserved the top-50 ranking (rank,
//    score, nationality) but no per-player record details, so the stat fields
//    (Demonlist stats, hardest demon, completed/created/published/verified,
//    progress) keep their archived labels and stay empty. Nothing is invented.
// 3) Pagination: ranks 51-53 are the joke list the user asked for; it is served by
//    server.js with joke:true and labelled as a joke in the detail notice.
window.addEventListener("load", () => {
  const sv = window.statsViewer;
  if (!sv) return;

  const style = document.createElement("style");
  style.id = "mirror-ranking-css";
  style.textContent = [
    "#stats-viewer-pagination ul.selection-list li { display: flex; align-items: flex-start; }",
    "#stats-viewer-pagination ul.selection-list li > .flag-icon { flex: 0 0 auto; }",
    "#stats-viewer-pagination ul.selection-list li > b { flex: 0 0 auto; margin-left: 5px; }",
    "#stats-viewer-pagination ul.selection-list li > .mirror-name { flex: 0 1 auto; min-width: 0;",
    "  margin-left: 2px; overflow-wrap: break-word; }",
    "#stats-viewer-pagination ul.selection-list li > i { flex: 0 0 auto; margin-left: auto;",
    "  padding-left: 8px; white-space: nowrap; }",
  ].join("\n");
  document.head.appendChild(style);

  // Re-flow the generated row: name text node -> span so it can wrap in place.
  const origItem = sv.itemConstructor;
  sv.itemConstructor = (player) => {
    const li = origItem(player);
    const b = li.querySelector("b");
    const i = li.querySelector("i");
    if (b && i) {
      for (let n = b.nextSibling; n && n !== i; ) {
        const next = n.nextSibling;
        if (n.nodeType === 3) {
          const text = n.textContent.trim();
          if (text) {
            const span = document.createElement("span");
            span.className = "mirror-name";
            span.title = player.name;
            span.textContent = text;
            li.replaceChild(span, n);
          } else {
            li.removeChild(n);
          }
        }
        n = next;
      }
    }
    for (const n of Array.from(li.childNodes)) {
      if (n.nodeType === 3 && !n.textContent.trim()) li.removeChild(n);
    }
    return li;
  };

  // Labels stay, values stay empty.
  const emptyStats = () => {
    for (const id of ["stats", "hardest", "beaten", "created", "published", "verified", "progress"]) {
      const el = document.getElementById(id);
      if (el) el.textContent = "";
    }
  };
  emptyStats();

  const NOTICE_ARCHIVED =
    "<b>June 12, 2024 snapshot.</b> Rank, score and nationality are preserved; " +
    "player stats are left empty in this mirror. " +
    '<a href="https://pointercrate.com/demonlist/statsviewer/" target="_blank" rel="noopener">View current stats on pointercrate</a>.';
  const NOTICE_JOKE =
    "<b>Joke list.</b> Ranks 51&ndash;53 are a joke entry, not part of the archived " +
    "June 12, 2024 ranking. Stats are empty like every other player here.";

  let ranking = [];
  const ready = fetch("/api/v1/players/ranking/?limit=50")
    .then((r) => r.json())
    .then((d) => { ranking = d; });

  function show(player) {
    this.currentObject = player;
    this.setName(player.name, player.nationality);
    this._rank.textContent = player.rank;
    this._score.textContent = player.score.toFixed(2);
    emptyStats();

    let notice = this._content.querySelector("#mirror-notice");
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "mirror-notice";
      this._content.prepend(notice);
    }
    notice.innerHTML = player.joke ? NOTICE_JOKE : NOTICE_ARCHIVED;

    for (const listener of this.selectionListeners) listener(player);
  }

  sv.selectArbitrary = function (id) {
    const self = this;
    return ready.then(() => {
      const archived = ranking.find((p) => p.id === Number(id));
      if (archived) return show.call(self, archived);
      return fetch("/api/v1/players/" + id + "/")
        .then((r) => r.json().then((body) => ({ ok: r.ok, body: body })))
        .then(({ ok, body }) => {
          if (!ok || !body || !body.data) {
            throw { data: { code: 40400, message: "This player is not inside the archived top 50." } };
          }
          return show.call(self, body.data);
        });
    });
  };
});
