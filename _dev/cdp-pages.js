// Verify the static GitHub Pages bundle end to end (against _dev/serve-pages.js).
const BASE = process.argv[2] || "http://localhost:8799/pointercrate-june-12-2024/";
const http = require("http");
const fs = require("fs");

function getJson(p) {
  return new Promise((res, rej) => http.get({ host: "localhost", port: 9222, path: p }, (r) => {
    let b = ""; r.on("data", (c) => b += c); r.on("end", () => res(JSON.parse(b)));
  }).on("error", rej));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const page = (await getJson("/json/list")).find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const errors = []; const bad = [];
  const send = (m, p = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  const bodies = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); return; }
    if (msg.method === "Network.responseReceived") {
      const r = msg.params.response;
      bodies.set(msg.params.requestId, r.url);
      if (r.status >= 400) bad.push(r.status + " " + r.url.replace(BASE, "/"));
    } else if (msg.method === "Runtime.exceptionThrown") {
      errors.push("EXC: " + ((msg.params.exceptionDetails.exception || {}).description || "").split("\n")[0]);
    } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      errors.push("CONSOLE: " + msg.params.args.map((a) => a.value || a.description || "").join(" ").slice(0, 200));
    }
  };
  await new Promise((r) => { ws.onopen = r; });
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  const evalJs = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return { evalError: (r.exceptionDetails.exception || {}).description };
    return r.result ? r.result.value : undefined;
  };
  const goto = async (url, ms = 4000) => { await send("Page.navigate", { url }); await sleep(ms); };

  // ---- statsviewer
  await goto(BASE);
  console.log("SV: " + JSON.stringify(await evalJs(`(() => {
    const lis=[...document.querySelectorAll('#stats-viewer-pagination .selection-list li')];
    const flag=lis[0]&&lis[0].querySelector('.flag-icon');
    return { rows: lis.length, first: lis[0]&&lis[0].textContent.trim().replace(/\\s+/g,' '),
      shim: typeof window.__PAGES_BASE__, base: document.baseURI,
      flagStyle: flag?flag.style.backgroundImage:null,
      cssLoaded: getComputedStyle(document.body).fontFamily };
  })()`)));

  await evalJs(`document.querySelector('#stats-viewer-pagination .selection-list li').click()`);
  await sleep(900);
  const detail = `(() => { const t=(i)=>{const e=document.getElementById(i);return e?e.textContent.trim().replace(/\\s+/g," "):null;};
    return {name:t("player-name"),rank:t("rank"),score:t("score"),stats:t("stats"),hardest:t("hardest"),
      beaten:t("beaten"),created:t("created"),published:t("published"),verified:t("verified"),progress:t("progress"),
      notice:(document.getElementById("mirror-notice")||{}).textContent}; })()`;
  console.log("SV DETAIL: " + JSON.stringify(await evalJs(detail)));

  await evalJs(`document.querySelector('#stats-viewer-pagination .next').click()`);
  await sleep(1100);
  console.log("SV PAGE2: " + JSON.stringify(await evalJs(`[...document.querySelectorAll('#stats-viewer-pagination .selection-list li')]
    .map(li=>li.dataset.rank+" "+li.textContent.trim().replace(/\\s+/g,' ')+" ["+(li.querySelector('.flag-icon')||{}).title+"]")`)));
  await evalJs(`document.querySelector('#stats-viewer-pagination .selection-list li[data-id="900052"]').click()`);
  await sleep(900);
  console.log("JOKE DETAIL: " + JSON.stringify(await evalJs(detail)));
  await evalJs(`document.querySelector('#stats-viewer-pagination .prev').click()`);
  await sleep(1100);
  console.log("SV BACK: " + JSON.stringify(await evalJs(`(() => { const l=[...document.querySelectorAll('#stats-viewer-pagination .selection-list li')];
    return { rows:l.length, first:l[0].textContent.trim().replace(/\\s+/g,' ') }; })()`)));

  // search box (exercises name_contains through the shim)
  await evalJs(`(() => { const i=document.querySelector('#stats-viewer-pagination input');
    i.value='Zoink'; i.dispatchEvent(new Event('change')); })()`);
  await sleep(1200);
  console.log("SV SEARCH Zoink: " + JSON.stringify(await evalJs(`[...document.querySelectorAll('#stats-viewer-pagination .selection-list li')]
    .map(li=>li.dataset.rank+" "+li.textContent.trim().replace(/\\s+/g,' '))`)));

  // nation dropdown -> /api/v1/nationalities + subdivision endpoint
  await goto(BASE + "demonlist/");
  console.log("DL BASE: " + JSON.stringify(await evalJs(`(() => ({
    baseURI: document.baseURI, shimBase: window.__PAGES_BASE__,
    firstCss: (document.querySelector('link[rel=stylesheet]')||{}).href,
    styleOk: getComputedStyle(document.querySelector('.container')||document.body).maxWidth }))()`)));
  console.log("DL: " + JSON.stringify(await evalJs(`(() => {
    const rows=[...document.querySelectorAll('.demonlist-row, #demonlist tbody tr, .list-entry')];
    const links=[...document.querySelectorAll('a[href^="demonlist/demon.html"]')];
    return { bodyRows: rows.length, demonLinks: links.length, sample: links[0]&&links[0].getAttribute('href'),
      title: document.title.slice(0,60), h1: (document.querySelector('h1')||{}).textContent }; })()`)));

  await goto(BASE + "demonlist/demon.html?id=562", 3500);
  console.log("DEMON: " + JSON.stringify(await evalJs(`(() => ({
    h1: (document.querySelector('#demon-content h1')||{}).textContent,
    by: (document.querySelector('#demon-content p.by')||{}).textContent,
    badge: (document.querySelector('.demon-badge')||{}).textContent,
    video: !!document.getElementById('video-thumb'),
    nav: [...document.querySelectorAll('.demon-nav a')].map(a=>a.getAttribute('href')),
    crumb: (document.getElementById('crumb-pos')||{}).textContent }))()`)));

  await goto(BASE + "demonlist/statsviewer/", 3500);
  console.log("SV COPY: " + JSON.stringify(await evalJs(`(() => {
    const lis=[...document.querySelectorAll('#stats-viewer-pagination .selection-list li')];
    return { rows: lis.length, first: lis[0]&&lis[0].textContent.trim().replace(/\\s+/g,' ') }; })()`)));

  let shot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync("_dev/shot-pages-sv.png", Buffer.from(shot.data, "base64"));

  console.log("NETWORK FAILURES: " + JSON.stringify([...new Set(bad)].slice(0, 25)));
  console.log("ERRORS: " + JSON.stringify([...new Set(errors)].slice(0, 12)));
  ws.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
