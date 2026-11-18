// Pull-to-refresh: drag down from the top of any scroll area to refresh. On a live KEBS session it
// re-pulls from KEBS (klRefresh); otherwise it just re-renders. Touch devices only (phones / the app).
(() => {
  const TH = 64; // px of pull needed to trigger
  let startY = 0, sc = null, dist = 0, active = false, busy = false;

  const ind = document.createElement("div");
  ind.className = "ptr";
  ind.innerHTML = '<span class="ptr-ring" aria-hidden="true"></span>';
  (document.getElementById("shell") || document.body).appendChild(ind);

  const atTop = (el) => el && el.scrollTop <= 0;

  function start(e) {
    if (busy) return;
    const t = e.target.closest && e.target.closest(".scroll, .home-scroll");
    if (!t || !atTop(t)) { sc = null; return; }
    sc = t; startY = e.touches[0].clientY; dist = 0; active = false;
  }
  function move(e) {
    if (!sc || busy) return;
    dist = e.touches[0].clientY - startY;
    if (dist > 0 && atTop(sc)) {
      active = true;
      const pull = Math.min(dist * 0.5, 96);
      ind.style.setProperty("--p", pull + "px");
      ind.classList.toggle("ready", pull >= TH * 0.75);
      ind.classList.add("show");
      if (dist > 8 && e.cancelable) e.preventDefault(); // stop the rubber-band while pulling
    }
  }
  async function end() {
    if (!sc || !active) { clear(); return; }
    const go = dist * 0.5 >= TH * 0.75;
    sc = null; active = false;
    if (!go) { clear(); return; }
    busy = true;
    ind.classList.add("run"); ind.classList.remove("ready");
    ind.style.setProperty("--p", "46px");
    try {
      if (typeof klOn === "function" && klOn() && typeof ACTIONS !== "undefined" && ACTIONS.klRefresh) ACTIONS.klRefresh();
      else if (typeof rerender === "function") rerender();
    } catch {}
    await new Promise((r) => setTimeout(r, 850));
    busy = false; clear();
  }
  function clear() {
    ind.classList.remove("show", "ready", "run");
    ind.style.setProperty("--p", "0px");
    sc = null; active = false; dist = 0;
  }

  document.addEventListener("touchstart", start, { passive: true });
  document.addEventListener("touchmove", move, { passive: false });
  document.addEventListener("touchend", end, { passive: true });
  document.addEventListener("touchcancel", clear, { passive: true });
})();
