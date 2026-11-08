// CDP driver: precise mobile/desktop emulation, measurements, screenshots.
// Usage: node cdp-test.js <url> <width> <height> <mobile0|1> <outPrefix> [clickFirstPlayer]
const fs = require("fs");
const http = require("http");

const [url, W, H, MOB, OUT, CLICK] = process.argv.slice(2);
const width = Number(W), height = Number(H), mobile = MOB === "1";

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
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id;
    pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const events = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id).resolve(m.result); pending.delete(m.id); }
    else if (m.method) events.push(m);
  };
  await new Promise((r) => { ws.onopen = r; });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: mobile ? 2 : 1, mobile });
  if (mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await send("Page.navigate", { url });
  await new Promise((r) => setTimeout(r, 4000));

  const evalJs = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    return r.result ? r.result.value : undefined;
  };

  const measurements = await evalJs(`(() => {
    const vw = window.innerWidth;
    const bad = [];
    document.querySelectorAll('body *').forEach(el => {
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (b.width && (b.right > vw + 1 || b.left < -1) && cs.position !== 'fixed') {
        const cls = el.className && el.className.baseVal === undefined ? String(el.className).split(' ')[0] : '';
        bad.push(el.tagName + '.' + cls + (el.id ? '#' + el.id : '') + ' w=' + Math.round(b.width) + ' right=' + Math.round(b.right));
      }
    });
    return { vw, vh: window.innerHeight, scrollW: document.documentElement.scrollWidth,
      meta: document.querySelector('meta[name=viewport]').content,
      rankingItems: document.querySelectorAll('#stats-viewer-pagination .selection-list li').length,
      bad: bad.slice(0, 20) };
  })()`);
  console.log("MEASUREMENTS " + OUT + ": " + JSON.stringify(measurements));

  if (CLICK) {
    await evalJs(`document.querySelector('#stats-viewer-pagination .selection-list li').click()`);
    await new Promise((r) => setTimeout(r, 800));
    const detail = await evalJs(`({ name: document.getElementById('player-name').textContent,
      rank: document.getElementById('rank').textContent, score: document.getElementById('score').textContent,
      notice: !!document.getElementById('mirror-notice'),
      contentVisible: getComputedStyle(document.querySelector('.viewer-content')).display !== 'none' })`);
    console.log("DETAIL " + OUT + ": " + JSON.stringify(detail));
  }

  if (process.argv[8] === "dropdown") {
    await evalJs(`(() => { const inp = document.querySelector('#statsviewer .dropdown-menu input'); inp.focus(); inp.dispatchEvent(new Event('change')); })()`);
    await new Promise((r) => setTimeout(r, 700));
    const dd = await evalJs(`({ menuVisible: getComputedStyle(document.querySelector('#statsviewer .dropdown-menu .menu')).display !== 'none',
      options: document.querySelectorAll('#statsviewer .dropdown-menu li').length,
      flagsRendered: [...document.querySelectorAll('#statsviewer .dropdown-menu .flag-icon')].filter(f => getComputedStyle(f).backgroundImage.includes('url')).length })`);
    console.log("DROPDOWN: " + JSON.stringify(dd));
  }

  const shot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(OUT + ".png", Buffer.from(shot.data, "base64"));
  console.log("saved " + OUT + ".png");

  const errors = await evalJs(`window.__cdpErrors || []`);
  ws.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });