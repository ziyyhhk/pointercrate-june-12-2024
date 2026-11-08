const fs = require("fs");
const http = require("http");
function getJson(path) { return new Promise((res, rej) => { http.get({ host: "localhost", port: 9222, path }, (r) => { let b = ""; r.on("data", (c) => b += c); r.on("end", () => res(JSON.parse(b))); }).on("error", rej); }); }
(async () => {
  const page = (await getJson("/json/list")).find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (m, p = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } };
  await new Promise((r) => { ws.onopen = r; });
  await send("Page.enable"); await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: "http://localhost:8642/" });
  await new Promise((r) => setTimeout(r, 4000));
  const ev = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true })).result.value;
  const box = await ev(`(() => { const b = document.querySelector('#statsviewer .dropdown-menu input').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: box.x, y: box.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x, y: box.y, button: "left", clickCount: 1 });
  await new Promise((r) => setTimeout(r, 800));
  console.log("after real click: " + JSON.stringify(await ev(`({ active: document.activeElement.tagName,
    inputVal: document.querySelector('#statsviewer .dropdown-menu input').value,
    menuDisplay: getComputedStyle(document.querySelector('#statsviewer .dropdown-menu .menu')).display,
    menuOpacity: getComputedStyle(document.querySelector('#statsviewer .dropdown-menu .menu')).opacity,
    visibleLis: [...document.querySelectorAll('#statsviewer .dropdown-menu li')].filter(li => li.offsetHeight > 0).length })`)));
  const shot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync("cdp-dropdown-open.png", Buffer.from(shot.data, "base64"));
  console.log("saved cdp-dropdown-open.png");
  ws.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });