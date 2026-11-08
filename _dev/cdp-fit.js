// Check that every ranking row is one line and nothing is cut off.
// node _dev/cdp-fit.js <url> <w> <h> <mobile0|1> <outName>
const URL_ = process.argv[2] || "http://localhost:8642/";
const W = Number(process.argv[3] || 1440), H = Number(process.argv[4] || 900);
const MOB = process.argv[5] === "1";
const OUT = process.argv[6] || "shot-fit";
const fs = require("fs");
const http = require("http");
const getJson = (p) => new Promise((res, rej) => http.get({ host: "localhost", port: 9222, path: p }, (r) => {
  let b = ""; r.on("data", (c) => b += c); r.on("end", () => res(JSON.parse(b)));
}).on("error", rej));

(async () => {
  const page = (await getJson("/json/list")).find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const errors = [];
  const send = (m, p = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); return; }
    if (m.method === "Runtime.exceptionThrown") errors.push("EXC: " + ((m.params.exceptionDetails.exception || {}).description || "").split("\n")[0]);
    else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("CONSOLE: " + m.params.args.map((a) => a.value || a.description || "").join(" ").slice(0, 160));
  };
  await new Promise((r) => { ws.onopen = r; });
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: MOB });
  await send("Page.navigate", { url: URL_ });
  await new Promise((r) => setTimeout(r, 4500));
  const evalJs = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return { evalError: (r.exceptionDetails.exception || {}).description };
    return r.result ? r.result.value : undefined;
  };

  const probe = `(() => {
    const lis=[...document.querySelectorAll('#stats-viewer-pagination .selection-list li')];
    const rows=lis.map(li=>{
      const nm=li.querySelector('.mirror-name'); const r=li.getBoundingClientRect();
      const cs=getComputedStyle(nm);
      return { rank:li.dataset.rank, name:nm.textContent, h:Math.round(r.height),
        fsz:+parseFloat(cs.fontSize).toFixed(1), cut: nm.scrollWidth > nm.clientWidth + 1,
        client:Math.round(nm.clientWidth), scroll:Math.round(nm.scrollWidth) };
    });
    const heights=[...new Set(rows.map(x=>x.h))];
    return { rows:rows.length, heights, cut:rows.filter(x=>x.cut).map(x=>x.rank+':'+x.name),
      fonts:[...new Set(rows.map(x=>x.fsz))].sort((a,b)=>a-b),
      widest:rows.slice().sort((a,b)=>b.scroll-a.client).slice(0,4) };
  })()`;
  console.log("PAGE1 " + JSON.stringify(await evalJs(probe)));

  const clip = await evalJs(`(() => { const p=document.getElementById('stats-viewer-pagination').getBoundingClientRect();
    return {x:Math.max(0,p.x-4),y:Math.max(0,p.y-4),width:p.width+8,height:Math.min(p.height+8,${H}-Math.max(0,p.y-4))}; })()`);
  let shot = await send("Page.captureScreenshot", { format: "png", clip: { ...clip, scale: 1 } });
  fs.writeFileSync(`_dev/${OUT}-rows.png`, Buffer.from(shot.data, "base64"));
  await evalJs(`document.querySelector('#stats-viewer-pagination .selection-list').scrollTop = 260`);
  await new Promise((r) => setTimeout(r, 300));
  shot = await send("Page.captureScreenshot", { format: "png", clip: { ...clip, scale: 1 } });
  fs.writeFileSync(`_dev/${OUT}-rows-scrolled.png`, Buffer.from(shot.data, "base64"));
  await evalJs(`document.querySelector('#stats-viewer-pagination .selection-list').scrollTop = 0`);

  // page 2 (joke list) + a filtered view
  await evalJs(`document.querySelector('#stats-viewer-pagination .next').click()`);
  await new Promise((r) => setTimeout(r, 1200));
  console.log("PAGE2 " + JSON.stringify(await evalJs(probe)));
  await evalJs(`document.querySelector('#stats-viewer-pagination .prev').click()`);
  await new Promise((r) => setTimeout(r, 1200));
  await evalJs(`(() => { const i=document.querySelector('#stats-viewer-pagination input'); i.value='[TCD]'; i.dispatchEvent(new Event('change')); })()`);
  await new Promise((r) => setTimeout(r, 1500));
  console.log("SEARCH [TCD] " + JSON.stringify(await evalJs(probe)));
  console.log("ERRORS " + JSON.stringify([...new Set(errors)]));
  ws.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
