// Router, dock, global event delegation, live timers, theme, app lock
let navCount = 0;
let FORM_CHECK = null;
let unlocked = false;

function go(h) { DRAFT = null; if (location.hash === h) { closeAllSheets(); return rerender(); } navCount++; location.hash = h; }
function swap(h) { DRAFT = null; location.replace(h); }
act("back", () => { DRAFT = null; if (navCount > 0) { navCount--; history.back(); } else swap("#/home"); });

function parseHash() {
  const h = location.hash.replace(/^#\/?/, "");
  const [path, qs] = h.split("?");
  return { path: path || "", q: Object.fromEntries(new URLSearchParams(qs || "")) };
}
function applyTheme() {
  const t = S.settings.theme, root = document.documentElement;
  if (t === "auto") delete root.dataset.theme; else root.dataset.theme = t;
}
function dockHtml(on) {
  const b = (id, icon, href, label, badge) => `<button class="dock-btn ${on === id ? "on" : ""}" data-go="${href}" aria-label="${label}">${I(icon)}<span>${label}</span>${badge ? `<span class="badge">${badge}</span>` : ""}</button>`;
  return b("home", "home", "#/home", T("home")) + b("inbox", "inbox", "#/inbox", T("inbox"), S.inbox.length)
    + `<button class="dock-kais" data-act="kais" aria-label="Ask Kais AI"><img src="kais.svg" alt=""></button>`
    + b("notifs", "bell", "#/notifs", T("alerts"), unreadCount()) + b("apps", "grid", "#/apps", T("apps"));
}
function lockView() {
  return `<div class="screen"><div class="scroll" style="display:flex;flex-direction:column;justify-content:center;text-align:center">
    <div class="lock-art on" data-lock>${I("fingerprint")}</div><h2 style="font:800 24px var(--font);letter-spacing:-.8px">KEBS is locked</h2>
    <p class="muted" style="margin:6px 0 22px">Use your device authentication to continue.</p>
    <button class="btn primary" style="align-self:center" data-act="unlock">${I("unlock")}Unlock</button></div></div>`;
}
act("unlock", () => { $("[data-lock]")?.classList.add("scanning"); setTimeout(() => { unlocked = true; render(false); }, 700); });

function render(keep) {
  ensureToday(); applyTheme();
  const { path, q } = parseHash();
  const view = $("#view"), dock = $("#dock");
  if (!S.authed && path !== "login") return location.replace("#/login");
  if (S.authed && path === "login") return location.replace("#/home");
  FORM_CHECK = null;
  if (S.authed && S.settings.secure && !unlocked) { view.className = "view"; view.innerHTML = lockView(); dock.hidden = true; return; }
  let r = null, m = null;
  for (const x of ROUTES) { m = path.match(x.re); if (m) { r = x; break; } }
  if (!r) return location.replace("#/home");
  const st = keep ? $(".scroll", view)?.scrollTop : 0;
  view.className = "view" + (r.dock ? " has-dock" : "");
  view.innerHTML = r.render(m.groups || {}, q);
  const screen = view.firstElementChild;
  if (screen && !keep) screen.classList.add("screen-in");
  dock.hidden = !r.dock; if (r.dock) dock.innerHTML = dockHtml(r.dock);
  $("#shell").classList.toggle("on-hero", path === "home");
  if (keep && st) { const sc = $(".scroll", view); if (sc) sc.scrollTop = st; }
  r.mount?.(m.groups || {}, q);
  tick();
}
const rerender = () => render(true);

function tick() {
  const sec = workedSec();
  $$("[data-live=worked]").forEach((el) => (el.textContent = fmtClock(sec)));
  $$("[data-live=dur]").forEach((el) => (el.textContent = fmtMin(sec / 60)));
  $$("[data-live-bar]").forEach((el) => (el.style.width = Math.min(100, (sec / 3600 / 9) * 100) + "%"));
  $$("[data-live=now]").forEach((el) => (el.textContent = new Date().toLocaleTimeString("en-US")));
  $$("[data-live=sb]").forEach((el) => (el.textContent = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M/, "")));
  if (S.ts.running) $$("[data-live=run]").forEach((el) => { const e = Object.values(S.ts.entries).flat().find((x) => x.id === S.ts.running.id); if (e) el.textContent = fmtH(liveMins(e)); });
}
setInterval(tick, 1000);

document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-go]");
  if (g && !g.disabled) { e.preventDefault(); closeDrawer(); go(g.dataset.go); return; }
  const a = e.target.closest("[data-act]");
  if (a && !a.disabled && ACTIONS[a.dataset.act]) { e.preventDefault(); ACTIONS[a.dataset.act](a, e); }
});
document.addEventListener("submit", (e) => {
  const f = e.target.dataset.form;
  if (f && ACTIONS["submit:" + f]) { e.preventDefault(); ACTIONS["submit:" + f](e.target); }
});
document.addEventListener("input", (e) => {
  const k = e.target.dataset?.bind;
  if (k && DRAFT) { DRAFT[k] = e.target.value; FORM_CHECK?.(); }
});
window.addEventListener("hashchange", () => { closeAllSheets(); closeDrawer(); render(false); });

// iPhone mockup: keep the device at true size and scale it to fit the window
function fitDevice() {
  const s = innerWidth >= 620 ? Math.min(1, (innerHeight - 32) / 884, (innerWidth - 32) / 425) : 1;
  document.documentElement.style.setProperty("--s", s.toFixed(4));
}
addEventListener("resize", fitDevice); fitDevice();

if (!location.hash) location.replace(S.authed ? "#/home" : "#/login");
render(false);
