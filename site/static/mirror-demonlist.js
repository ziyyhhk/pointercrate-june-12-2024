// Local-mirror enhancement for the archived June 2024 demonlist page.
// The snapshot was captured without query parameters, so the server-side
// visibility toggle for the time-machine panel was lost. Restore it
// client-side and mark honestly what a read-only mirror cannot do.
const q = new URLSearchParams(location.search);

if (q.get("timemachine") === "true") {
  const el = document.getElementById("time-machine");
  if (el) el.style.display = "";
}

const tm = document.getElementById("time-machine");
if (tm && !tm.querySelector(".mirror-panel-note")) {
  const n = document.createElement("p");
  n.className = "mirror-panel-note";
  n.innerHTML =
    "This mirror is frozen at the June 12, 2024 snapshot. Time travel needs the live " +
    "pointercrate database and is unavailable here.";
  const heading = tm.querySelector(".underlined");
  if (heading) heading.after(n);
}