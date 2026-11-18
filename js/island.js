// Dynamic-Island-style live pill: when you're clocked in, the iPhone island (mockup view) expands
// into a running "Clocked in · H:MM:SS" timer you can tap to open Attendance. Plain JS, no deps.
(() => {
  const el = document.querySelector(".island");
  if (!el) return;
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (sec) => { const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return (h ? h + ":" : "") + pad(m) + ":" + pad(s); };

  function tick() {
    const live = typeof clockedIn === "function" && clockedIn();
    if (live) {
      if (!el.classList.contains("live")) {
        el.classList.add("live");
        el.innerHTML = '<span class="isl-dot" aria-hidden="true"></span><span class="isl-lbl">Clocked in</span><span class="isl-time" aria-live="off"></span>';
        el.onclick = () => { if (typeof go === "function") go("#/attendance"); };
        el.setAttribute("aria-hidden", "false");
        el.setAttribute("role", "button");
      }
      const t = el.querySelector(".isl-time");
      if (t) t.textContent = fmt(typeof workedSec === "function" ? workedSec() : 0);
    } else if (el.classList.contains("live")) {
      el.classList.remove("live");
      el.innerHTML = "";
      el.onclick = null;
      el.setAttribute("aria-hidden", "true");
      el.removeAttribute("role");
    }
  }

  tick();
  setInterval(tick, 1000);
})();
