// Verify: ranking row layout fix + Next/Previous pagination into the joke list.
const fs = require("fs");
const http = require("http");
function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get({ host: "localhost", port: 9222, path }, (res) => {
      let b = ""; res.on("data", (c) => b += c); res.on("end", () => resolve(JSON.parse(b)));
    }).on("error", reject);
  });
}
(async () => {
  const targets = await getJson("/json/list");
  const page = targets.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const errors = [];
  const send = (method, params = {}) => new Promise((resolve) => {
    const mid = ++id; pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
    else if (m.method === "Runtime.exceptionThrown")
      errors.push("EXC: " + (m.params.exceptionDetails.exception || {}).description);
    else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")
      errors.push("CONSOLE: " + m.params.args.map((a) => a.value || a.description || "").join(" "));
  };
  await new Promise((r) => { ws.onopen = r; });
  await send("Page.enable"); await send("Runtime.enable");
  await send("Network.enable"); await send("Network.setCacheDisabled", { cacheDisabled: true });
  const W = Number(process.argv[2] || 1440), H = Number(process.argv[3] || 900);
  const mobile = process.argv[4] === "1";
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile, alwaysAllowDesktop: true });
  await send("Page.navigate", { url: "http://localhost:8642/" });
  await new Promise((r) => setTimeout(r, 4500));

  const evalJs = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return { evalError: (r.exceptionDetails.exception || {}).description };
    return r.result ? r.result.value : undefined;
  };

  const rows = `(() => {
    const lis = [...document.querySelectorAll('#stats-viewer-pagination .selection-list li')];
    return lis.slice(0, 12).map(li => {
      const r = li.getBoundingClientRect();
      const nm = li.querySelector('.mirror-name');
      const i = li.querySelector('i');
      const nr = nm ? nm.getBoundingClientRect() : null;
      const ir = i ? i.getBoundingClientRect() : null;
      return { rank: li.dataset.rank, text: li.textContent.trim().replace(/\\s+/g, ' '),
        liH: Math.round(r.height), nameLeft: nr ? Math.round(nr.left - r.left) : null,
        nameW: nr ? Math.round(nr.width) : null,
        nameLines: nr ? Math.round(nr.height / parseFloat(getComputedStyle(nm).lineHeight || 16)) : null,
        scoreRightGap: ir ? Math.round(r.right - ir.right) : null,
        scoreTop: ir ? Math.round(ir.top - r.top) : null };
    });
  })()`;
  console.log("PAGE1 ROWS: " + JSON.stringify(await evalJs(rows), null, 0));

  const panelClip = `(() => { const p = document.getElementById('stats-viewer-pagination').getBoundingClientRect();
    return { x: Math.max(0, p.x - 4), y: Math.max(0, p.y - 4), width: p.width + 8, height: Math.min(p.height + 8, ${H} - Math.max(0, p.y - 4)) }; })()`;
  const clip1 = await evalJs(panelClip);
  let shot = await send("Page.captureScreenshot", { format: "png", clip: { ...clip1, scale: 1 } });
  fs.writeFileSync(`_dev/shot-rows-${mobile ? "mob" : "desk"}.png`, Buffer.from(shot.data, "base64"));

  // --- press Next ---
  const nextRes = await evalJs(`(() => { const n = document.querySelector('#stats-viewer-pagination .next');
    n.click(); return { hasLink: !!(window.statsViewer && window.statsViewer.links && window.statsViewer.links.next) }; })()`);
  await new Promise((r) => setTimeout(r, 1200));
  const page2 = await evalJs(`(() => [...document.querySelectorAll('#stats-viewer-pagination .selection-list li')]
    .map(li => ({ id: li.dataset.id, rank: li.dataset.rank, text: li.textContent.trim().replace(/\\s+/g, ' '),
                  flag: (li.querySelector('.flag-icon') || {}).title })))()`);
  console.log("NEXT hasLink: " + JSON.stringify(nextRes) + " PAGE2: " + JSON.stringify(page2));
  const clip2 = await evalJs(panelClip);
  shot = await send("Page.captureScreenshot", { format: "png", clip: { ...clip2, scale: 1 } });
  fs.writeFileSync(`_dev/shot-joke-page-${mobile ? "mob" : "desk"}.png`, Buffer.from(shot.data, "base64"));

  // --- click rank 51 (joke) ---
  const detail = `(() => { const t = (id) => { const e = document.getElementById(id); return e ? e.textContent.trim().replace(/\\s+/g, " ") : null; };
    return { name: t("player-name"), rank: t("rank"), score: t("score"), stats: t("stats"), hardest: t("hardest"),
      beaten: t("beaten"), created: t("created"), published: t("published"), verified: t("verified"),
      progress: t("progress"), notice: (document.getElementById("mirror-notice") || {}).textContent }; })()`;
  console.log("CLICK51: " + JSON.stringify(await evalJs(`(() => { const li = document.querySelector('#stats-viewer-pagination .selection-list li[data-id="900051"]'); if (li) { li.click(); return true; } return false; })()`)));
  await new Promise((r) => setTimeout(r, 1200));
  console.log("JOKE DETAIL: " + JSON.stringify(await evalJs(detail)));
  if (!mobile) {
    shot = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync("_dev/shot-joke-detail.png", Buffer.from(shot.data, "base64"));
  }

  // --- press Previous ---
  await evalJs(`document.querySelector('#stats-viewer-pagination .prev').click()`);
  await new Promise((r) => setTimeout(r, 1200));
  console.log("PREV PAGE1: " + JSON.stringify(await evalJs(`(() => { const lis = [...document.querySelectorAll('#stats-viewer-pagination .selection-list li')];
    return { count: lis.length, first: lis[0] && lis[0].dataset.rank + " " + lis[0].textContent.trim().replace(/\\s+/g,' '),
             last: lis[lis.length-1] && lis[lis.length-1].dataset.rank + " " + lis[lis.length-1].textContent.trim().replace(/\\s+/g,' ') }; })()`)));

  // --- archived player still fine ---
  await evalJs(`document.querySelector('#stats-viewer-pagination .selection-list li').click()`);
  await new Promise((r) => setTimeout(r, 1000));
  console.log("ARCHIVED DETAIL: " + JSON.stringify(await evalJs(detail)));
  console.log("ERRORS: " + JSON.stringify(errors.slice(0, 10)));
  ws.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
