// Login · Home · Search · Clock-in · Announcements · Side pane · Quick actions

// ── Login ──
route("login", () => `
  <div class="screen"><div class="login">
    <div class="login-hero"><span class="login-mark" aria-hidden="true">${KEBS_MARK}</span><img class="login-ill ill-l" src="assets/ob/signin.svg" alt="A person standing next to a phone showing a sign-in screen" draggable="false"><img class="login-ill ill-d" src="assets/ob/dark/signin.svg" alt="" aria-hidden="true" draggable="false"></div>
    <h1>Welcome to KEBS!</h1>
    <p class="sub">Manage tasks, delegate jobs, business clutter-free!</p>
    <div class="stack">
      <button class="btn outline block" data-act="sso"><span class="ms"><i></i><i></i><i></i><i></i></span>Sign in with Office 365</button>
      <div class="or">Or, sign in with your email ID</div>
      <form class="stack" data-form="login" novalidate>
        <input class="inp" type="email" name="email" placeholder="name@example.com" autocomplete="email" value="${esc(S.email)}" aria-label="Work email">
        <span class="err" data-err hidden>Enter a valid work email address.</span>
        <button class="btn primary block" type="submit">Sign in</button>
      </form>
    </div>
    <button class="link" style="align-self:center;margin-top:18px" data-act="replayIntro">${I("sparkles")} See what KEBS can do</button>
    <p class="tiny faint" style="text-align:center;margin-top:auto;padding-top:18px">Demo workspace · your data stays on this device</p>
  </div></div>`);

function signIn(email) {
  S.authed = true; S.email = email; save();
  navCount = 0; location.replace("#/home");
  toast(`Signed in as ${email}`);
}
act("submit:login", (f) => {
  const v = f.email.value.trim();
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  f.querySelector("[data-err]").hidden = ok;
  if (ok) signIn(v);
});
act("sso", () => {
  const s = openSheet({ title: "Office 365", body: `<div class="empty" style="padding:20px"><div class="empty-art"><span class="ms" style="width:44px;height:44px;gap:4px"><i></i><i></i><i></i><i></i></span></div><h3>Signing you in…</h3><p>Connecting to your Microsoft work account.</p></div>` });
  setTimeout(() => { closeSheet(s); signIn("lena.aravind@prima.com"); }, 1100);
});

// ── Home ──
function greetingKey() { const h = new Date().getHours(); return h >= 5 && h < 12 ? "morning" : h >= 12 && h < 17 ? "afternoon" : h >= 17 && h < 21 ? "evening" : "night"; }
// keep the greeting in step with the clock while the app is open
setInterval(() => {
  const g = document.querySelector("[data-greet]"), k = greetingKey();
  if (g && g.dataset.greet !== k) { g.dataset.greet = k; g.textContent = T(k); }
}, 30000);
const QA_EMOJI = { scan: "🧾", leave: "📅", wfh: "🏠", clock: "⏰", insights: "💡", bills: "💰", track: "👛", timesheet: "📋", holidays: "🏖️", compoff: "☕", logs: "🕒", partial: "⏳", onduty: "💼", balances: "📊", helpdesk: "🎫" };
function quickTile(a) {
  const label = a.id === "clock" ? (clockedIn() ? "Clock out" : "Clock in") : a.label;
  const attr = a.act ? `data-act="${a.act}"` : `data-go="${a.go}"`;
  // 3D renders: Microsoft Fluent Emoji 3D (MIT), stored in assets/3d
  return `<button class="qa-btn" ${attr}><span class="ico">${msIcon(a.id)}</span>${esc(label)}</button>`;
}
function shiftCard() {
  const t = S.att.today;
  const head = `<div class="hrow"><span class="eyebrow grow">Shift today · ${SHIFT.name} (${D.hm(SHIFT.start)} – ${D.hm(SHIFT.end)})</span></div>
    <button class="hrow" data-go="#/attendance" style="width:100%;text-align:left"><span class="ic tint t-blue">${I("calendar")}</span><span class="grow"><b style="display:block">${D.nice(D.today())}</b><span class="small muted">${t.inTs ? `Clocked in at ${D.time(t.inTs)}${t.outTs ? ` · out ${D.time(t.outTs)}` : ""}` : "Not clocked in yet"}</span></span><span class="chev">${I("chevR")}</span></button>`;
  let body;
  if (!t.inTs) body = `<button class="btn primary block" data-act="clockToggle">${I("fingerprint")}Clock in</button>`;
  else if (!t.outTs) body = `<div class="hrow"><button class="btn danger fill" style="flex:1" data-act="clockToggle">Clock out</button><div class="right" style="min-width:130px"><div class="timer" data-live="worked">${fmtClock(workedSec())}</div><div class="tiny muted">${I("checkCircle", "")} on the clock</div></div></div>`;
  else body = `<div class="banner ok">${I("checkCircle")}<span class="grow">Shift complete · ${fmtMin(workedSec() / 60)} worked</span><button class="link" data-act="resumeShift">Resume</button></div>`;
  return `<div class="card stack">${head}${body}</div>`;
}
function weekCard() {
  const today = D.today(), mon = D.monday(today);
  const days = ["M", "T", "W", "T", "F", "S", "S"].map((l, i) => {
    const d = D.add(mon, i);
    const cls = d === today ? "today" : S.att.logs[d]?.in ? "done" : i >= 5 ? "off" : "";
    return `<span class="wd ${cls}" title="${D.nice(d)}">${l}</span>`;
  }).join("");
  const sec = workedSec(), pct = Math.min(100, (sec / 3600 / 9) * 100);
  return `<div class="card stack">
    <div class="hrow"><div class="week grow">${days}</div></div>
    <b>Today (${D.hm(SHIFT.start)} – ${D.hm(SHIFT.end)})</b>
    <div class="bar"><i data-live-bar style="width:${pct}%"></i></div>
    <div class="hrow small muted"><span class="grow">Duration: <b data-live="dur">${fmtMin(sec / 60)}</b></span><span>Break: 0 min</span></div>
  </div>`;
}
// One card for today's attendance: status, shift, week strip, times, progress and the clock action
function todayCard(t, late) {
  const today = D.today(), mon = D.monday(today);
  const days = ["M", "T", "W", "T", "F", "S", "S"].map((l, i) => {
    const d = D.add(mon, i);
    const cls = d === today ? "today" : S.att.logs[d]?.in ? "done" : i >= 5 ? "off" : "";
    return `<span class="wd ${cls}" title="${D.nice(d)}">${l}</span>`;
  }).join("");
  const sec = workedSec(), pct = Math.min(100, (sec / 3600 / 9) * 100);
  const chip = !t.inTs ? `<span class="chip">Not in yet</span>` : late ? `<span class="chip warn">${I("clock")}Late</span>` : `<span class="chip ok">${I("checkCircle")}On time</span>`;
  let action;
  if (!t.inTs) action = `<button class="btn primary block" data-act="clockToggle">${I("fingerprint")}Clock in</button>`;
  else if (!t.outTs) action = `<button class="btn danger fill block" data-act="clockToggle">${I("fingerprint")}Clock out</button>`;
  else action = `<div class="banner ok">${I("checkCircle")}<span class="grow">Shift complete</span><button class="link" data-act="resumeShift">Resume</button></div>`;
  return `<div class="card stack today-card">
    <button class="hrow" data-go="#/attendance" style="width:100%;text-align:left"><span class="grow"><span class="eyebrow" style="display:block">Today</span><b style="font-size:17px">${D.nice(today)}</b><span class="small muted" style="display:block">${SHIFT.name} shift · ${D.hm(SHIFT.start)} – ${D.hm(SHIFT.end)}</span></span>${chip}<span class="chev">${I("chevR")}</span></button>
    <div class="hrow"><div class="week grow">${days}</div></div>
    <div class="tc-times"><div><span class="tiny muted">Clock in</span><b>${t.inTs ? D.time(t.inTs) : "--:--"}</b></div><div><span class="tiny muted">Clock out</span><b>${t.outTs ? D.time(t.outTs) : "--:--"}</b></div><div><span class="tiny muted">Worked</span><b class="num" ${t.inTs && !t.outTs ? `data-live="worked"` : ""}>${t.inTs && !t.outTs ? fmtClock(sec) : fmtMin(sec / 60)}</b></div></div>
    <div class="bar"><i data-live-bar style="width:${pct}%"></i></div>
    <div class="hrow tiny muted"><span class="grow">Duration: <b data-live="dur">${fmtMin(sec / 60)}</b> of 9h</span><span>Break: 0 min</span></div>
    ${action}
  </div>`;
}
route("home", () => {
  const hol = nextHoliday();
  const quick = S.quick.map((id) => QUICK_ACTIONS.find((a) => a.id === id)).filter(Boolean);
  const off = S.offThisWeek.week === D.monday(D.today()) ? S.offThisWeek.list : [];
  const ini = esc(initials(fullName()));
  const t = S.att.today, late = t.inTs ? toMin(hhmm(t.inTs)) - toMin(SHIFT.start) > 10 : false;
  return `<div class="screen">
    <header class="hero" data-hero>
      <span class="hero-pattern" aria-hidden="true"></span>
      <span class="hero-mark">${KEBS_MARK}</span>
      <div class="hero-greet"><button class="hero-av" data-act="drawer" aria-label="Open menu"><img class="hero-photo" src="assets/avatars/me.jpg?v=3" alt=""><span class="hero-menu" aria-hidden="true">${I("menu")}</span></button><div class="grow" style="min-width:0"><b class="ell"><span data-greet="${greetingKey()}">${T(greetingKey())}</span>, ${esc(S.me.display)}</b><small>${esc(S.me.role)}</small></div></div>
      <form class="hero-row" data-form="heroAsk"><button type="button" class="hero-av" data-act="drawer" aria-label="Open menu" tabindex="-1"><img class="hero-photo" src="assets/avatars/me.jpg?v=3" alt=""><span class="hero-menu" aria-hidden="true">${I("menu")}</span></button>
        <label class="hero-ask">${I("sparkles")}<input name="q" placeholder="Ask Kais" autocomplete="off" aria-label="Ask Kais" enterkeyhint="send"><button type="button" class="go mic" data-act="heroVoice" aria-label="Talk to Kais">${I("mic")}</button><button type="button" class="go" data-act="heroGo" aria-label="Search">${I("search")}</button></label></form>
    </header>
    <div class="scroll home-scroll">
      <section class="qa-card"><div class="qa-head"><h2>${T("quick")}</h2></div>
      <div class="qa">${quick.map(quickTile).join("")}<button class="qa-btn" data-act="editQuick"><span class="ico more">${msIcon("more")}</span>More actions</button></div></section>
      <div style="height:20px"></div>
      <div class="stack">
        ${todayCard(t, late)}</div>
      ${typeof homeWidgets === "function" ? homeWidgets() : ""}
      ${off.length ? `<div class="sec"><h2>Off this week</h2><button class="link" data-act="offWeek">See all</button></div>
        <div class="hscroll">${off.map((o) => `<button class="person-mini" data-go="#/people/${o.id}">${avatar(o.id, "lg")}<span class="ell" style="max-width:68px">${esc(person(o.id).name.split(" ")[0])}</span><small>${D.short(o.date)}</small></button>`).join("")}</div>` : ""}
      ${typeof celebWidget === "function" ? celebWidget() : ""}
      <div class="sec"><h2>Announcements</h2><button class="link" data-go="#/announcements">View all</button></div>
      <div class="hscroll">${S.posts.map((p) => `<button class="card ann" data-go="#/post/${p.id}"><div class="hrow">${avatar(p.by, "sm")}<span class="small muted grow ell">${esc(person(p.by).name)} · ${D.ago(p.ts)}</span></div><b class="ell">${esc(p.title)}</b><span class="small muted" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(p.body)}</span>${p.ack ? `<span class="chip ok" style="align-self:flex-start">${I("check")}Acknowledged</span>` : `<span class="chip acc" style="align-self:flex-start">New</span>`}</button>`).join("")}</div>
      ${hol ? `<div class="sec"><h2>Upcoming holiday</h2><button class="link" data-go="#/holidays">All holidays</button></div>
        <button class="card hrow" data-go="#/holidays"><span class="daycell"><small>${D.f(hol.date, { month: "short" }).toUpperCase()}</small><b>${D.parse(hol.date).getDate()}</b></span><span class="grow"><b style="display:block">${esc(hol.name)}</b><span class="small muted">${D.dayName(hol.date)} · in ${plural(D.diff(D.today(), hol.date), "day")}</span></span>${hol.floater ? `<span class="chip vio">Floater</span>` : ""}</button>` : ""}
    </div></div>`;
}, {
  dock: "home",
  mount() {
    const hero = $("[data-hero]"), sc = $(".home-scroll"), inp = hero.querySelector("input"), go = hero.querySelector(".go");
    // collapse the greeting into a compact avatar + Ask Kais bar once content scrolls (with hysteresis)
    if (sc.scrollTop > 40) hero.classList.add("collapsed");
    sc.addEventListener("scroll", () => { const y = sc.scrollTop; if (y > 40) hero.classList.add("collapsed"); else if (y < 8) hero.classList.remove("collapsed"); }, { passive: true });
    // the trailing button turns into "send" while typing, as in the Figma variants
    inp.addEventListener("input", () => { const on = !!inp.value.trim(); go.classList.toggle("send", on); go.innerHTML = I(on ? "arrowUp" : "search"); go.setAttribute("aria-label", on ? "Ask Kais" : "Search"); });
  },
});
act("submit:heroAsk", (f) => { const q = f.q.value.trim(); if (q) openKais(q); else go("#/search"); });
// voice: open Kais and go straight into voice mode
act("heroVoice", () => { kaisNewChat(); save(); openKais(); setTimeout(() => ACTIONS.kaisVoice(), 380); });
act("heroGo", (b) => { const q = b.closest("form").q.value.trim(); q ? openKais(q) : go("#/search"); });

act("clockToggle", () => {
  const t = S.att.today;
  if (!t.inTs) return go("#/clockin");
  if (t.outTs) return ACTIONS.resumeShift();
  confirmSheet({ eyebrow: "Clock out", text: `You’ve worked <b>${fmtMin(workedSec() / 60)}</b> today. Clock out now?`, ok: "Yes, clock out", danger: true,
    onOk() { t.outTs = Date.now(); save(); rerender(); toast(`Clocked out at ${D.time(t.outTs)}`); } });
});
act("resumeShift", () => { S.att.today.outTs = null; save(); rerender(); toast("Shift resumed"); });
act("themeQuick", () => {
  const dark = document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  S.settings.theme = dark ? "light" : "dark"; save(); rerender();
});
act("offWeek", () => openSheet({ title: "Off this week", body: `<div class="list">${S.offThisWeek.list.map((o) => `<button class="li" data-go="#/people/${o.id}">${avatar(o.id)}<span class="grow"><span class="t" style="display:block">${esc(person(o.id).name)}</span><span class="s">${D.nice(o.date)} · Casual leave</span></span><span class="chev">${I("chevR")}</span></button>`).join("")}</div>` }));

// ── Clock-in confirmation ──
route("clockin", () => `<div class="screen has-foot">
  ${topbar("Confirm clock in")}
  <div class="scroll">
    <div class="map" aria-label="Map showing your location and the office">
      <span class="road" style="left:38%;top:0;bottom:0;width:30px;transform:skewX(-6deg)"></span>
      <span class="road" style="left:0;right:0;top:28%;height:26px;transform:rotate(-4deg)"></span>
      <span class="road" style="left:0;right:0;top:78%;height:22px;transform:rotate(-3deg)"></span>
      <span class="road" style="left:70%;top:0;bottom:0;width:18px"></span>
      <span class="me"></span>
      <div class="map-live" data-map></div>
      <span class="prec">${I("pin")}<span data-dist>Precise location: ON</span></span>
      <div class="map-ctl"><button data-act="mapZoom" data-d="1" aria-label="Zoom in">${I("plus")}</button><button data-act="mapZoom" data-d="-1" aria-label="Zoom out">${I("minus")}</button></div>
      <button class="map-fit" data-act="mapFit" aria-label="Show me and the office">${I("locate")}</button>
    </div>
    <div class="card hrow" style="margin-top:12px"><span class="li" style="padding:0;border:0"><span class="ic tint t-blue">${I("pin")}</span></span><span class="grow"><b style="display:block">${OFFICE.name}</b><span class="small muted">${OFFICE.addr}</span></span><span class="chip ok">In range</span></div>
    <p class="small muted" style="margin:14px 4px 0">${SHIFT.name} shift · ${D.hm(SHIFT.start)} – ${D.hm(SHIFT.end)}. Your clock-in will be recorded with this location.</p>
  </div>
  <div class="foot"><div class="hrow"><div class="grow"><div class="timer" style="font-size:22px" data-live="now">${new Date().toLocaleTimeString("en-US")}</div><div class="small muted">${D.f(D.today(), { weekday: "long", day: "numeric", month: "short", year: "numeric" })}</div></div><button class="btn primary" data-act="confirmClockIn">Continue</button></div></div>
</div>`, { mount: clockMap });
// ── Clock-in map: MapLibre GL vector map (OpenFreeMap "Liberty" / "Dark"), Google/Apple Maps style, loaded on first use ──
let MAPLIBRE, CLOCK_MAP = null;
function loadMapLibre() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  return (MAPLIBRE ||= new Promise((ok, no) => {
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.css"; document.head.append(css);
    const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.min.js";
    s.onload = () => ok(window.maplibregl); s.onerror = () => { MAPLIBRE = null; no(new Error("map unavailable")); }; document.head.append(s);
  }));
}
const isDarkUI = () => document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
// a circle of `r` metres around [lng, lat] as a GeoJSON polygon (the clock-in geofence)
function geoCircle(lng, lat, r, n = 72) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; pts.push([lng + (r * Math.cos(a)) / (111320 * Math.cos((lat * Math.PI) / 180)), lat + (r * Math.sin(a)) / 110540]); }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [pts] } };
}
function metres(a, b) {
  const R = 6371000, t = (x) => (x * Math.PI) / 180, dLat = t(b[1] - a[1]), dLng = t(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(t(a[1])) * Math.cos(t(b[1])) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
function clockMap() {
  const el = $("[data-map]"); if (!el) return;
  loadMapLibre().then((ml) => {
    if (!el.isConnected) return;
    const office = [OFFICE.lng, OFFICE.lat], me = [OFFICE.lng + 0.00042, OFFICE.lat - 0.00038]; // demo: you, ~60 m from the office gate
    const map = new ml.Map({ container: el, style: `https://tiles.openfreemap.org/styles/${isDarkUI() ? "dark" : "liberty"}`, center: me, zoom: 16.4,
      attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false, fadeDuration: 150 });
    map.scrollZoom.disable(); map.touchZoomRotate.disableRotation(); map.keyboard.disable();
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#ff4013";
    // frame the whole clock-in zone (geofence), with you and the office inside it
    const dLat = (OFFICE.radius * 1.15) / 110540, dLng = (OFFICE.radius * 1.15) / (111320 * Math.cos((office[1] * Math.PI) / 180));
    const fit = (duration = 600) => map.fitBounds([[office[0] - dLng, office[1] - dLat], [office[0] + dLng, office[1] + dLat]], { padding: { top: 24, bottom: 40, left: 24, right: 24 }, duration });
    map.on("load", () => {
      map.addSource("fence", { type: "geojson", data: geoCircle(office[0], office[1], OFFICE.radius) });
      map.addLayer({ id: "fence-fill", type: "fill", source: "fence", paint: { "fill-color": accent, "fill-opacity": isDarkUI() ? 0.14 : 0.1 } });
      map.addLayer({ id: "fence-line", type: "line", source: "fence", paint: { "line-color": accent, "line-width": 1.6, "line-opacity": 0.75, "line-dasharray": [2, 1.6] } });
      map.resize(); fit(0);
      el.closest(".map").classList.add("live");
    });
    // office: teardrop pin with the KEBS mark · you: blue dot with an accuracy halo
    const pin = document.createElement("div"); pin.className = "map-pin"; pin.title = OFFICE.name; pin.innerHTML = `<span>${KEBS_MARK}</span>`;
    new ml.Marker({ element: pin, anchor: "bottom" }).setLngLat(office).addTo(map);
    const dot = document.createElement("div"); dot.className = "map-me"; dot.title = "You"; dot.innerHTML = "<b></b><i></i>";
    new ml.Marker({ element: dot }).setLngLat(me).addTo(map);
    const lbl = el.closest(".map").querySelector("[data-dist]"); if (lbl) lbl.textContent = `${metres(office, me)} m from ${OFFICE.name.split(" – ")[0]} · in range`;
    CLOCK_MAP = { map, fit };
  }).catch(() => {}); // offline: the drawn placeholder map stays
}
act("mapFit", () => CLOCK_MAP?.fit());
act("mapZoom", (b) => { const m = CLOCK_MAP?.map; if (m) m.easeTo({ zoom: m.getZoom() + Number(b.dataset.d), duration: 260 }); });
act("confirmClockIn", () => {
  S.att.today.inTs = Date.now(); S.att.today.outTs = null; save();
  toast(`Clocked in at ${D.time(S.att.today.inTs)}`);
  ACTIONS.back();
});

// ── Search from home ──
const SCREENS = [
  ["Timesheet", "#/ts", "clipboard"], ["Timesheet history", "#/ts/history", "history"], ["Attendance today", "#/attendance", "fingerprint"], ["Time logs", "#/logs", "history"],
  ["Request history", "#/requests", "list"], ["Work from home request", "#/req/wfh", "home"], ["Partial day request", "#/req/partial", "clock"], ["On duty request", "#/req/onduty", "briefcase"],
  ["Attendance regularization", "#/req/regularize", "calendar"], ["Apply leave", "#/leave/apply", "calendar"], ["Leave balances", "#/leave/balances", "list"], ["Comp off", "#/compoff", "coffee"],
  ["Holidays", "#/holidays", "calendar"], ["My profile", "#/profile", "user"], ["Edit profile", "#/profile/edit", "edit"], ["Notifications", "#/notifs", "bell"], ["Inbox approvals", "#/inbox", "inbox"],
  ["Announcements", "#/announcements", "megaphone"], ["Expenses", "#/expenses", "wallet"], ["New expense", "#/expenses/new", "receipt"], ["Language", "#/settings/lang", "globe"], ["Theme", "#/settings/theme", "palette"],
  ["Secure your app", "#/settings/secure", "lock"], ["Send feedback", "#/feedback", "msg"], ["Helpdesk", "#/apps?tab=helpdesk", "ticket"], ["Performance & goals", "#/apps?tab=performance", "target"],
];
route("search", () => `<div class="screen">
  <header class="top"><div class="pill"><button class="ib" data-act="back" aria-label="Back">${I("back")}</button>
    <label class="searchbox grow" style="background:none;padding:0">${I("sparkles")}<input data-search placeholder="Search or ask Kais…" autofocus enterkeyhint="search"></label>
    <button class="ib acc" data-act="searchAsk" aria-label="Ask Kais">${I("arrowUp")}</button></div></header>
  <div class="scroll" data-results></div></div>`, {
  mount() {
    const inp = $("[data-search]"), out = $("[data-results]");
    const draw = () => {
      const q = inp.value.trim().toLowerCase();
      if (!q) {
        out.innerHTML = `<div class="sec"><span class="eyebrow">Ask Kais</span></div><div class="choices">${["How many leaves do I have?", "Clock me in", "Hours logged this week", "When is the next holiday?", "Any pending approvals?"].map((s) => `<button class="choice" data-act="searchAsk" data-q="${esc(s)}">${I("sparkles")}&nbsp;${esc(s)}</button>`).join("")}</div>
          <div class="sec"><span class="eyebrow">Jump to</span></div><div class="list">${SCREENS.slice(0, 8).map(([l, g, ic]) => `<button class="li" data-go="${g}"><span class="ic tint t-slate">${I(ic)}</span><span class="t grow">${l}</span><span class="chev">${I("chevR")}</span></button>`).join("")}</div>`;
        return;
      }
      const acts = QUICK_ACTIONS.filter((a) => (a.label + " " + a.cat).toLowerCase().includes(q));
      const scr = SCREENS.filter(([l]) => l.toLowerCase().includes(q));
      const ppl = S.people.filter((p) => (p.name + " " + p.role + " " + p.dept).toLowerCase().includes(q));
      const hol = holidays().filter((h) => h.name.toLowerCase().includes(q));
      const block = (t, html) => (html ? `<div class="sec"><span class="eyebrow">${t}</span></div><div class="list">${html}</div>` : "");
      out.innerHTML = block("Actions", acts.map((a) => `<button class="li" ${a.act ? `data-act="${a.act}"` : `data-go="${a.go}"`}><span class="ic tint ${a.tint}">${I(a.icon)}</span><span class="grow"><span class="t" style="display:block">${esc(a.label)}</span><span class="s">${esc(a.cat)}</span></span><span class="chev">${I("chevR")}</span></button>`).join(""))
        + block("Screens", scr.map(([l, g, ic]) => `<button class="li" data-go="${g}"><span class="ic tint t-slate">${I(ic)}</span><span class="t grow">${l}</span><span class="chev">${I("chevR")}</span></button>`).join(""))
        + block("People", ppl.map((p) => `<button class="li" data-go="#/people/${p.id}">${avatar(p.id)}<span class="grow"><span class="t" style="display:block">${esc(p.name)}</span><span class="s">${esc(p.role)} · ${esc(p.dept)}</span></span></button>`).join(""))
        + block("Holidays", hol.map((h) => `<button class="li" data-go="#/holidays"><span class="ic tint t-orange">${I("calendar")}</span><span class="grow"><span class="t" style="display:block">${esc(h.name)}</span><span class="s">${D.nice(h.date)}</span></span></button>`).join(""))
        || `<div class="card accent" style="margin-top:16px"><div class="hrow"><span class="kais-mark">${I("sparkles")}</span><span class="grow"><b style="display:block">Ask Kais instead?</b><span class="small muted">No direct matches for “${esc(inp.value)}”.</span></span><button class="btn primary sm" data-act="searchAsk">Ask</button></div></div>`;
    };
    inp.addEventListener("input", draw);
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter" && inp.value.trim()) ACTIONS.searchAsk(); });
    draw();
  },
});
act("searchAsk", (b) => { const q = b?.dataset?.q || $("[data-search]")?.value.trim(); openKais(q || ""); });

// ── Announcements ──
route("announcements", () => `<div class="screen">${topbar("Announcements")}<div class="scroll"><div class="stack">${S.posts.map((p) => `
  <div class="card stack">
    <button class="hrow" data-go="#/post/${p.id}" style="width:100%;text-align:left">${avatar(p.by)}<span class="grow"><b style="display:block">${esc(person(p.by).name)} made an announcement</b><span class="small muted">${D.short(D.iso(p.ts))}</span></span><span class="chev faint">${I("arrowOut")}</span></button>
    <button data-go="#/post/${p.id}" style="text-align:left"><b style="display:block">${esc(p.title)}</b><span class="small muted" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(p.body)}</span></button>
    ${p.ack ? `<span class="chip ok" style="align-self:flex-start">${I("checkCircle")}Acknowledged on ${D.short(D.iso(p.ack))}</span>` : `<button class="btn ghost sm" style="align-self:flex-start" data-act="ackPost" data-id="${p.id}">${I("check")}Acknowledge</button>`}
  </div>`).join("")}</div></div></div>`);
act("ackPost", (b) => { const p = S.posts.find((x) => x.id === b.dataset.id); p.ack = Date.now(); save(); rerender(); toast("Acknowledged"); });

route("post/:id", ({ id }) => {
  const p = S.posts.find((x) => x.id === id);
  if (!p) return emptyState(["megaphone"], "Not found", "This post was removed.");
  pRx(p);
  return `<div class="screen has-foot">${topbar("Announcement", { right: `<button class="ib" data-act="sharePost" data-id="${p.id}" aria-label="Share">${I("share")}</button>` })}<div class="scroll">
    <div class="hrow" style="margin:6px 0 14px">${avatar(p.by)}<span class="grow"><b style="display:block">${esc(person(p.by).name)}</b><span class="small muted">${new Date(p.ts).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span></span></div>
    <h2 style="font:800 22px/1.2 var(--font);letter-spacing:-.6px;margin-bottom:8px">${esc(p.title)}</h2>
    <p style="white-space:pre-wrap;color:var(--ink-body)">${esc(p.body)}</p>
    ${reactBar(p)}
    <div class="divider"></div>
    <div class="sec" style="margin-top:8px"><h2>Comments ${p.comments.length}</h2></div>
    <form class="searchbox" data-form="comment" data-id="${p.id}" style="margin-bottom:14px"><input name="text" placeholder="Write your comment here…" aria-label="Comment"><button class="ib sm acc" type="submit" aria-label="Send">${I("send")}</button></form>
    <div class="stack">${p.comments.map((c, ci) => ({ c, ci })).reverse().map(({ c, ci }) => `<div class="comment">${avatar(c.who, "sm")}<div class="grow" style="min-width:0"><div class="bubble"><div class="hrow"><b class="grow">${esc(person(c.who).name)}</b><span class="tiny faint">${D.ago(c.ts)}</span></div>${esc(c.text)}</div>${commentRx(p, c, ci)}</div></div>`).join("") || emptyMini("msg", "No comments yet — start the conversation.")}</div>
  </div>
  <div class="foot">${p.ack ? `<div class="banner ok">${I("checkCircle")}Acknowledged on ${D.short(D.iso(p.ack))}</div>` : `<button class="btn primary block" data-act="ackPost" data-id="${p.id}">Acknowledge</button>`}</div></div>`;
});
// ── emoji reactions (posts + comments) ──
const RX = ["👍", "❤️", "🎉", "👏", "😂", "😮", "🔥"];
let RX_OPEN = null; // post id, or "postId:commentIndex", whose picker is open
function pRx(p) { // migrate the old single counter into per-emoji counts
  if (p.rx) return;
  const n = p.reactions || 0, a = Math.round(n * 0.55), b = Math.round(n * 0.25);
  p.rx = { "👍": a, "❤️": b, "🎉": Math.max(0, n - a - b) };
  if (p.reacted) p.my = "👍";
}
const rxTotal = (rx) => Object.values(rx || {}).reduce((s, v) => s + v, 0);
function rxPicker(key) {
  if (RX_OPEN !== key) return "";
  return `<div class="rx-pop" role="menu" aria-label="Pick a reaction">${RX.map((e, i) => `<button role="menuitem" data-act="rxPick" data-k="${key}" data-e="${e}" style="--i:${i}" aria-label="React ${e}">${emo(e, "rx-e")}</button>`).join("")}</div>`;
}
function reactBar(p) {
  const sorted = Object.entries(p.rx).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  return `<div class="hrow rx-row" style="position:relative">
    ${sorted.map(([e, n]) => `<button class="rx-chip ${p.my === e ? "on" : ""}" data-act="rxPick" data-k="${p.id}" data-e="${e}" aria-pressed="${p.my === e}" aria-label="${e} ${n}">${emo(e, "emo")}<b>${n}</b></button>`).join("")}
    <button class="rx-add lg" data-act="rxOpen" data-k="${p.id}" aria-label="Add reaction" aria-expanded="${RX_OPEN === p.id}">${I("plus")}${emo("🙂", "emo")}</button>
    ${rxPicker(p.id)}
  </div>`;
}
function commentRx(p, c, ci) {
  c.rx ||= {};
  const key = `${p.id}:${ci}`, list = Object.entries(c.rx).filter(([, n]) => n > 0);
  return `<div class="hrow c-rx" style="position:relative">${list.map(([e, n]) => `<button class="rx-chip sm ${c.my === e ? "on" : ""}" data-act="rxPick" data-k="${key}" data-e="${e}">${emo(e, "emo")}<b>${n}</b></button>`).join("")}<button class="rx-add" data-act="rxOpen" data-k="${key}" aria-label="Add reaction">${I("plus")}${emo("🙂", "emo")}</button>${rxPicker(key)}</div>`;
}
act("rxOpen", (b) => { RX_OPEN = RX_OPEN === b.dataset.k ? null : b.dataset.k; rerender(); });
act("rxPick", (b) => {
  const [pid, ci] = b.dataset.k.split(":"), p = S.posts.find((x) => x.id === pid); pRx(p);
  const t = ci === undefined ? p : p.comments[Number(ci)]; t.rx ||= {};
  const e = b.dataset.e;
  if (t.my) t.rx[t.my] = Math.max(0, (t.rx[t.my] || 0) - 1);
  if (t.my === e) t.my = null; else { t.my = e; t.rx[e] = (t.rx[e] || 0) + 1; }
  if (t === p) { p.reacted = !!p.my; p.reactions = rxTotal(p.rx); }
  RX_OPEN = null; save(); rerender();
});
act("reactPost", (b) => ACTIONS.rxOpen({ dataset: { k: b.dataset.id } }));
act("sharePost", (b) => {
  const p = S.posts.find((x) => x.id === b.dataset.id), text = p.title + "\n\n" + p.body;
  if (navigator.share) navigator.share({ title: p.title, text }).catch(() => {});
  else navigator.clipboard?.writeText(text).then(() => toast("Copied — paste it anywhere to share"), () => toast("Sharing is not available here", "info"));
});
// tap outside an open picker closes it
document.addEventListener("click", (e) => { if (RX_OPEN && !e.target.closest(".rx-pop,[data-act=rxOpen]")) { RX_OPEN = null; rerender(); } }, true);

act("submit:comment", (f) => {
  const text = f.text.value.trim(); if (!text) return;
  S.posts.find((x) => x.id === f.dataset.id).comments.push({ who: "me", text, ts: Date.now() }); save(); rerender(); toast("Comment posted");
});

// ── Side pane ──
let drawerEl = null;
act("drawer", () => {
  if (drawerEl) return;
  const layer = $("#layer");
  const scrim = document.createElement("div"); scrim.className = "scrim";
  const el = document.createElement("aside"); el.className = "drawer";
  const lang = LANGS.find((l) => l.id === S.settings.lang);
  const row = (icon, t, s, attr) => `<button class="li" ${attr}><span class="ic">${I(icon)}</span><span class="grow"><span class="t" style="display:block">${t}</span><span class="s">${s}</span></span></button>`;
  el.innerHTML = `<div class="drawer-top"><span class="hero-pattern" aria-hidden="true"></span><button class="li" data-go="#/profile" style="border:0">${avatar("me")}<span class="grow"><span class="t" style="display:block">${esc(fullName())}</span><span class="s">${esc(S.me.role)}</span></span><span class="chev">${I("chevR")}</span></button></div>
    <div class="list">
      ${row("building", esc(S.me.company), esc(S.me.domain), "")}
      ${row("globe", "Language", lang.name, `data-go="#/settings/lang"`)}
      ${row("lock", "Secure your KEBS app", S.settings.secure ? "Enabled" : "Disabled", `data-go="#/settings/secure"`)}
      ${row("msg", "Send feedback", "Give your valuable feedback", `data-go="#/feedback"`)}
      ${row("palette", "Theme", { auto: "Automatic", light: "Light mode", dark: "Dark mode" }[S.settings.theme], `data-go="#/settings/theme"`)}
      ${row("sparkles", "Replay intro", "See the welcome tour again", `data-act="replayIntro"`)}
      ${row("history", "Reset demo data", "Restore the sample workspace", `data-act="resetDemo"`)}
      ${row("logout", "Logout", esc(S.email || "demo.kebs.app"), `data-act="logout"`)}
    </div>
    <div class="drawer-foot"><span class="hrow" style="gap:8px"><img src="icon.svg" alt="" style="width:30px;height:30px;border-radius:9px"><span class="logo-word" style="font-size:24px">KEBS<span>.</span></span></span><span class="tiny faint">v3.18 · 49803</span></div>`;
  layer.append(scrim, el);
  drawerEl = { el, scrim };
  scrim.addEventListener("click", closeDrawer);
});
function closeDrawer() {
  if (!drawerEl) return;
  const { el, scrim } = drawerEl; drawerEl = null;
  el.classList.add("closing"); scrim.classList.add("closing");
  setTimeout(() => { el.remove(); scrim.remove(); }, 220);
}
act("logout", () => { closeDrawer(); confirmSheet({ eyebrow: "Logout", text: `Are you sure you want to log out from <b>${esc(S.me.domain)}</b>?`, ok: "Yes, log out", danger: true, onOk() { S.authed = false; save(); navCount = 0; location.replace("#/login"); } }); });
act("resetDemo", () => { closeDrawer(); confirmSheet({ eyebrow: "Reset", text: "Restore the sample workspace? Everything you’ve changed on this device will be cleared.", ok: "Reset data", danger: true, onOk() { const email = S.email; resetDemo(); S.authed = true; S.email = email; save(); navCount = 0; location.replace("#/home"); rerender(); toast("Demo data restored"); } }); });

// ── Quick-action editor ──
act("editQuick", () => {
  let sel = [...S.quick], q = "";
  const s = openSheet({
    title: `<span class="eyebrow" style="color:var(--accent)">Add quick actions</span>`,
    body: `<div class="searchbox">${I("search")}<input data-q placeholder="Search by module or action"></div>
      <div class="banner info" style="margin:12px 0 4px">${I("info")}You can add up to ${QUICK_MAX} actions to your home screen!</div><div class="list" data-list></div>`,
    foot: `<label class="hrow" style="cursor:pointer"><input type="checkbox" class="check" data-sugg><span class="small b">Select suggested actions</span></label><button class="btn primary block" data-s="save"></button>`,
    onMount(el) {
      const draw = () => {
        el.querySelector("[data-list]").innerHTML = QUICK_ACTIONS.filter((a) => (a.label + a.cat).toLowerCase().includes(q)).map((a) => `<label class="li" style="cursor:pointer"><span class="qa-li-ic">${msIcon(a.id)}</span><span class="grow"><span class="s" style="display:block">${esc(a.cat)}</span><span class="t">${esc(a.label)}</span></span><input type="checkbox" class="check" value="${a.id}" ${sel.includes(a.id) ? "checked" : ""}></label>`).join("");
        el.querySelector("[data-s=save]").textContent = `Save actions (${sel.length}/${QUICK_MAX})`;
        el.querySelector("[data-sugg]").checked = QUICK_SUGGESTED.every((x) => sel.includes(x)) && sel.length === QUICK_SUGGESTED.length;
      };
      el.addEventListener("input", (e) => { if (e.target.matches("[data-q]")) { q = e.target.value.toLowerCase(); draw(); } });
      el.addEventListener("change", (e) => {
        if (e.target.matches("[data-sugg]")) { if (e.target.checked) sel = [...QUICK_SUGGESTED]; draw(); return; }
        if (!e.target.matches(".check")) return;
        const v = e.target.value;
        if (e.target.checked) { if (sel.length >= QUICK_MAX) { e.target.checked = false; toast(`You can pin up to ${QUICK_MAX} actions`, "info"); return; } sel.push(v); }
        else sel = sel.filter((x) => x !== v);
        draw();
      });
      onS(el, { save() { S.quick = sel; save(); closeSheet(s); rerender(); toast("Quick access updated"); } });
      draw();
    },
  });
});
