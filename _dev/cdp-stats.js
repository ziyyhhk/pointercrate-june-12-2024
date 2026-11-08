// Verify statsviewer player detail with recovered data (Trick + Zoink).
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
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: "http://localhost:8642/" });
  await new Promise((r) => setTimeout(r, 4500));
  const evalJs = async (expr) => {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return { evalError: (r.exceptionDetails.exception || {}).description };
    return r.result ? r.result.value : undefined;
  };
  const readFields = `(() => { const t = (id) => { const e = document.getElementById(id); return e ? e.textContent.trim().replace(/\\s+/g, " ").slice(0, 220) : null; };
    return { name: t("player-name"), rank: t("rank"), score: t("score"), created: t("created"),
      published: t("published"), verified: t("verified"), hardest: t("hardest"),
      beaten: t("beaten"), amount: t("stats"), progress: t("progress"),
      notice: (document.getElementById("mirror-notice") || {}).textContent }; })()`;
  await evalJs(`document.querySelector('#stats-viewer-pagination .selection-list li').click()`);
  await new Promise((r) => setTimeout(r, 900));
  console.log("TRICK: " + JSON.stringify(await evalJs(readFields)));
  const shot1 = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync("_dev/shot-stats-trick.png", Buffer.from(shot1.data, "base64"));
  const zoink = await evalJs(`(() => { const li = document.querySelector('#stats-viewer-pagination .selection-list li[data-id="53408"]'); if (li) { li.click(); return true; } return false; })()`);
  await new Promise((r) => setTimeout(r, 900));
  console.log("ZOINK clicked: " + zoink + " " + JSON.stringify(await evalJs(readFields)));
  const shot2 = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync("_dev/shot-stats-zoink.png", Buffer.from(shot2.data, "base64"));
  console.log("ERRORS: " + JSON.stringify(errors.slice(0, 10)));
  ws.close(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });