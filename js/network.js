// Network states: offline, weak signal, back online. A slim bar under the status bar says what's happening;
// screens that need data use netOfflineState() when there's nothing saved to show.
// Try it: kebsNetSim("offline" | "weak" | null) from the console, or Settings → turn on airplane mode.

const NET = { state: "online" };
function netNow() {
  if (window.__netSim) return window.__netSim;
  if (!navigator.onLine) return "offline";
  const c = navigator.connection;
  if (c && (/(^|-)2g$/.test(c.effectiveType || "") || (c.rtt && c.rtt >= 2000))) return "weak";
  return "online";
}
function netUpdate() {
  const s = netNow(); if (s === NET.state) return;
  const prev = NET.state; NET.state = s;
  netBar(s, prev);
  // screens that care redraw (reports, Kais)
  if (/^#\/(reports|kais)/.test(location.hash)) rerender();
  window.dispatchEvent(new Event("kebsnet"));
}
function netBar(s, prev) {
  let el = $("#netbar");
  if (!el) { el = document.createElement("div"); el.id = "netbar"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite"); $("#shell").append(el); }
  clearTimeout(netBar.t);
  const map = {
    offline: ["off", "wifiOff", "You’re offline", "Showing saved data"],
    weak: ["weak", "signal", "Weak connection", "Things may load slowly"],
    online: ["on", "wifi", "Back online", ""],
  };
  if (s === "online" && prev === "online") return;
  const [cls, ic, t, sub] = map[s];
  el.className = `nb-net ${cls} in`;
  el.innerHTML = `${I(ic)}<b>${t}</b>${sub ? `<span>${sub}</span>` : ""}${s === "offline" ? `<button data-act="netRetry">Retry</button>` : ""}`;
  if (s !== "offline") netBar.t = setTimeout(() => { el.classList.remove("in"); el.classList.add("out"); }, s === "weak" ? 4500 : 2200);
}
act("netRetry", () => { const was = NET.state; NET.state = "?"; netUpdate(); if (NET.state === "offline") toast("Still offline — check Wi-Fi or mobile data", "bad"); else if (was !== NET.state) rerender(); });
function netOfflineState(title = "You’re offline", text = "Check your Wi-Fi or mobile data, then try again.") {
  return emptyState(["wifi"], title, text, `<button class="btn primary" data-act="netRetry">${I("refresh")}Try again</button>`);
}
window.kebsNetSim = (s) => { window.__netSim = s || null; netUpdate(); };
addEventListener("online", netUpdate);
addEventListener("offline", netUpdate);
navigator.connection?.addEventListener?.("change", netUpdate);
setTimeout(netUpdate, 800);
