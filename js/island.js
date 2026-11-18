// Dynamic-Island-style pill that EXPANDS on tap (mockup view):
//  • Clocked in  → green dot + live "Clocked in · H:MM:SS"; tap → card with clock-in time, elapsed, Clock out
//  • Clocked out → check + "Clocked out · Xh Ym"; tap → card with in/out times, total, Resume / View
// Plain JS, no deps.
(() => {
  const el = document.querySelector(".island");
  if (!el) return;
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ":" : "") + pad(m) + ":" + pad(x); };
  const fmtHm = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return (h ? h + "h " : "") + m + "m"; };
  const clock = (ts) => { const d = new Date(ts); let h = d.getHours(); const ap = h < 12 ? "AM" : "PM"; h = h % 12 || 12; return h + ":" + pad(d.getMinutes()) + " " + ap; };

  let mode = null, expanded = false;

  function rebuild(state, t) {
    const dot = state === "in" ? '<span class="isl-dot pulse"></span>' : '<span class="isl-dot done"></span>';
    const lbl = state === "in" ? "Clocked in" : "Clocked out";
    const right = state === "in"
      ? `<div><span class="isl-k">Elapsed</span><b class="isl-big">00:00</b></div>`
      : `<div><span class="isl-k">Clock out</span><b>${clock(t.outTs)}</b></div>`;
    const act = state === "in"
      ? `<button class="isl-btn primary" data-isl="out">Clock out</button>`
      : `<button class="isl-btn primary" data-isl="resume">Resume</button>`;
    el.className = "island live " + state + (expanded ? " expanded" : "");
    el.setAttribute("aria-hidden", "false");
    el.setAttribute("role", "button");
    el.innerHTML =
      `<div class="isl-pill">${dot}<span class="isl-lbl">${lbl}</span><span class="isl-time"></span></div>` +
      `<div class="isl-card">` +
        `<div class="isl-grid"><div><span class="isl-k">Clock in</span><b>${clock(t.inTs)}</b></div>${right}</div>` +
        `<div class="isl-acts"><button class="isl-btn" data-isl="view">View day</button>${act}</div>` +
      `</div>`;
    el.onclick = (e) => {
      const b = e.target.closest("[data-isl]");
      if (b) {
        e.stopPropagation();
        expanded = false; el.classList.remove("expanded");
        const a = b.dataset.isl;
        if (a === "view" && typeof go === "function") go("#/attendance");
        else if ((a === "out" || a === "resume") && typeof ACTIONS !== "undefined" && ACTIONS.clockToggle) ACTIONS.clockToggle();
        return;
      }
      expanded = !expanded; el.classList.toggle("expanded", expanded);
    };
  }

  function tick() {
    const t = (typeof S !== "undefined" && S.att && S.att.today) || null;
    const state = t && t.inTs ? (t.outTs ? "out" : "in") : null;
    if (state === null) {
      if (mode !== null) { mode = null; expanded = false; el.className = "island"; el.innerHTML = ""; el.onclick = null; el.setAttribute("aria-hidden", "true"); el.removeAttribute("role"); }
      return;
    }
    if (mode !== state) { mode = state; rebuild(state, t); }
    const worked = typeof workedSec === "function" ? workedSec() : 0;
    const time = el.querySelector(".isl-time"); if (time) time.textContent = state === "in" ? fmt(worked) : fmtHm(worked);
    const big = el.querySelector(".isl-big"); if (big && state === "in") big.textContent = fmt(worked);
  }

  tick();
  setInterval(tick, 1000);
  document.addEventListener("click", (e) => { if (expanded && !el.contains(e.target)) { expanded = false; el.classList.remove("expanded"); } });
})();
