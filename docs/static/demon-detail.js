// Local demon detail page — renders fields preserved in the June 12, 2024
// Wayback snapshot (position, name, publisher, verification video) plus the
// demon's verifier (an immutable historical fact, recovered from archived
// demon pages / the pointercrate database). Records are never invented.
const permaM = location.pathname.match(/\/permalink\/(\d+)/);
const posM = location.pathname.match(/\/demonlist\/(\d+)\/?$/);
const qid = new URLSearchParams(location.search).get("id");

const content = document.getElementById("demon-content");
const crumbPos = document.getElementById("crumb-pos");

function section(pos) {
  if (pos <= 75) return ["Main List", "badge-main"];
  if (pos <= 150) return ["Extended List", "badge-ext"];
  return ["Legacy List", "badge-legacy"];
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

fetch("/static/demonlist/demons-20240612.json?v=2")
  .then((r) => r.json())
  .then((demons) => {
    const demon = permaM ? demons.find((d) => d.id === Number(permaM[1]))
      : posM ? demons.find((d) => d.position === Number(posM[1]))
      : demons.find((d) => d.id === Number(qid));
    if (!demon) {
      crumbPos.textContent = "Unknown";
      content.innerHTML = '<div class="demon-missing"><h2>Demon not in the snapshot</h2>' +
        '<p>This demon was not on the June 12, 2024 list.</p>' +
        '<p><a href="demonlist/">Back to the demonlist</a></p></div>';
      return;
    }

    document.title = `#${demon.position} ${demon.name} — Geometry Dash Demonlist`;
    crumbPos.textContent = `#${demon.position}`;
    const [secName, secClass] = section(demon.position);

    const byPos = demons.slice().sort((a, b) => a.position - b.position);
    const idx = byPos.findIndex((d) => d.id === demon.id);
    const prev = byPos[idx - 1];
    const next = byPos[idx + 1];

    let videoHtml = "";
    if (demon.video) {
      const thumb = `https://i.ytimg.com/vi/${demon.video}/hqdefault.jpg`;
      videoHtml =
        `<div class="video-frame"><div class="video-thumb" id="video-thumb" ` +
        `style="background-image:url('${thumb}')" data-video="${esc(demon.video)}">` +
        `<div class="play-btn"></div></div></div>` +
        `<p class="video-cap">Verification video — archived link. Click to load from YouTube.</p>`;
    }

    const navLink = (d, dir, cls) => d
      ? `<a class="${cls}" href="demonlist/demon.html?id=${d.id}"><span class="dir">${dir} · #${d.position}</span><span class="nm">${esc(d.name)}</span></a>`
      : `<span style="flex:1;min-width:200px"></span>`;

    content.innerHTML =
      `<section class="panel fade" style="overflow:hidden">` +
      `<div class="demon-head">` +
      `<span class="demon-badge ${secClass}">${secName} · #${demon.position}</span>` +
      `<h1>#${demon.position} &#8211; ${esc(demon.name)}</h1>` +
      `<p class="by">published by <i>${esc(demon.publisher)}</i>` +
      (demon.verifier ? `, verified by <i>${esc(demon.verifier)}</i>` : "") + `</p>` +
      videoHtml +
      `</div>` +
      `<div class="demon-note">This page shows the fields preserved in the <b>June 12, 2024</b> Wayback Machine snapshot: ` +
      `rank, name, publisher` + (demon.verifier ? `, verifier` : ``) + ` and the verification video. The list of players who completed this demon (its records) ` +
      `was not captured for that date. <a href="https://pointercrate.comdemonlist/demon.html?id=${demon.id}" target="_blank" rel="noopener">View current records on pointercrate</a>.</div>` +
      `</section>` +
      `<div class="demon-nav">${navLink(prev, "Harder", "prev")}${navLink(next, "Easier", "next")}</div>`;

    const thumbEl = document.getElementById("video-thumb");
    if (thumbEl) {
      thumbEl.addEventListener("click", () => {
        const vid = thumbEl.dataset.video;
        const frame = thumbEl.parentElement;
        frame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${esc(vid)}?autoplay=1" ` +
          `allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen title="Verification video"></iframe>`;
      });
    }
  })
  .catch(() => {
    content.innerHTML = '<div class="demon-missing"><h2>Could not load the archived demon data.</h2>' +
      '<p><a href="demonlist/">Back to the demonlist</a></p></div>';
  });