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

// first visit to a screen in this session shows a skeleton while it "loads"
const SEEN = new Set();
function skelKind(path) {
  if (/^(login|kais|search|clockin|feedback|settings|req\/|leave\/apply|compoff\/request|expenses\/new|profile\/edit)/.test(path)) return null;
  if (path === "home") return "home";
  if (/^(apps|leave\/balances|expenses)/.test(path)) return "grid";
  if (/^(post|request|people|profile|attendance)/.test(path)) return "detail";
  return "list";
}
function skeleton(kind) {
  const line = (w, h = 12) => `<i class="sk" style="width:${w};height:${h}px"></i>`;
  const row = () => `<div class="sk-card"><i class="sk sk-av"></i><div class="grow stack s6">${line("62%", 13)}${line("38%", 10)}</div>${line("44px", 20)}</div>`;
  const tile = () => `<div class="sk-tile"><i class="sk sk-ic"></i>${line("70%", 13)}${line("90%", 10)}${line("55%", 10)}</div>`;
  let body;
  if (kind === "home") body = `<div class="sk-hero"></div><div class="scroll" style="padding-top:18px"><div class="sk-card col"><div class="sk-qa">${'<span><i class="sk sk-ic"></i><i class="sk" style="width:44px;height:9px"></i></span>'.repeat(8)}</div></div><div class="sk-card col" style="height:230px">${line("40%", 13)}${line("70%", 18)}${line("100%", 40)}${line("100%", 8)}</div></div>`;
  else if (kind === "grid") body = `<div class="scroll" style="padding-top:8px">${line("46%", 26)}<div style="height:10px"></div>${line("100%", 40)}<div class="sk-grid">${tile().repeat(4)}</div>${line("30%", 16)}<div class="sk-grid">${tile().repeat(2)}</div></div>`;
  else if (kind === "detail") body = `<div class="scroll" style="padding-top:8px"><div class="sk-card col" style="align-items:center"><i class="sk sk-av lg"></i>${line("50%", 18)}${line("34%", 11)}</div>${line("100%", 54)}<div class="stack" style="margin-top:12px">${row().repeat(3)}</div></div>`;
  else body = `<div class="scroll" style="padding-top:8px">${line("100%", 40)}<div class="stack" style="margin-top:12px">${row().repeat(6)}</div></div>`;
  const top = kind === "home" ? "" : `<header class="top"><div class="pill"><i class="sk sk-circle"></i><div class="ttl"><i class="sk" style="width:120px;height:14px;display:inline-block"></i></div><i class="sk sk-circle"></i></div></header>`;
  return `<div class="screen sk-screen" aria-busy="true" aria-label="Loading">${top}${body}</div>`;
}
function loadbar(on) { const b = $("#loadbar"); if (b) { b.classList.toggle("on", on); if (!on) { b.classList.add("done"); setTimeout(() => b.classList.remove("done"), 400); } } }
const LZ = {}; // revealed counts per screen for lazy lists
function lazyMount(path, keep) {
  if (!keep) for (const k in LZ) if (k.startsWith(path + "#")) delete LZ[k];
  $$("[data-lazy]").forEach((box, bi) => {
    const size = Number(box.dataset.lazy) || 8, key = path + "#" + bi;
    const kids = [...box.children].filter((c) => !c.classList.contains("lazy-more"));
    let n = Math.max(size, LZ[key] || 0);
    if (kids.length <= n) return;
    kids.forEach((c, i) => c.classList.toggle("lz-hide", i >= n));
    const more = document.createElement("div");
    more.className = "lazy-more"; more.innerHTML = `<span class="spinner"></span><span>Loading more…</span>`;
    box.append(more);
    const io = new IntersectionObserver((ents) => {
      if (!ents.some((e) => e.isIntersecting) || more.dataset.busy) return;
      more.dataset.busy = "1";
      setTimeout(() => {
        n += size; LZ[key] = n;
        kids.forEach((c, i) => { if (i < n && c.classList.contains("lz-hide")) { c.classList.remove("lz-hide"); c.classList.add("lz-in"); } });
        delete more.dataset.busy;
        if (n >= kids.length) { io.disconnect(); more.remove(); }
      }, 550);
    }, { root: box.closest(".scroll") || null, rootMargin: "60px" });
    io.observe(more);
  });
  $$("img:not([loading])").forEach((img) => img.setAttribute("loading", "lazy"));
}
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
  const kind = !keep && !SEEN.has(path) ? skelKind(path) : null;
  if (kind) {
    SEEN.add(path);
    view.className = "view" + (r.dock ? " has-dock" : "");
    view.innerHTML = skeleton(kind);
    dock.hidden = !r.dock; if (r.dock) dock.innerHTML = dockHtml(r.dock);
    $("#shell").classList.toggle("on-hero", path === "home");
    loadbar(true);
    const token = location.hash;
    setTimeout(() => { loadbar(false); if (location.hash === token) render(false); }, 520);
    return;
  }
  SEEN.add(path);
  const st = keep ? $(".scroll", view)?.scrollTop : 0;
  view.className = "view" + (r.dock ? " has-dock" : "");
  view.innerHTML = r.render(m.groups || {}, q);
  const screen = view.firstElementChild;
  if (screen && !keep) screen.classList.add("screen-in");
  dock.hidden = !r.dock; if (r.dock) dock.innerHTML = dockHtml(r.dock);
  $("#shell").classList.toggle("on-hero", path === "home");
  if (keep && st) { const sc = $(".scroll", view); if (sc) sc.scrollTop = st; }
  r.mount?.(m.groups || {}, q);
  lazyMount(path, keep);
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
