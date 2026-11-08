// Which document is asking for the wrong URLs? Prints initiator info for 404s.
const BASE = process.argv[2] || "http://localhost:8799/pointercrate-june-12-2024/";
const TARGET = process.argv[3] || (BASE + "demonlist/");
const http = require("http");
function getJson(p) {
  return new Promise((res, rej) => http.get({ host: "localhost", port: 9222, path: p }, (r) => {
    let b = ""; r.on("data", (c) => b += c); r.on("end", () => res(JSON.parse(b)));
  }).on("error", rej));
}
(async () => {
  const page = (await getJson("/json/list")).find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0; const pending = new Map(); const reqs = new Map(); const frames = new Map();
  const send = (m, p = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); return; }
    if (m.method === "Network.requestWillBeSent") reqs.set(m.params.requestId, m.params);
    if (m.method === "Page.frameNavigated" && !m.params.frame.parentId) frames.set(m.params.frame.id, m.params.frame.url);
    if (m.method === "Network.responseReceived") {
      const r = m.params.response;
      if (r.status >= 400) {
        const s = reqs.get(m.params.requestId) || {};
        const ini = s.initiator || {};
        console.log("404 " + r.url);
        console.log("   frame: " + (frames.get(s.frameId) || s.frameId) + "  type: " + s.type);
        console.log("   initiator: " + (ini.url || ini.type) + (ini.lineNumber != null ? ":" + (ini.lineNumber + 1) : ""));
        if (ini.stack && ini.stack.callFrames && ini.stack.callFrames[0]) {
          const f = ini.stack.callFrames[0];
          console.log("   stack: " + f.functionName + " @ " + f.url + ":" + (f.lineNumber + 1));
        }
      }
    }
  };
  await new Promise((r) => { ws.onopen = r; });
  await send("Page.enable"); await send("Network.enable");
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: TARGET });
  await new Promise((r) => setTimeout(r, 6000));
  const evalJs = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
    return r.result ? r.result.value : (r.exceptionDetails || {}).exception;
  };
  console.log("docURL=" + await evalJs("document.documentURI") + " base=" + await evalJs("document.baseURI"));
  ws.close(); process.exit(0);
})();
