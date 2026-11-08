// CDP verify: console errors + page exceptions + custom eval + screenshot.
// Usage: node cdp-verify.js <url> <width> <height> <mobile0|1> <outPrefix> [evalExpr]
const fs = require("fs");
const http = require("http");
const [url, W, H, MOB, OUT, EXPR] = process.argv.slice(2);
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
  let id = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id; pending.set(mid, { resolve, reject });
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const errors = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id).resolve(m.result); pending.delete(m.id); }
    else if (m.method === "Runtime.exceptionThrown") {
      const d = m.params.exceptionDetails;
      errors.push("EXC: " + (d.exception && d.exception.description || d.text));
    } else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
      errors.push("CONSOLE: " + m.params.args.map((a) => a.value || a.description || "").join(" "));
    }
  };
  await new Promise((r) => { ws.onopen = r; });
  await send("Page.enable"); await send("Runtime.enable");
  await send("Network.enable"); await send("Network.setCacheDisabled", { cacheDisabled: true });
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: mobile ? 2 : 1, mobile });
  if (mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await send("Page.navigate", { url });
  await new Promise((r) => setTimeout(r, 4500));
  const evalJs = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return { evalError: r.exceptionDetails.exception && r.exceptionDetails.exception.description };
    return r.result ? r.result.value : undefined;
  };
  if (EXPR) console.log("EVAL " + OUT + ": " + JSON.stringify(await evalJs(EXPR)));
  const overflow = await evalJs(`(() => { const vw = innerWidth; const bad = [];
    document.querySelectorAll('body *').forEach(el => { const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (b.width && (b.right > vw + 1 || b.left < -1) && cs.position !== 'fixed')
        bad.push(el.tagName + (el.id ? '#' + el.id : '') + ' right=' + Math.round(b.right)); });
    return { scrollW: document.documentElement.scrollWidth, vw, bad: bad.slice(0, 10) }; })()`);
  console.log("OVERFLOW " + OUT + ": " + JSON.stringify(overflow));
  const shot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(OUT + ".png", Buffer.from(shot.data, "base64"));
  console.log("ERRORS " + OUT + ": " + JSON.stringify(errors.slice(0, 15)));
  console.log("saved " + OUT + ".png");
  ws.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });