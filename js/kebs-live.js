// KEBS live: real sign-in and read-only data from the KEBS API.
// Calls go to /kebs-api/* on our own site (vercel.json rewrite / server.mjs proxy) → https://primadevprd.kebs.app/api/*
// so the browser never makes a cross-site call (the KEBS API sends no CORS headers).
// Signed out of KEBS (or an email KEBS doesn't know) → the demo workspace, exactly as before.
const KL_KEY = "kebs.live.v1", KL_ME = "kebs.live.demoMe", KL_BASE = "/kebs-api/", KL_DOMAIN = "primadevprd.kebs.app";
let KL = (() => { try { return JSON.parse(localStorage.getItem(KL_KEY)) || null; } catch { return null; } })();
const KD = { at: 0, busy: false, att: null, attErr: "", apps: [], exCounts: null, exList: null, exTotal: 0, exApprovals: null };
let KL_PENDING = null, klRenewing = null;
const klOn = () => !!(KL && KL.jwt);
function klSave() { try { KL ? localStorage.setItem(KL_KEY, JSON.stringify(KL)) : localStorage.removeItem(KL_KEY); } catch {} }
function klClaims(jwt = KL?.jwt) { try { return JSON.parse(decodeURIComponent(escape(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))))); } catch { return {}; } }

// ── transport ──
async function klFetch(path, body, jwt) {
  const headers = { "Content-Type": "application/json" };
  if (jwt) headers.Authorization = "Bearer " + jwt;
  const r = await fetch(KL_BASE + path.replace(/^\/?api\//, ""), { method: "POST", headers, body: JSON.stringify(body || {}) });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch { j = null; }
  return { status: r.status, ok: r.ok, j };
}
async function klPost(path, body = {}) {
  if (!klOn()) throw new Error("Not signed in to KEBS");
  const exp = (klClaims().exp || 0) * 1000;
  if (exp && exp - Date.now() < 60000) await klRenew();
  let r = await klFetch(path, body, KL.jwt);
  if (r.status === 401) { await klRenew(); r = await klFetch(path, body, KL.jwt); }
  if (!r.ok) throw new Error(r.j?.msg || `KEBS error ${r.status}`);
  return r.j;
}
async function klOpen(path, body) { const r = await klFetch(path, body); if (!r.ok) throw new Error(r.j?.msg || `KEBS error ${r.status}`); return r.j; }
function klRenew() {
  return (klRenewing ||= (async () => {
    try {
      const r = await klFetch("auth/authenticate/renewToken", { refreshToken: KL.refresh, dbName: KL.db, tenantId: KL.tid, rotate: true }, KL.jwt);
      if (!r.ok || !r.j?.jwt) throw new Error("expired");
      KL.jwt = r.j.jwt; if (r.j.refreshToken) KL.refresh = r.j.refreshToken; klSave();
    } catch (e) { klReauth(); throw new Error("Your KEBS session ended. Sign in again to continue."); }
    finally { klRenewing = null; }
  })());
}

// ── sign in / out ──
async function klTenant() {
  const j = await klOpen("tenant/tenantConfigs/getTenantInfo", { domain: KL_DOMAIN });
  if (j?.err || !j?.data?.tad) throw new Error("KEBS workspace not found");
  return j.data;
}
const klDemoSignIn = signIn;
act("submit:login", async (f) => {
  const v = f.email.value.trim();
  const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  f.querySelector("[data-err]").hidden = ok;
  if (!ok) return;
  const btn = f.querySelector("[type=submit]"), label = btn.innerHTML;
  btn.disabled = true; btn.textContent = "Checking…";
  let t, u;
  try { t = await klTenant(); u = await klOpen("auth/authenticate/checkUser", { email: v, dbName: t.tad }); } catch { u = null; }
  btn.disabled = false; btn.innerHTML = label;
  if (!u || u.err) { klDemoSignIn(v); toast("Not a KEBS account here, so you’re in the demo workspace"); return; }
  KL_PENDING = { email: v, t };
  const d = u.userDetail || {};
  const blocked = d.is_o365_signIn_mandatory ? "Your KEBS account signs in with Microsoft only. That’s coming to the app next." : d.is_TFA_enabled ? "Your KEBS account uses two-step sign-in. That’s coming to the app next." : !u.hasPsw ? "This KEBS account has no password yet. Set one on KEBS web first." : "";
  openSheet({ title: "Sign in to KEBS", body: blocked
    ? `<div class="stack"><p class="kl-sub">${esc(blocked)}</p><button class="btn primary block" data-act="klDemo">Use the demo workspace</button></div>`
    : `<form class="stack" data-form="klLogin" novalidate>
        <p class="kl-sub">${esc(v)}<br><span class="muted">${KL_DOMAIN}</span></p>
        <input class="inp" type="password" name="password" placeholder="Password" autocomplete="current-password" aria-label="KEBS password" enterkeyhint="go">
        <span class="err" data-err hidden></span>
        <button class="btn primary block" type="submit">Sign in</button>
        <button class="btn outline block" type="button" data-act="klDemo">Use the demo workspace instead</button>
      </form>`,
    onMount: (el) => setTimeout(() => el.querySelector("input[type=password]")?.focus(), 250) });
});
// KEBS sessions last ~15 min and this server can't renew them, so ask for the password again (data stays on screen)
let klReauthOpen = false;
async function klReauth() {
  if (klReauthOpen || !KL?.email) return; klReauthOpen = true;
  let t; try { t = await klTenant(); } catch { klReauthOpen = false; return; }
  KL_PENDING = { email: KL.email, t, again: true };
  openSheet({ title: "Sign in again", body: `<form class="stack" data-form="klLogin" novalidate>
      <p class="kl-sub">Your KEBS session ended.<br><span class="muted">${esc(KL.email)}</span></p>
      <input class="inp" type="password" name="password" placeholder="Password" autocomplete="current-password" aria-label="KEBS password" enterkeyhint="go">
      <span class="err" data-err hidden></span>
      <button class="btn primary block" type="submit">Continue</button>
      <button class="btn outline block" type="button" data-act="klSignOut">Sign out</button>
    </form>`, onMount: (el) => setTimeout(() => el.querySelector("input[type=password]")?.focus(), 250), onClose: () => { klReauthOpen = false; } });
}
act("klSignOut", () => klEnd());
act("klDemo", () => { const e = KL_PENDING?.email || S.email; KL_PENDING = null; document.activeElement?.blur(); closeAllSheets(); klDemoSignIn(e); });
act("submit:klLogin", async (f) => {
  const p = KL_PENDING, err = f.querySelector("[data-err]"), btn = f.querySelector("[type=submit]");
  if (!p) return;
  const pw = f.password.value;
  if (!pw) { err.textContent = "Enter your KEBS password."; err.hidden = false; return; }
  btn.disabled = true; btn.textContent = "Signing in…"; err.hidden = true;
  try {
    const j = await klOpen("auth/authenticate/userLogin", { username: p.email, password: pw, dbName: p.t.tad, tenantId: p.t.tenant_id, isTFACheckToBedone: false, tfaToken: null });
    if (!j?.jwt) throw new Error(j?.msg || "Sign in failed");
    if (p.again && KL) { KL.jwt = j.jwt; KL.refresh = j.refreshToken; klSave(); KL_PENDING = null; document.activeElement?.blur(); closeAllSheets(); toast("Signed in again"); klLoad(true); return; }
    KL = { jwt: j.jwt, refresh: j.refreshToken, db: p.t.tad, tid: p.t.tenant_id, email: p.email };
    klSave(); KL_PENDING = null; klApplyMe(); klSwapIn();
    document.activeElement?.blur(); closeAllSheets();
    S.authed = true; S.email = p.email; save();
    navCount = 0; location.replace("#/home");
    toast(`Signed in to KEBS as ${klClaims().name || p.email}`);
    klLoad(true);
  } catch (e) {
    btn.disabled = false; btn.textContent = "Sign in";
    err.textContent = /password|invalid|incorrect|credential/i.test(e.message) ? e.message : `Couldn’t sign in: ${e.message}`; err.hidden = false;
  }
});
// swap the demo profile for the KEBS one (and back on sign out)
function klApplyMe() {
  const c = klClaims(); if (!c.name) return;
  try { if (!localStorage.getItem(KL_ME)) localStorage.setItem(KL_ME, JSON.stringify(S.me)); } catch {}
  const parts = String(c.name).trim().split(/\s+/);
  S.me = { ...S.me, first: c.name, middle: "", last: "", display: parts[0], role: `AID ${c.aid}`, domain: KL_DOMAIN, email: c.email || KL.email };
  save();
}
function klEnd(msg, notify = true) {
  const k = KL; KL = null; klSave(); Object.assign(KD, { at: 0, att: null, apps: [], exCounts: null, exList: null, exApprovals: null });
  try { const m = JSON.parse(localStorage.getItem(KL_ME)); if (m) S.me = m; localStorage.removeItem(KL_ME); } catch {}
  klSwapOut(); KM.at = 0;
  S.authed = false; save(); navCount = 0; closeAllSheets(); location.replace("#/login");
  if (msg) toast(msg, "err");
}
act("logout", () => {
  closeDrawer();
  confirmSheet({ eyebrow: "Logout", text: `Are you sure you want to log out from <b>${esc(S.me.domain)}</b>?`, ok: "Yes, log out", danger: true,
    onOk() { if (klOn()) klEnd(); else { S.authed = false; save(); navCount = 0; location.replace("#/login"); } } });
});

// ── data (read-only) ──
function klNum(j) {
  if (!j || j.err || j.messType === "E") return null;
  const d = j.data;
  if (typeof d === "number") return d;
  if (typeof d === "string" && /^\d+$/.test(d)) return +d;
  if (Array.isArray(d)) { if (!d.length) return 0; const o = d[0]; if (o && typeof o === "object") { const k = Object.keys(o).find((x) => /count|total/i.test(x) && !isNaN(+o[x])); if (k) return d.reduce((a, x) => a + (+x[k] || 0), 0); } return d.length; }
  if (d && typeof d === "object") { const k = Object.keys(d).find((x) => /count|total/i.test(x) && !isNaN(+d[x])); if (k) return +d[k]; }
  return null;
}
async function klLoad(force) {
  if (!klOn() || KD.busy || (!force && Date.now() - KD.at < 45000)) return;
  KD.busy = true;
  const c = klClaims(), ids = { aid: c.aid, oid: c.oid };
  const safe = (p) => p.catch((e) => ({ err: true, msg: e.message }));
  const [att, apps, exL, exA, ph, , plan] = await Promise.all([
    safe(klPost("timesheetv2/Attendance/retrieveAttendanceWidgetData", { ...ids, currentDate: D.today() })),
    safe(klPost("insights/kebsHomePage/getInboxApplications", {})),
    safe(klAllClaims(c.oid)),
    safe(klPost("exPrimary2/getEmployeeApprovals", { oid: c.oid, startIndex: 0, noOfRecords: 100, status: "pending", search: null })),
    KL.photo === undefined ? safe(klPost("auth/authenticate/getUserProfileImage", { oid: c.oid })) : Promise.resolve(null),
    klMasters().catch(() => null),
    safe(klPost("timesheetv2/Attendance/getPlannedDataOfAnEmployee", { ...ids, currentDate: D.today() })),
  ]);
  if (!klOn()) { KD.busy = false; return; }
  KD.plan = plan && !plan.err && plan.data ? plan.data : KD.plan || null;
  KD.att = att && !att.err && att.data ? att.data : null; KD.attErr = att?.err ? att.msg || "" : "";
  KD.apps = (Array.isArray(apps?.data) ? apps.data : []).filter((a) => a.is_active !== false).map((a) => ({ id: String(a.application_id), name: a.application_name, api: a.api_configurations?.pending_request_count_api, cfg: a, n: undefined, rows: [] }));
  await Promise.all(KD.apps.map(async (a) => {
    try { a.n = a.api ? klNum(await klPost(a.api, { ...ids, isFromInbox: true, currentDate: D.today() })) : null; } catch { a.n = null; }
    const dataApi = a.cfg.api_configurations?.pending_request_data_api;
    if (dataApi && (a.n > 0 || /timesheet/i.test(a.name))) { try { a.rows = klRows(a.cfg, await klPost(dataApi, { ...ids, searchParams: "", filter: [], filterQuery: "", sort: [], skip: 0, limit: 15, currentDate: D.today() })) || []; } catch { a.rows = []; } }
  }));
  const rows = (j) => (Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : null);
  KD.exList = rows(exL); KD.exApprovals = rows(exA);
  klApplyClaims(); klApplyInbox();
  if (ph) { KL.photo = ph?.data?.profile_image_url || null; klSave(); }
  KD.at = Date.now(); KD.busy = false;
  if (/^#\/(home|inbox|expenses)/.test(location.hash || "#/home")) rerender();
}
// other KEBS approval apps (Timesheet, Projects…) only give counts; expense approvals are listed as real Inbox cards
const klOtherCount = () => KD.apps.reduce((a, x) => a + (x.n || 0), 0);
const klInboxCount = () => inboxList().length + klOtherCount();

// ── demo data out, KEBS data in (and back on sign out) ──
const KL_DEMO = "kebs.live.demoData";
const KL_BAK = { cats: EXP_CATS.slice(), ccs: COST_CENTRES.slice(), ents: ENTITIES.slice(), aps: APPROVERS.slice() };
const klSet = (arr, items) => { arr.splice(0, arr.length, ...items); };
function klSwapIn() {
  try { if (!localStorage.getItem(KL_DEMO)) localStorage.setItem(KL_DEMO, JSON.stringify({ claims: S.claims, receipts: S.receipts, inbox: S.inbox, people: S.people })); } catch {}
  // keep only claims made in the app that aren't in KEBS yet; KEBS claims come from klLoad
  S.claims = (S.claims || []).filter((c) => c.klLocal); S.receipts = (S.receipts || []).filter((r) => !r.claim || S.claims.some((c) => c.id === r.claim) || r.klLocal);
  S.inbox = []; S.people = (S.people || []).filter((p) => !String(p.id).startsWith("kp-")).concat([]);
}
function klSwapOut() {
  try { const d = JSON.parse(localStorage.getItem(KL_DEMO)); if (d) Object.assign(S, d); localStorage.removeItem(KL_DEMO); } catch {}
  klSet(EXP_CATS, KL_BAK.cats); klSet(COST_CENTRES, KL_BAK.ccs); klSet(ENTITIES, KL_BAK.ents); klSet(APPROVERS, KL_BAK.aps);
}
const klJSON = (s, d = null) => { if (s && typeof s === "object") return s; try { return JSON.parse(s); } catch { return d; } };
const KL_MI = { hotel: "building", flight_takeoff: "plane", business: "building", wifi: "globe", devices: "grid", card_membership: "receipt", restaurant: "utensils", payments: "wallet", print: "receipt", event_available: "calendar", local_shipping: "receipt", school: "sparkles", directions_car: "wallet", confirmation_number: "plane", directions_bus: "wallet", attach_money: "wallet", speed: "clock" };
const KL_TINTS = ["t-violet", "t-amber", "t-blue", "t-teal", "t-green", "t-pink", "t-slate"];
const KM = { at: 0 }; // KEBS masters: legal entity, cost centres, claim categories, expense tags, workflow
async function klMasters() {
  if (KM.at && Date.now() - KM.at < 10 * 60e3) return KM;
  const o = klClaims().oid;
  const [le, cc, cfg] = await Promise.all([klPost("exPrimary2/getDefaultlegalEntityV2", { claimedBy: o }), klPost("exPrimary2/getAllCostCenterV2", { claimedBy: o }), klPost("exPrimary2/getExpenseConfig", {})]);
  KM.le = klJSON(le?.data); KM.leRaw = typeof le?.data === "string" ? le.data : JSON.stringify(le?.data || {});
  KM.ccs = Array.isArray(cc) ? cc : cc?.data || [];
  KM.wf = klJSON(cfg?.data?.[0]?.expense_application_config, {})?.workflow_id || 2883;
  const leId = KM.le?.entity_id;
  const [cats, tags] = await Promise.all([klPost("exPrimary2/getClaimCategoryByLE", { expenseType: "C", legalEntityId: leId }), klPost("exPrimary2/getExpenseTag", { legalEntityId: leId })]);
  KM.cats = cats?.data || []; KM.tags = tags?.data || []; KM.at = Date.now();
  // the app's pickers now offer KEBS values
  if (KM.cats.length) klSet(EXP_CATS, KM.cats.slice().sort((a, b) => (/^other/i.test(a.name) ? 1 : 0) - (/^other/i.test(b.name) ? 1 : 0)).map((c, i) => ({ id: c.name, icon: KL_MI[c.mat_icon] || "receipt", tint: KL_TINTS[i % KL_TINTS.length], limit: +c.max_amount || 100000, kebs: c })));
  if (KM.ccs.length) klSet(COST_CENTRES, KM.ccs.map((c) => ({ id: c.cost_centre, name: c.cost_centre_description ? `${c.cost_centre} – ${c.cost_centre_description}` : c.cost_centre, kebs: c })));
  if (KM.le?.entity_name) klSet(ENTITIES, [KM.le.entity_name]);
  return KM;
}
const KL_ST = { Draft: "saved", Submitted: "pending", Approved: "approved", Verified: "approved", Paid: "approved", Closed: "approved", Rejected: "rejected" };
function klAmount(x) {
  const t = klJSON(x.total_amount, []) || [];
  const e = (Array.isArray(t) ? t : [t]).find((a) => a.is_legal_entity_currency) || (Array.isArray(t) ? t[0] : t) || {};
  const cur = e.currency_code || x.entity_currency_code || "INR", v = +e.value || 0;
  return { v, cur, inr: Math.round(v * (CUR[cur] || 1)) };
}
function klApplyClaims() {
  if (!KD.exList) return;
  const local = S.claims.filter((c) => c.klLocal), localR = S.receipts.filter((r) => r.klLocal || local.some((c) => c.id === r.claim) || !r.claim);
  const claims = [], receipts = [];
  KD.exList.forEach((x) => {
    const id = x.expense_header_id, a = klAmount(x), when = String(x.date_of_submission || "").slice(0, 10) || D.today(), st = KL_ST[x.status] || "pending";
    const items = klJSON(x.description_of_items, []) || [], aps = klJSON(x.approvers, []) || [];
    aps.forEach((p) => { if (p?.oid && !APPROVERS.some((q) => q.v === "kl:" + p.oid)) APPROVERS.push({ v: "kl:" + p.oid, label: p.name }); });
    if (x.cost_centre && !COST_CENTRES.some((c) => c.id === x.cost_centre)) COST_CENTRES.push({ id: x.cost_centre, name: `${x.cost_centre} – ${x.cost_centre_description || ""}` });
    const rid = "kl-r-" + id, cid = "kl-" + id;
    receipts.push({ id: rid, rid: "EX" + id, cur: a.cur, amt: a.v, inr: a.inr, merchant: items[0] || x.description || x.expense_tag || "Expense", cat: x.expense_tag && EXP_CATS.some((c) => c.id === x.expense_tag) ? x.expense_tag : EXP_CATS[EXP_CATS.length - 1]?.id || "Other", date: when, desc: items.join(", "), pay: x.spent_from || "", paidBy: "Me", people: [], project: "", taxPct: 0, file: null, claim: cid });
    claims.push({ id: cid, kebsId: id, code: "CL/" + id, name: x.description || x.expense_tag || "Expense claim", status: st, kebsStatus: x.status, cc: x.cost_centre || "", approver: aps[0]?.oid ? "kl:" + aps[0].oid : "", entity: x.entity_name || "", billing: +x.is_billable === 1 ? "Billable" : "Non-billable", desc: x.expense_tag || "", cur: a.cur, receipts: [rid], created: Date.parse(when), submitted: st === "saved" ? null : Date.parse(x.date_of_submission) || Date.parse(when), paid: x.status === "Paid" || x.status === "Closed" ? a.inr : 0, note: "" });
  });
  S.claims = local.concat(claims); S.receipts = localR.concat(receipts);
}

// ── screens ──
const klLive = () => `<span class="kl-live"><i></i>Live from KEBS</span>`;
function klPhoto() {
  if (KL?.photo) return KL.photo;
  const n = initials(fullName()), svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#f08a4b"/><text x="48" y="60" font-family="Inter,Segoe UI,Arial" font-size="36" font-weight="700" fill="#fff" text-anchor="middle">${n}</text></svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}
const _todayCard = todayCard;
todayCard = function (t, late) {
  if (!klOn()) return _todayCard(t, late);
  klLoad();
  const a = KD.att, loading = !KD.at, inNow = klClockedIn();
  const chip = loading ? klLive() : !a?.current_clock_type ? `<span class="chip">Not in yet</span>` : inNow ? `<span class="chip ok">${I("checkCircle")}Working</span>` : `<span class="chip">Clocked out</span>`;
  const sub = loading ? "Loading your attendance…" : a ? (a.current_task ? esc(a.current_task) : KD.plan?.in_time ? `Shift ${esc(klHm(KD.plan.in_time))} – ${esc(klHm(KD.plan.out_time))}` : "Not clocked in yet") : esc(KD.attErr === "Employee Details Not Found" ? "No attendance profile in KEBS for this account" : KD.attErr || "Couldn’t load attendance");
  const v = (x) => (loading ? "…" : esc(klHm(x)));
  return `<div class="card stack today-card">
    <button class="hrow" data-go="#/attendance" style="width:100%;text-align:left"><span class="grow" style="min-width:0"><span class="eyebrow" style="display:block">Today</span><b style="font-size:17px">${D.nice(D.today())}</b><span class="small muted ell" style="display:block">${sub}</span></span>${chip}<span class="chev">${I("chevR")}</span></button>
    <div class="tc-times"><div><span class="tiny muted">Clock in</span><b class="num">${v(a?.current_clock_type ? a.clock_in : null)}</b></div><div><span class="tiny muted">Clock out</span><b class="num">${v(a?.clock_out)}</b></div><div><span class="tiny muted">Worked</span><b class="num">${v(a?.day_total)}</b></div></div>
    <div class="hrow tiny muted"><span class="grow">This month: <b>${loading ? "…" : esc(klHm(a?.month_total))}</b></span>${a?.daily_hours && a.daily_hours !== "-" ? `<span>Target ${esc(String(a.daily_hours))}h/day</span>` : ""}</div>
    ${a || loading ? `<button class="btn ${inNow ? "danger fill" : "primary"} block" data-act="clockToggle" ${loading ? "disabled" : ""}>${I("fingerprint")}${inNow ? "Clock out" : "Clock in"}</button>` : ""}
  </div>`;
};
act("klSoon", (b) => openSheet({ title: b.dataset.k === "clock" ? "Clock in from the app" : "Coming next", body: `<div class="stack"><p class="kl-sub">${b.dataset.k === "clock" ? "Your hours above are live from KEBS. Clocking in and out from the app is the next step. For now, use KEBS web." : "This is read-only for now. Use KEBS web to act on it."}</p><a class="btn outline block" href="https://${KL_DOMAIN}/main/home/dashboard" target="_blank" rel="noopener">Open KEBS web</a></div>` }));

// ── Inbox: the app's own Inbox, filled with KEBS expense approvals; other KEBS approval apps show as count rows ──
const KL_APP_IC = { Timesheet: "clipboard", Projects: "briefcase", Attendance: "fingerprint", ATS: "user", People: "users", Expense: "wallet", Leave: "calendar" };
const klAppIcon = (n) => KL_APP_IC[Object.keys(KL_APP_IC).find((k) => String(n).includes(k))] || "inbox";
const klBar = () => `<div class="kl-bar">${klLive()}<span class="grow"></span><button class="link" data-act="klRefresh">${I("refresh")}Refresh</button></div>`;
const klSkel = (n = 3) => `<div class="stack">${Array.from({ length: n }, () => `<div class="card kl-skel"></div>`).join("")}</div>`;
function klOtherApps() {
  const apps = KD.apps.filter((a) => a.n);
  return apps.length ? `<div class="stack" style="margin-bottom:12px">${apps.map((a) => `<button class="card hrow kl-app" data-act="klApp" data-id="${esc(a.id)}"><span class="ic tint t-blue">${I(klAppIcon(a.name))}</span><span class="grow" style="min-width:0"><b class="ell" style="display:block">${esc(a.name)}</b><span class="small muted">${plural(a.n, "request")} waiting</span></span><b class="num">${a.n}</b><span class="chev">${I("chevR")}</span></button>`).join("")}</div>` : "";
}
act("klApp", (b) => {
  const a = KD.apps.find((x) => x.id === b.dataset.id); if (!a) return;
  openSheet({ title: esc(a.name), body: `<div class="stack"><p class="kl-sub">${plural(a.n || 0, "request")} waiting on you in KEBS. These open on KEBS web for now.</p><a class="btn outline block" href="https://${KL_DOMAIN}/main/home/dashboard" target="_blank" rel="noopener">Open KEBS web</a></div>` });
});
act("klRefresh", () => { KD.at = 0; rerender(); klLoad(true); });
const KL_EXP_URL = (id) => `https://${KL_DOMAIN}/main/expenses-v1.2/expenseDetail/${id}`;

// ── Expenses: the app's own screens, filled with KEBS claims ──
function klWebOnly(c) {
  openSheet({ title: esc(claimTitle(c)), body: `<div class="stack"><p class="kl-sub">This claim is in KEBS (${esc(c.code)} · ${esc(c.kebsStatus || "")}). Changes to it are made on KEBS web for now.</p><a class="btn outline block" href="${KL_EXP_URL(c.kebsId)}" target="_blank" rel="noopener">Open on KEBS web</a></div>` });
}
const klClaimFrom = (b) => { const id = b?.dataset?.id; return claimOf(id) || (rcpt(id)?.claim && claimOf(rcpt(id).claim)) || null; };
["xWithdraw", "xReopen", "xRename", "xAddBill", "xRcOpen", "ceSave", "spSubmit", "xComment"].forEach((n) => {
  const orig = ACTIONS[n]; if (!orig) return;
  act(n, (b, e) => { const c = klOn() && klClaimFrom(b); if (c?.kebsId) return klWebOnly(c); return orig(b, e); });
});
// claims made in the app stay on the phone until submitted; mark them so a KEBS refresh keeps them
["rvCreate", "rvSaveLater"].forEach((n) => {
  const orig = ACTIONS[n]; if (!orig) return;
  act(n, (...a) => { const before = new Set(S.claims.map((c) => c.id)); orig(...a); if (!klOn()) return; S.claims.forEach((c) => { if (!before.has(c.id) && !c.kebsId) { c.klLocal = true; c.cc = c.cc || COST_CENTRES[0]?.id || ""; } }); S.receipts.forEach((r) => { if (!String(r.id).startsWith("kl-r-")) r.klLocal = true; }); save(); });
});
function klCatFor(name) {
  const cats = KM.cats || [], n = String(name || "").toLowerCase();
  return cats.find((c) => c.name.toLowerCase() === n)
    || cats.find((c) => n && (c.name.toLowerCase().includes(n.split(/[\s&/,-]+/)[0]) || n.includes(c.name.toLowerCase().split(/[\s&/,-]+/)[0])))
    || cats.find((c) => /^other/i.test(c.name)) || cats[cats.length - 1];
}
const klClaimDate = (d = new Date()) => `${String(d.getDate()).padStart(2, "0")}-${d.toLocaleString("en-US", { month: "short" })}-${d.getFullYear()}`;
// Same payload the KEBS web form sends (recorded from a real save), built from the app's claim
async function klBuildClaim(c) {
  const M = await klMasters(), o = klClaims().oid;
  const cc = M.ccs.find((x) => x.cost_centre === c.cc); if (!cc) throw new Error("Pick a cost centre for this claim first");
  const cd = klClaimDate();
  const ap = await klPost("exPrimary2/jobBandBasedApprover", { claimDate: cd, claimedBy: o, costCentre: cc.cost_centre, cost_centre_description: cc.cost_centre_description });
  const apr = Array.isArray(ap?.data) ? ap.data : []; if (!apr.length) throw new Error("KEBS found no approver for this cost centre");
  const list = apr.map((a) => a.oid).join(",");
  const INR = { currency_id: 1, currency_code: "INR", currency_description: "Indian Rupee", id: 1, name: "INR - Indian Rupee" };
  const claims = claimReceipts(c).map((r) => {
    const k = klCatFor(r.cat) || {}, amt = Math.round((r.inr || 0) * 100) / 100, d = r.date || D.today();
    return { categoryCode: k.code, category: k.id, categoryName: k.name, claimTypeId: k.claim_type_id, amount: amt, currency: INR, currencyCode: 1, currenyCodeValue: "INR", taxPercentage: "", taxRate: "", taxType: "", taxAmount: 0, taxRatetype: 1, finalamount: amt, conversionRate: 1, currencyFrom: "INR", currencyTo: "INR", invoiceDate: d, description: [r.merchant, r.desc].filter(Boolean).join(" – ") || "Expense", approvers: apr, workflowId: M.wf, isAggregationAllowed: 0, attachment: "", uploadInProgress: false, startDate: d, endDate: d, peopleInvolved: "", contextId: null, invoiceNo: "", fromLocation: "", toLocation: "", vehicleType: "", vehicleEngineType: "", miles: "", unit: "", location: "", perDiemstartDate: "", perDiemEndDate: "", perDiemStartTime: "", perDiemEndTime: "", noOfDays: "0.00", approverMenu: list, settlement: amt, legalEntityCurrency: "", hasDuplicateError: null, duplicationError: null };
  });
  if (!claims.length) throw new Error("Add at least one receipt");
  const tag = M.tags.find((t) => t.name === c.desc) || M.tags[0];
  const exp = { expenseType: "C", claimedBy: o, originalInitiatorOId: o, legalEntity: M.leRaw, expenseTag: tag?.id, department: "", costCenter: cc, claimDate: cd, claims, costCenterCode: cc.cost_centre, legalEntityCode: M.le?.entity_id, customerBilling: 3, headerLevelApprover: apr, headerLevelApproverList: list, legalEntityCurrency: M.le?.entity_currency_code || "INR", headerDescription: c.name || "Expense claim", spentFrom: 1, corporateCard: "", isExpenseCreatedFromWeb: 1 };
  return { exp, apr };
}
const klFail = (j) => j && (j.err === true || j.messType === "E") ? (j.msg || j.messText || "KEBS didn’t accept the claim") : "";
async function klSendClaim(c, asDraft) {
  const { exp, apr } = await klBuildClaim(c);
  const j = asDraft ? await klPost("exPrimary2/saveAsDraft", { expHeaderId: 0, expenseDetails: exp, approversList: apr })
    : await klPost("exPrimary2/createOneOrMoreExpenses", { expenses: exp, approversList: apr });
  const bad = klFail(j); if (bad) throw new Error(bad);
  // the claim now lives in KEBS: drop the phone copy and reload
  const before = new Set(S.claims.filter((x) => x.kebsId).map((x) => x.kebsId));
  S.receipts = S.receipts.filter((r) => !c.receipts.includes(r.id)); S.claims = S.claims.filter((x) => x.id !== c.id); save();
  KD.busy = false; await klLoad(true);
  // the newest KEBS claim that wasn’t there before is the one just sent
  const fresh = S.claims.filter((x) => x.kebsId && !before.has(x.kebsId)).sort((p, q) => q.kebsId - p.kebsId)[0];
  return fresh?.id || null;
}
const _xSubmit = ACTIONS.xSubmit;
act("xSubmit", (b) => {
  const c = claimOf(b.dataset.id);
  if (!klOn() || !c) return _xSubmit(b);
  if (c.kebsId) return klWebOnly(c);
  if (!c.cc || !COST_CENTRES.some((x) => x.id === c.cc)) { toast("Pick a cost centre before submitting", "bad"); return go(`#/expenses/claim/${c.id}/edit`); }
  const s = openSheet({ title: "Send to KEBS",
    body: `<div class="stack"><p class="kl-sub"><b>${esc(claimTitle(c))}</b> · ${fmtCur(claimTotal(c), c.cur)}<br><span class="muted">${esc(ccName(c.cc))}</span></p><p class="small muted" style="margin:0">Submit sends it to your KEBS approver. Save as draft keeps it in KEBS to finish later.</p><span class="err" data-err hidden></span></div>`,
    foot: `<div class="row-btns"><button class="btn outline" style="flex:1" data-s="draft">Save as draft</button><button class="btn primary" style="flex:1" data-s="submit">${I("send")}Submit</button></div>`,
    onMount(el) {
      const run = async (draft, btn) => {
        const err = el.querySelector("[data-err]"); el.querySelectorAll("button").forEach((x) => (x.disabled = true)); const label = btn.innerHTML; btn.textContent = draft ? "Saving…" : "Submitting…"; err.hidden = true;
        try {
          const id = await klSendClaim(c, draft); closeSheet(s); try { navigator.vibrate?.([18, 40, 28]); } catch {}
          // same finish as the demo: the claim page with the success tick (drafts open as saved claims)
          if (id) swap(`#/expenses/claim/${id}${draft ? "" : "?new=1"}`); else swap(draft ? "#/expenses?tab=saved" : "#/expenses");
          if (draft || !id) toast(draft ? "Saved to KEBS as a draft" : "Claim submitted to KEBS");
        }
        catch (e) { el.querySelectorAll("button").forEach((x) => (x.disabled = false)); btn.innerHTML = label; err.textContent = e.message; err.hidden = false; }
      };
      onS(el, { draft(btn) { run(true, btn); }, submit(btn) { run(false, btn); } });
    } });
});

// ── wire into routes ──
ROUTES.forEach((r) => {
  const src = r.re.source, orig = r.render;
  if (src === "^expenses$") r.render = (...a) => { if (!klOn()) return orig(...a); klLoad(); if (!KD.at) return `<div class="screen">${topbar("My expenses")}<div class="scroll">${klBar()}${klSkel(4)}</div></div>`; const out = orig(...a); return typeof out === "string" ? out.replace('<div class="scroll">', `<div class="scroll">${klBar()}`) : out; };
  const prev = r.render;
  r.render = (...a) => { const out = prev(...a); return klOn() && typeof out === "string" ? out.replaceAll("assets/avatars/me.jpg?v=3", klPhoto()) : out; };
});
if (ACTIONS.drawer) { const d = ACTIONS.drawer; act("drawer", (...a) => { d(...a); if (klOn()) document.querySelectorAll("#layer [style*='avatars/me.jpg'], #layer img[src*='avatars/me.jpg']").forEach((e) => { if (e.tagName === "IMG") e.src = klPhoto(); else e.style.setProperty("--av", `url("${klPhoto()}")`); }); }); }
if (klOn()) { klApplyMe(); klSwapIn(); klLoad(true); }

// ══ Inbox (live): the app's own Inbox, one tab per KEBS approval app, Approve / Reject inside the app ══
// Lists and actions follow the KEBS homepage inbox config (getInboxApplications → api_configurations), the same
// calls KEBS web makes: data {aid,oid,searchParams,filter,filterQuery,sort,skip,limit,currentDate};
// approve {aid,oid,selectedDetails:[row],status:'A',isApproveApi:true}; reject {…,status:'R',comments,isRejectApi:true}.
async function klAllClaims(oid) {
  const all = [];
  for (let start = 0; start < 600; ) {
    const j = await klPost("exPrimary2/getMyExpenseDetailsBasedOnOid", { associateOId: oid, startIndex: start, numberOfRecords: 50, status: "all", search: null });
    const page = Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : [];
    all.push(...page); if (page.length < 10) break; start += page.length;
  }
  return all;
}
const klOk = (cfg, j) => cfg.api_response_type === "messType" ? ["S", "W"].includes(j?.messType) : cfg.api_response_type === "err" ? j?.err === false : !!j && j.err !== true && j.messType !== "E";
const klMsg = (j) => j?.messText || j?.msg || j?.message || (typeof j === "string" ? j : "");
function klRows(cfg, j) {
  if (cfg.api_response_type === "messType") return j?.messType === "S" && Array.isArray(j.data) ? j.data : [];
  if (cfg.api_response_type === "err") return j?.err === false && Array.isArray(j.data) ? j.data : [];
  return Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : [];
}
const klKey = (cfg) => (/timesheet/i.test(cfg.application_name) ? "timesheet" : /expense/i.test(cfg.application_name) ? "expense" : /leave/i.test(cfg.application_name) ? "leave" : "app" + cfg.application_id);
const klShort = (n) => String(n).replace(/\s*-\s*.*$/, "").replace(/ Approvals?$/i, "").trim() || n;
const klCol = (cfg, types) => (cfg.pending_request_list_view_configurations || []).filter((c) => c.is_active !== false && types.includes(c.column_type)).sort((a, b) => a.position - b.position);
const klVal = (row, col) => { const k = col?.column_key; const key = Array.isArray(k) ? k[0] : k && typeof k === "object" ? k[0] ?? k["0"] : k; return key != null ? row[key] : null; };
function klPerson(name, aid, i) {
  const pid = "kp-" + (aid || String(name || "x").toLowerCase().replace(/\W+/g, "-"));
  const ex = S.people.find((p) => p.id === pid);
  if (!ex) S.people.push({ id: pid, name: name || "Someone", role: aid ? `AID ${aid}` : "", tint: KL_TINTS[(i || 0) % KL_TINTS.length] });
  else if (name && !/^AID d+$/.test(name) && (/^AID d+$/.test(ex.name) || ex.name === "Someone")) ex.name = name; // a real name replaces a placeholder
  return pid;
}
function klApplyInbox() {
  S.people = S.people || [];
  const items = [];
  (KD.exApprovals || []).forEach((x, i) => {
    const a = klAmount(x), pid = klPerson(x.claimed_by_name, x.claimer_aid, i);
    S.people.find((p) => p.id === pid).role = x.department || S.people.find((p) => p.id === pid).role;
    items.push({ id: "kl-ix-" + x.expense_header_id, kl: "expense", kebsId: x.expense_header_id, kebsRole: x.role, kebsStatus: x.status, head: x, kind: "expense", who: pid, amount: a.inr, cat: x.expense_tag || "Expense", icon: "wallet", date: String(x.date_of_submission || "").slice(0, 10) || D.today(), desc: x.description || "", cc: x.cost_centre, klMain: money(a.inr), klMeta: `<span class="hrow">${I("wallet")}${esc(x.expense_tag || "Expense")}${/treasur/i.test(x.role) ? " · Payment check" : ""}</span>` });
  });
  KD.apps.forEach((a) => (a.rows || []).forEach((row, i) => {
    const cfg = a.cfg, emp = klCol(cfg, ["employee-display-aid", "employee-display"])[0], k = emp?.column_key || {};
    const keys = Array.isArray(k) ? k : Object.values(k);
    const name = row[keys[0]] || row.employee_name, aid = row[keys[1]] || row.associate_id;
    const main = klCol(cfg, ["time-format", "currency", "number"])[0], mv = klVal(row, main);
    const texts = klCol(cfg, ["text", "text-color", "date-range"]).filter((c) => c.is_default_visible !== false).map((c) => klVal(row, c)).filter((v) => v != null && v !== "").slice(0, 2);
    const dcol = klCol(cfg, ["date"])[0], dv = klVal(row, dcol) || row.submitted_on;
    const kind = klKey(cfg);
    items.push({ id: `kla-${a.id}-${i}`, kl: "app", app: a.id, row, kind, who: klPerson(name, aid, i), date: dv ? String(dv).slice(0, 10) : D.today(),
      hours: main?.column_type === "time-format" ? mv : undefined, amount: main?.column_type === "currency" ? +mv || 0 : undefined,
      klMain: mv == null ? "" : main?.column_type === "time-format" ? `${esc(String(mv))} hrs` : esc(String(mv)),
      klMeta: `<span class="hrow">${I(klAppIcon(a.name))}${esc(texts.join(" · ") || klShort(a.name))}</span>` });
  }));
  S.inbox = items;
}
// the demo's card helpers, taught about live items
const _ixMain = ixMain, _ixMeta = ixMeta;
ixMain = (x) => (x?.klMain != null ? x.klMain : _ixMain(x));
ixMeta = (x) => (x?.klMeta != null ? x.klMeta : _ixMeta(x));

function klInboxScreen(q) {
  klLoad();
  const loading = !KD.at, tab = q.tab || "all", qs = (q.q || "").toLowerCase();
  const all = inboxList(), tabs = [["all", "All"], ["expense", "Expense"], ["timesheet", "Timesheet"]];
  KD.apps.forEach((a) => { const k = klKey(a.cfg); if (!tabs.some((t) => t[0] === k) && (a.rows?.length || a.n)) tabs.push([k, klShort(a.name)]); });
  const count = (k) => all.filter((x) => k === "all" || x.kind === k).length;
  const list = all.filter((x) => (tab === "all" || x.kind === tab) && (!qs || (person(x.who).name + " " + (x.cat || "") + " " + (x.cc || "") + " " + JSON.stringify(x.row || {})).toLowerCase().includes(qs)))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  // KEBS apps with requests we can only count (no list API) still show, as rows
  const counted = KD.apps.filter((a) => a.n > 0 && !(a.rows || []).length && (tab === "all" || tab === klKey(a.cfg)));
  return `<div class="screen">
    <div class="big-title"><h1>My inbox</h1><p>${loading ? "Loading from KEBS…" : all.length + klOtherCount() - KD.apps.reduce((n, a) => n + Math.min(a.n || 0, (a.rows || []).length), 0) > 0 ? `${plural(all.length, "request")} waiting on you` : "Nothing waiting on you"}</p></div>
    ${seg(tabs.map(([v, l]) => [v, `${l} (${count(v)})`]), tab, "ixTab")}
    <div class="scroll">
      ${klBar()}
      <div class="hrow" style="margin-bottom:12px"><label class="searchbox grow">${I("search")}<input data-ixq value="${esc(q.q || "")}" placeholder="Search name / cost center"></label><button class="ib" data-go="#/inbox/history" aria-label="Approval history">${I("history")}</button></div>
      ${counted.length ? `<div class="stack" style="margin-bottom:12px">${counted.map((a) => `<div class="card hrow kl-app"><span class="ic tint t-blue">${I(klAppIcon(a.name))}</span><span class="grow" style="min-width:0"><b class="ell" style="display:block">${esc(a.name)}</b><span class="small muted">${plural(a.n, "request")} waiting</span></span><b class="num">${a.n}</b></div>`).join("")}</div>` : ""}
      ${loading ? klSkel() : `<div class="stack" data-lazy="6">${list.map((x) => `<button class="card ix stack s6" data-act="ixOpen" data-id="${x.id}">
        <div class="hrow">${avatar(x.who)}<span class="grow"><b style="display:block">${esc(person(x.who).name)}</b><span class="tiny muted hrow">${I("building")}${esc(person(x.who).role || "KEBS")}</span></span><b class="num">${ixMain(x)}</b></div>
        <div class="divider" style="margin:4px 0"></div>
        <div class="meta">${ixMeta(x)}<span class="hrow">${I("calendar")}${D.short(x.date)}</span></div>
      </button>`).join("") || (counted.length ? "" : emptyState(["inbox", "checkCircle", "sparkles"], "Inbox zero", qs ? `No requests match “${esc(q.q)}”.` : "You’ve cleared every approval. Nice."))}</div>`}
    </div></div>`;
}
ROUTES.forEach((r) => {
  if (r.re.source !== "^inbox$") return;
  const prev = r.render;
  r.render = (m, q, ...rest) => (klOn() ? klInboxScreen(q || {}) : prev(m, q, ...rest));
});

// ── actions ──
async function klAppDecide(x, verdict, comment) {
  const a = KD.apps.find((p) => p.id === x.app), cfg = a.cfg, api = cfg.api_configurations || {}, c = klClaims();
  const body = verdict === "A" ? { aid: c.aid, oid: c.oid, selectedDetails: [x.row], status: "A", isApproveApi: true, currentDate: D.today() }
    : { aid: c.aid, oid: c.oid, selectedDetails: [x.row], status: "R", comments: comment, isRejectApi: true, currentDate: D.today() };
  const j = await klPost(verdict === "A" ? api.approve_api : api.reject_api, body);
  if (!klOk(cfg, j)) throw new Error(klMsg(j) || "KEBS didn’t accept that");
  a.rows = a.rows.filter((r) => r !== x.row); if (a.n) a.n--;
  return klMsg(j);
}
async function klExpenseDecide(x, verdict, comment) {
  const c = klClaims(), h = x.head;
  const items = await klPost("exPrimary2/getExpenseItems", { expHeaderId: x.kebsId, role: "Approver", oid: c.oid });
  const mine = (Array.isArray(items) ? items : items?.data || []).filter((i) => +i.is_curr_appr === 1);
  if (!mine.length) throw new Error("Nothing on this claim is waiting on you any more");
  const base = { expHeaderId: x.kebsId, subApplicationId: 2, initiatorOId: h.claimed_by, costCenter: h.cost_centre, costCenterDescription: h.cost_centre_description, customerBilling: h.is_billable };
  const expItems = mine.map((i) => ({ approverOid: c.oid, ccWorkflowHeaderId: i.cc_wf_header_id, status: verdict, billingStatus: i.is_billable || 0 }));
  let j;
  if (verdict === "A") {
    j = await klPost("exPrimary2/approveExpenseItem", { ...base, expItems });
    if (j && typeof j === "object" && (j.messType === "E" || j.message)) throw new Error(klMsg(j));
  } else {
    for (const i of mine) await klPost("exPrimary2/saveExpenseRejectComment", { rejectCommentDetails: { ...i, expense_item_id: i.expense_item_id, item_amount: typeof i.item_amount === "string" ? i.item_amount : JSON.stringify(i.item_amount || []), description: i.description || "", reason: String(comment).slice(0, 200), rejectType: "A", expHeaderId: x.kebsId, claimed_by: h.claimed_by, expenseType: "CL/" } });
    j = await klPost("exPrimary2/UpdateExpenseStatus", { ...base, expItems });
    if (j && (j.messType === "E" || j.message)) throw new Error(klMsg(j));
  }
  KD.exApprovals = (KD.exApprovals || []).filter((e) => e.expense_header_id !== x.kebsId);
  return "";
}
const _ixOpenDemo = ACTIONS.ixOpen;
act("ixOpen", (b) => {
  const x = S.inbox.find((i) => i.id === b.dataset.id);
  if (!x?.kl) return _ixOpenDemo(b);
  const treasury = x.kl === "expense" && /treasur/i.test(x.kebsRole || "");
  const app = x.kl === "app" ? KD.apps.find((p) => p.id === x.app) : null;
  const title = x.kl === "expense" ? (treasury ? "Payment check" : "Expense claim") : klShort(app?.name || "Request");
  const rows = x.kl === "expense"
    ? [["Amount", ixMain(x)], ["Claim", `CL/${x.kebsId} · ${esc(x.cat)}${x.desc ? ` · ${esc(x.desc)}` : ""}`], ["Cost centre", esc(x.cc || "—")], ["Submitted", D.long(x.date)]]
    : klCol(app.cfg, ["text", "text-color", "time-format", "number", "currency", "date", "date-range"]).map((c) => [esc(c.label.charAt(0) + c.label.slice(1).toLowerCase()), esc(String(klVal(x.row, c) ?? "—"))]).slice(0, 7);
  const quick = (app?.cfg?.rejection_comments || []).slice(0, 3);
  const s = openSheet({ title,
    body: `<div class="stack"><div class="hrow">${avatar(x.who, "lg")}<span class="grow"><b style="display:block;font-size:17px">${esc(person(x.who).name)}</b><span class="small muted">${esc(person(x.who).role || "")}</span></span></div>
      <div class="card">${rows.map(([k, v]) => `<div class="kv"><span>${k}</span><span class="small">${v}</span></div>`).join("")}</div>
      ${treasury ? `<div class="banner">${I("info")}<span class="grow">Payment verification needs ledger accounts and bank entries, so it isn’t available on mobile.</span></div>`
        : `<div class="field"><label for="ix-r">Comment <span class="opt">(required to reject)</span></label><textarea id="ix-r" class="inp" data-r style="min-height:70px" placeholder="Add a note for ${esc(person(x.who).name.split(" ")[0])}"></textarea>${quick.length ? `<div class="kl-quick">${quick.map((t) => `<button type="button" class="link small" data-s="quick">${esc(t)}</button>`).join("")}</div>` : ""}</div>`}
      <span class="err" data-err hidden></span></div>`,
    foot: treasury ? "" : `<div class="row-btns"><button class="btn danger" data-s="rej">Reject</button><button class="btn ok" data-s="ok">${I("check")}Approve</button></div>`,
    onMount(el) {
      const err = el.querySelector("[data-err]");
      const run = async (verdict, btn) => {
        const r = el.querySelector("[data-r]")?.value.trim() || "";
        if (verdict === "R" && !r) { el.querySelector("[data-r]").focus(); return toast("Add a reason to reject", "bad"); }
        el.querySelectorAll(".sheet-foot button").forEach((y) => (y.disabled = true)); const label = btn.innerHTML; btn.textContent = verdict === "A" ? "Approving…" : "Rejecting…"; err.hidden = true;
        try {
          if (x.kl === "expense") await klExpenseDecide(x, verdict, r); else await klAppDecide(x, verdict, r);
          closeSheet(s); ixDecide([x.id], verdict === "A" ? "approved" : "rejected", r);
        } catch (e) { el.querySelectorAll(".sheet-foot button").forEach((y) => (y.disabled = false)); btn.innerHTML = label; err.textContent = e.message; err.hidden = false; }
      };
      onS(el, { ok(btn) { run("A", btn); }, rej(btn) { run("R", btn); }, quick(btn) { const t = el.querySelector("[data-r]"); t.value = btn.textContent; t.focus(); } });
    } });
});
// inbox needs fresh data after the first load (KEBS apps can change between sign-ins)
if (klOn()) klApplyInbox();

// ══ Payment check (treasury Verify / Reject) — same calls as the KEBS v1.2 treasurer view ══
// Everything is prefilled from KEBS except the expense account (GL) per item, which the treasurer picks.
const klStr = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));
const klAmt = (s) => { const a = klJSON(s, []) || []; const e = (Array.isArray(a) ? a : [a]).find((x) => x.is_expense_currency) || (Array.isArray(a) ? a[0] : a) || {}; return { v: +e.value || 0, cur: e.currency_code || "INR" }; };
const klLedgerName = (row) => { if (!row) return ""; const o = klJSON(row, row); return o.expense_type || o.name || o.gl_name || o.ledger_name || o.description || Object.values(o).find((v) => typeof v === "string") || "Account"; };
async function klTreasuryLoad(x) {
  const c = klClaims(), h = x.head, id = x.kebsId;
  const safe = (p) => p.catch(() => null);
  const [items, narr, desc, led, cred, tgt, pay] = await Promise.all([
    klPost("exPrimary2/getExpenseItems", { expHeaderId: id, role: "Treasurer", oid: c.oid }),
    safe(klPost("exPrimary2/narrationDescription", { claimId: id })),
    safe(klPost("exPrimary2/accountLedgerDescription", { claimId: id })),
    safe(klPost("exPrimary2/getLedgerAccountDetail", { oid: h.claimed_by })),
    safe(klPost("exPrimary2/getCreditLedgerTenantDetails", { claimerAid: h.claimer_aid, expenseType: "C", expenseCategory: h.expense_category || "", expense_header_id: id })),
    safe(klPost("exPrimary2/getTargetEntityBasedOnCostCenter", { cost_center: h.cost_centre, expense_header_id: id })),
    safe(klPost("exPrimary2/getPaymentDetails", { expHeaderId: id })),
  ]);
  const rows = (Array.isArray(items) ? items : items?.data || []).filter((i) => i.treasury_wf_header_id && (i.is_curr_appr == null || +i.is_curr_appr === 1));
  const narrs = Array.isArray(narr?.data) ? narr.data : [];
  const saved = klJSON(klJSON(pay?.data?.[0]?.payment_details ?? pay?.data?.payment_details ?? pay?.payment_details, null), null);
  const savedAcc = (itemId) => saved?.expenseEntry?.find((e) => +e.expense_item_id === +itemId)?.ledgerAmountDistribution?.[0]?.expense_account || "";
  const tg = klJSON(tgt?.data, null);
  const cd = cred?.data && typeof cred.data === "object" ? (Array.isArray(cred.data) ? cred.data[0] : cred.data) : null;
  return {
    rows: rows.map((i) => { const a = klAmt(i.item_amount); return { i, amt: a.v, cur: a.cur, date: String(i.invoice_date || "").slice(0, 10), narration: narrs.find((n) => +n.id === +i.expense_item_id)?.result || "", account: savedAcc(i.expense_item_id), cat: i.expense_category_name || h.expense_tag || "" }; }),
    ledgerAccount: klStr(led?.data ?? ""), ledgerDesc: String((Array.isArray(desc?.data) ? desc.data[0]?.result : desc?.data?.result) || "").slice(0, 255),
    targetRaw: klStr(tgt?.data ?? ""), targetId: tg?.entity_id || h.legal_entity_id || 0,
    creditLedger: cd?.credit_ledger_name || h.claimer_aid,
  };
}
function klPaymentDetails(x, T) {
  const h = x.head;
  return { ledgerAccount: T.ledgerAccount, ledgerAccountDescription: T.ledgerDesc, targetEntity: T.targetRaw, paymentMode: "", paymentDays: "2-3 working days",
    creditLedger: T.creditLedger, creditLedgerCode: "EL",
    costCenterCode: h.cost_centre, costCenterCodeBeforeUpdate: h.cost_centre, costCenterDepartment: h.department, costCenterDepartmentBeforeUpdate: h.department,
    customerBilling: h.is_billable ?? 3, customerBillingBeforeUpdate: h.is_billable ?? 3,
    expenseEntry: T.rows.map((r) => ({ expense_item_id: r.i.expense_item_id, item_index: 0, item_amount: r.i.item_amount, ledgerAmountDistribution: [{ ledger_item_amount: r.amt.toFixed(2), currency_code: r.cur, bill_date: r.date, narration: r.narration, expense_account: r.account }] })),
    cheques: [] };
}
async function klTreasuryDecide(x, T, verdict, reason) {
  const c = klClaims(), h = x.head, id = x.kebsId;
  if (!T.rows.length) throw new Error("Nothing on this claim is waiting on you any more");
  if (verdict === "R") for (const r of T.rows) await klPost("exPrimary2/saveExpenseRejectComment", { rejectCommentDetails: { ...r.i, item_amount: klStr(r.i.item_amount), description: r.i.description || "", reason: String(reason).slice(0, 200), rejectType: "T", expHeaderId: id, claimed_by: h.claimed_by, expenseType: "CL/" } });
  await klPost("exPrimary2/savePaymentDetailsOnly", { expHeaderId: id, paymentDetails: klPaymentDetails(x, T), associateID: h.claimer_aid });
  const expItems = T.rows.map((r) => ({ approverOid: c.oid, tWorkflowHeaderId: r.i.treasury_wf_header_id, status: verdict, expenseItemId: r.i.expense_item_id, sourceEntityCurrency: h.entity_currency_code,
    expenseItemLedger: verdict === "A" ? [{ ledger_item_amount: r.amt.toFixed(2), currency_code: r.cur, bill_date: r.date, narration: r.narration, expense_account: r.account }] : [{ ledger_item_amount: 0, currency_code: r.cur, expense_account: "" }] }));
  const j = await klPost("exPrimary2/UpdateTreasuryExpenseStatus", { expHeaderId: id, expItems, expenseDetail: h, targetLegalEntityId: T.targetId, claimType: "C" });
  const st = j?.headerStatusName; if (!st) throw new Error(klMsg(j) || "KEBS didn’t accept that");
  if (st === "Verified") {
    await klPost("exPrimary2/updateExpenseToTally", { details: { expense_header_id: id, legal_entity_id: h.legal_entity_id, target_legal_entity_id: h.legal_entity_id, ledger_account: T.ledgerAccount, ledger_description: T.ledgerDesc, credit_ledger: T.creditLedger } }).catch(() => null);
    await klPost("exPrimary2/newKnockOff", { oid: h.claimed_by, claimId: id }).catch(() => null);
  }
  KD.exApprovals = (KD.exApprovals || []).filter((e) => e.expense_header_id !== id);
  return st;
}
// searchable expense-account picker (KEBS getExpenseTypeLedger)
function klPickAccount(x, start, onPick) {
  const s = openSheet({ title: "Expense account", body: `<div class="stack"><label class="searchbox">${I("search")}<input data-q placeholder="Search accounts" value="${esc(start || "")}" enterkeyhint="search"></label><div class="list" data-res>${klSkel(3)}</div></div>`,
    onMount(el) {
      const inp = el.querySelector("[data-q]"), res = el.querySelector("[data-res]"); let t, seq = 0, found = [];
      const run = async () => {
        const q = inp.value.trim(), my = ++seq; if (!q) { res.innerHTML = `<p class="small muted" style="margin:8px 4px">Type to search accounts.</p>`; return; }
        res.innerHTML = klSkel(2);
        try {
          const j = await klPost("exPrimary2/getExpenseTypeLedger", { searchParameter: q, options: { legal_entity_id: x.head.legal_entity_id } });
          if (my !== seq) return; found = Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : [];
          res.innerHTML = found.length ? found.slice(0, 30).map((r, i) => `<button class="opt-row" data-s="pick" data-i="${i}"><span class="grow"><b style="display:block">${esc(klLedgerName(r))}</b>${r.gl_code || r.code ? `<span class="small faint">${esc(r.gl_code || r.code)}</span>` : ""}</span></button>`).join("") : `<p class="small muted" style="margin:8px 4px">No accounts match “${esc(q)}”.</p>`;
        } catch (e) { if (my === seq) res.innerHTML = `<p class="small muted" style="margin:8px 4px">${esc(e.message)}</p>`; }
      };
      inp.addEventListener("input", () => { clearTimeout(t); t = setTimeout(run, 300); });
      onS(el, { pick(b) { const r = found[+b.dataset.i]; closeSheet(s); onPick(JSON.stringify(r)); } });
      run(); setTimeout(() => inp.focus(), 250);
    } });
}
function klTreasurySheet(x) {
  let T = null;
  const draw = (el) => {
    const body = el.querySelector("[data-tb]"), foot = el.querySelector(".sheet-foot");
    if (!T) { body.innerHTML = klSkel(2); return; }
    body.innerHTML = T.rows.length ? `<div class="sec" style="margin-top:4px"><h2>Expense account</h2></div><div class="stack">${T.rows.map((r, k) => `<button class="card hrow kl-acc ${r.account ? "" : "need"}" data-s="acc" data-k="${k}"><span class="grow" style="min-width:0"><b class="ell" style="display:block">${esc(r.cat || r.i.description || "Item")}</b><span class="small ${r.account ? "muted" : "kl-need"}">${r.account ? esc(klLedgerName(r.account)) : "Choose an account to verify"}</span></span><b class="num">${money(r.amt)}</b><span class="chev">${I("chevR")}</span></button>`).join("")}</div>`
      : `<p class="kl-sub small muted">Nothing on this claim is waiting on you any more.</p>`;
    const ok = T.rows.length && T.rows.every((r) => r.account && r.amt > 0);
    foot.querySelector("[data-s=ok]").disabled = !ok; foot.querySelector("[data-s=rej]").disabled = !T.rows.length;
  };
  const s = openSheet({ title: "Payment check",
    body: `<div class="stack"><div class="hrow">${avatar(x.who, "lg")}<span class="grow"><b style="display:block;font-size:17px">${esc(person(x.who).name)}</b><span class="small muted">${esc(person(x.who).role || "")}</span></span></div>
      <div class="card"><div class="kv"><span>Amount</span><span>${ixMain(x)}</span></div><div class="kv"><span>Claim</span><span class="small">CL/${x.kebsId} · ${esc(x.cat)}${x.desc ? ` · ${esc(x.desc)}` : ""}</span></div><div class="kv"><span>Cost centre</span><span class="small">${esc(x.cc || "—")}</span></div><div class="kv"><span>Submitted</span><span>${D.long(x.date)}</span></div></div>
      <div data-tb></div>
      <div class="field"><label for="ix-r">Comment <span class="opt">(required to reject)</span></label><textarea id="ix-r" class="inp" data-r style="min-height:64px" placeholder="Reason, if you reject"></textarea></div>
      <span class="err" data-err hidden></span></div>`,
    foot: `<div class="row-btns"><button class="btn danger" data-s="rej" disabled>Reject</button><button class="btn ok" data-s="ok" disabled>${I("check")}Verify</button></div>`,
    onMount(el) {
      const err = el.querySelector("[data-err]");
      draw(el);
      klTreasuryLoad(x).then((t) => { T = t; draw(el); }).catch((e) => { err.textContent = e.message; err.hidden = false; });
      const run = async (verdict, btn) => {
        const r = el.querySelector("[data-r]").value.trim();
        if (verdict === "R" && !r) { el.querySelector("[data-r]").focus(); return toast("Add a reason to reject", "bad"); }
        el.querySelectorAll(".sheet-foot button").forEach((y) => (y.disabled = true)); const label = btn.innerHTML; btn.textContent = verdict === "A" ? "Verifying…" : "Rejecting…"; err.hidden = true;
        try { const st = await klTreasuryDecide(x, T, verdict, r); closeSheet(s); ixDecide([x.id], verdict === "A" ? "approved" : "rejected", r); if (st && st !== "Verified" && st !== "Rejected") toast(`Claim is now ${st}`, "info"); }
        catch (e) { btn.innerHTML = label; draw(el); err.textContent = e.message; err.hidden = false; }
      };
      onS(el, {
        acc(b) { const row = T.rows[+b.dataset.k]; klPickAccount(x, String(row.cat || "").split(/[\s/-]+/)[0], (v) => { row.account = v; draw(el); }); },
        ok(btn) { run("A", btn); }, rej(btn) { run("R", btn); },
      });
    } });
}
{ const prevOpen = ACTIONS.ixOpen; act("ixOpen", (b) => { const x = S.inbox.find((i) => i.id === b.dataset.id); if (x?.kl === "expense" && /treasur/i.test(x.kebsRole || "")) return klTreasurySheet(x); return prevOpen(b); }); }

// ══ Attendance (live): clock in / out with your location, as KEBS web does ══
// POST timesheetv2/Attendance/insertEmployeeWebAttendanceData {aid, oid, currentDate, current_timestamp, current_timestamp_local,
//   day_closing_timestamp, clock_type 1=in 2=out, cost_center_id, cost_center_type, sub_project_id, task_id, geolocation_data:{lat,long}}
const klHms = (d = new Date()) => [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, "0")).join(":");
const klHm = (t) => { const m = String(t || "").match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i); return m ? `${m[1].padStart(2, "0")}:${m[2]}${m[3] ? " " + m[3].toUpperCase() : ""}` : "--:--"; };
const klClockedIn = () => +KD.att?.current_clock_type === 1;
function klWhere() {
  return new Promise((ok, no) => {
    if (!navigator.geolocation) return no(new Error("This device can’t share its location"));
    navigator.geolocation.getCurrentPosition((p) => ok({ lat: +p.coords.latitude.toFixed(6), long: +p.coords.longitude.toFixed(6), acc: Math.round(p.coords.accuracy) }),
      (e) => no(new Error(e.code === 1 ? "Allow location access to clock in. KEBS needs it for attendance." : "Couldn’t get your location. Try again outdoors or turn on GPS.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  });
}
async function klCostCentres() {
  const c = klClaims(), d = D.today();
  const j = await klPost("timesheetv2/Attendance/retrieveCostCenterDetailsForAttendance", { aid: c.aid, oid: c.oid, startDate: d, endDate: d });
  const data = j?.data || {};
  return [...(data.project_cc || []), ...(data.dept_cc || [])];
}
async function klPunch(type, pick, where) {
  const c = klClaims(), now = new Date(), end = new Date(); end.setHours(23, 59, 59, 0);
  const j = await klPost("timesheetv2/Attendance/insertEmployeeWebAttendanceData", {
    aid: c.aid, oid: c.oid, currentDate: D.today(), current_timestamp: now.toISOString(), current_timestamp_local: klHms(now), day_closing_timestamp: end.toISOString(),
    clock_type: type, cost_center_id: pick.cc, cost_center_type: pick.type, sub_project_id: pick.sub ?? null, task_id: pick.task ?? null,
    geolocation_data: { lat: where.lat, long: where.long } });
  if (!j || j.err) throw new Error(klMsg(j) || "KEBS didn’t record that");
  KD.at = 0; await klLoad(true);
  return klMsg(j);
}
// choose cost centre → sub-project → task (only the steps that apply)
function klChooseWork(list, done) {
  const opts = (arr, sub) => arr.map((x, i) => ({ v: String(i), label: x.cost_centre_description || x.name || x.task_name || x.sub_project_name || x.description || x.cost_centre || "Item", sub: sub(x) }));
  if (!list.length) return toast("KEBS has no cost centre for you today", "bad");
  pickOption({ title: "What are you working on?", value: "", options: opts(list, (x) => [x.cost_centre, x.cost_centre_type === "I" ? "Project" : "Department"].filter(Boolean).join(" · ")), onPick(v) {
    const cc = list[+v], base = { cc: cc.id, type: cc.cost_centre_type, sub: null, task: null, label: cc.cost_centre_description || cc.cost_centre };
    const subs = (cc.sub_projects || []).filter((s) => (s.tasks || []).length), tasks = cc.tasks || [];
    const pickTask = (arr, b) => arr.length ? setTimeout(() => pickOption({ title: "Task", value: "", options: opts(arr, () => ""), onPick(t) { done({ ...b, task: arr[+t].id, label: `${b.label} · ${arr[+t].task_name || arr[+t].name || "Task"}` }); } }), 260) : done(b);
    if (subs.length) setTimeout(() => pickOption({ title: "Sub-project", value: "", options: opts(subs, () => ""), onPick(s) { const sp = subs[+s]; pickTask(sp.tasks || [], { ...base, sub: sp.id, label: `${base.label} · ${sp.sub_project_name || sp.name || ""}` }); } }), 260);
    else if (cc.hasTask || tasks.length) pickTask(tasks, base);
    else done(base);
  } });
}
const klBusy = (on, text) => { let el = document.querySelector(".kl-busy"); if (!on) return el?.remove(); if (!el) { el = document.createElement("div"); el.className = "kl-busy"; document.body.append(el); } el.innerHTML = `<span class="kl-spin"></span>${esc(text)}`; };
async function klClockIn() {
  let where;
  try { klBusy(true, "Getting your location…"); where = await klWhere(); klBusy(true, "Loading your cost centres…"); const list = await klCostCentres(); klBusy(false);
    klChooseWork(list, async (pick) => {
      try { klBusy(true, "Clocking in…"); const m = await klPunch(1, pick, where); klBusy(false); try { navigator.vibrate?.([18, 40, 28]); } catch {} if (location.hash.startsWith("#/clockin")) ACTIONS.back(); toast(m || `Clocked in · ${pick.label}`); }
      catch (e) { klBusy(false); toast(e.message, "bad"); }
    });
  } catch (e) { klBusy(false); toast(e.message, "bad"); }
}
async function klClockOut() {
  const rows = KD.att?.attendance_data || [], last = rows[rows.length - 1];
  if (!last) return toast("No clock-in found for today", "bad");
  confirmSheet({ eyebrow: "Clock out", text: `You’ve worked <b>${esc(KD.att.day_total || "00:00")}</b> today${KD.att.current_task ? ` on <b>${esc(KD.att.current_task)}</b>` : ""}. Clock out now?`, ok: "Yes, clock out", danger: true,
    async onOk() {
      try { klBusy(true, "Getting your location…"); const where = await klWhere(); klBusy(true, "Clocking out…");
        const m = await klPunch(2, { cc: last.cost_center_id, type: last.cost_center_type, sub: last.sub_project_id ?? null, task: last.task_id ?? null }, where); klBusy(false); toast(m || "Clocked out"); }
      catch (e) { klBusy(false); toast(e.message, "bad"); }
    } });
}
{ const prevToggle = ACTIONS.clockToggle; act("clockToggle", (b, e) => { if (!klOn()) return prevToggle(b, e); if (klClockedIn()) return klClockOut(); go("#/clockin"); }); }
{ const prevConfirm = ACTIONS.confirmClockIn; act("confirmClockIn", (b, e) => (klOn() ? klClockIn() : prevConfirm(b, e))); }
{ const prevSoon = ACTIONS.klSoon; act("klSoon", (b, e) => (klOn() && b?.dataset?.k === "clock" ? ACTIONS.clockToggle(b, e) : prevSoon(b, e))); }
// clock-in screen: show where you really are (the KEBS office geofence isn’t shared with employees, so no fence is drawn)
ROUTES.forEach((r) => {
  if (r.re.source !== "^clockin$") return;
  const prevRender = r.render, prevMount = r.mount;
  r.render = (...a) => { const out = prevRender(...a); if (!klOn() || typeof out !== "string") return out;
    return out.replace(/<div class="card hrow" style="margin-top:12px">[\s\S]*?<\/div>\s*<p class="small muted"[\s\S]*?<\/p>/, `<div class="card hrow" style="margin-top:12px"><span class="li" style="padding:0;border:0"><span class="ic tint t-blue">${I("pin")}</span></span><span class="grow"><b style="display:block">${esc(KD.plan?.work_location || "Your location")}</b><span class="small muted" data-kl-loc>Finding you…</span></span>${klLive()}</div>
      <p class="small muted" style="margin:14px 4px 0">KEBS records your location with the clock-in. Next, pick the cost centre you’re working on.</p>`); };
  r.mount = (...a) => {
    if (!klOn()) return prevMount?.(...a);
    const el = $("[data-map]"); const lbl = document.querySelector("[data-kl-loc]");
    klWhere().then((w) => {
      if (lbl) lbl.textContent = `Location found · accurate to ${w.acc} m`;
      if (!el) return;
      loadMapLibre().then((ml) => { if (!el.isConnected) return;
        const map = new ml.Map({ container: el, style: `https://tiles.openfreemap.org/styles/${isDarkUI() ? "dark" : "liberty"}`, center: [w.long, w.lat], zoom: 16.4, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false });
        const dot = document.createElement("div"); dot.className = "map-me"; dot.innerHTML = "<b></b><i></i>"; new ml.Marker({ element: dot }).setLngLat([w.long, w.lat]).addTo(map);
        map.on("load", () => { map.resize(); el.closest(".map")?.classList.add("live"); });
        CLOCK_MAP = { map, fit: () => map.easeTo({ center: [w.long, w.lat], zoom: 16.4 }) };
      }).catch(() => {});
    }).catch((e) => { if (lbl) lbl.textContent = e.message; });
  };
});

// ══ Timesheet (live, read-only): the app's own day / week / history screens, filled from KEBS ══
// Saving and submitting go through KEBS's provenance guard (signed requests from the registered KEBS web client),
// so the app can't write timesheets until KEBS registers it. Reading: Retrieval/retrieveTSDataForEmployee.
const KL_TS_DEMO = "kebs.live.demoTs";
const KTS = { weeks: {}, busy: {} };
function klTsSwapIn() {
  try { if (!localStorage.getItem(KL_TS_DEMO)) localStorage.setItem(KL_TS_DEMO, JSON.stringify(S.ts)); } catch {}
  if (!S.ts?.klLive) S.ts = { entries: {}, weeks: {}, running: null, klLive: true };
}
function klTsSwapOut() { try { const d = JSON.parse(localStorage.getItem(KL_TS_DEMO)); if (d) S.ts = d; localStorage.removeItem(KL_TS_DEMO); } catch {} KTS.weeks = {}; }
const klMins = (hm) => { const [h, m] = String(hm || "0:0").split(":").map((x) => +x || 0); return h * 60 + m; };
const KL_TS_ST = { 1: "draft", 6: "draft", 2: "pending", 4: "approved", 3: "rejected" };
async function klTsWeek(mon) {
  if (KTS.weeks[mon] || KTS.busy[mon] || !klOn()) return; KTS.busy[mon] = true;
  const c = klClaims(), end = D.add(mon, 6);
  try {
    const j = await klPost("timesheetv2/Retrieval/retrieveTSDataForEmployee", { aid: c.aid, oid: c.oid, startDate: mon, endDate: end, cutoffValidation: { weekStartDate: mon, weekEndDate: end, monthStartDate: mon.slice(0, 8) + "01", monthEndDate: end } });
    const days = j?.data?.days || [];
    days.forEach((d) => {
      if (!d.date || d.dayIndex === -1) return;
      const list = [];
      (d.costcenter || []).forEach((cc) => {
        const ccId = cc.costCenterId ?? cc.cost_center_id ?? cc.id, pid = `klcc-${ccId}-${cc.subProjectId ?? cc.sub_project_id ?? ""}`;
        const name = [cc.costcentername || cc.cost_centre_description || cc.costcenter, cc.subProjectName || cc.sub_project_name].filter(Boolean).join(" · ") || "Cost centre";
        let p = PROJECTS.find((x) => x.id === pid); if (!p) { p = { id: pid, name, owner: "", tasks: [], kl: true }; PROJECTS.push(p); }
        const tasks = cc.tasks?.length ? cc.tasks : [{ taskName: "Hours", hoursworked: cc.hoursworked, isBillable: cc.isBillable, msg: cc.msg }];
        tasks.forEach((t) => {
          const mins = klMins(t.hoursworked); if (!mins) return;
          const tn = t.taskName || t.task_name || t.name || "Hours"; let ti = p.tasks.indexOf(tn); if (ti < 0) { p.tasks.push(tn); ti = p.tasks.length - 1; }
          list.push({ id: `kl-${d.date}-${pid}-${ti}`, pid, ti, mins, billable: t.isBillable === 1 || t.isBillable === "BA" || /^b/i.test(t.billing_type || ""), comment: t.msg || "", kl: true });
        });
      });
      S.ts.entries[d.date] = list;
    });
    const st = KL_TS_ST[j?.data?.tsOverAllStatus] || "draft";
    S.ts.weeks[mon] = { status: st, attachments: [], kl: true };
    KTS.weeks[mon] = { ok: !!days.length, err: j?.messType === "E" ? klMsg(j) : "" };
  } catch (e) { KTS.weeks[mon] = { ok: false, err: e.message }; }
  KTS.busy[mon] = false;
  if (/^#\/ts/.test(location.hash)) rerender();
}
const klTsNote = () => openSheet({ title: "Timesheet", body: `<div class="stack"><p class="kl-sub">Your timesheet here is live from KEBS. Logging and submitting hours from the app needs KEBS to register the app first: timesheet saves are signed by the KEBS website for security.</p><p class="small muted" style="margin:0">Clocking in and out still fills your timesheet automatically.</p></div>` });
["tsAddMenu", "tsAdd", "tsEdit", "tsCopy", "tsClear", "tsTimer", "tsSubmit", "tsUnsubmit", "tsAttach", "tsDetach"].forEach((n) => {
  const orig = ACTIONS[n]; if (!orig) return;
  act(n, (b, e) => (klOn() ? klTsNote() : orig(b, e)));
});
ROUTES.forEach((r) => {
  const src = r.re.source; if (src !== "^ts$" && src !== "^ts\\/week$") return;
  const prev = r.render;
  r.render = (m, q, ...rest) => {
    if (!klOn()) return prev(m, q, ...rest);
    klTsSwapIn();
    const w = src === "^ts$" ? D.monday(q?.d || D.today()) : q?.w || D.monday(D.today());
    klTsWeek(w); klTsWeek(D.add(w, -7));
    const out = prev(m, q, ...rest), st = KTS.weeks[w];
    const bar = `<div class="kl-bar">${klLive()}<span class="grow"></span>${!st ? `<span class="small muted">Loading…</span>` : st.err ? `<span class="small muted">${esc(st.err)}</span>` : ""}</div>`;
    return typeof out === "string" ? out.replace('<div class="scroll">', `<div class="scroll">${bar}`) : out;
  };
});
{ const prevEnd = klEnd; klEnd = function (...a) { klTsSwapOut(); PROJECTS.splice(0, PROJECTS.length, ...PROJECTS.filter((p) => !p.kl)); return prevEnd(...a); }; }

// ══ Leave (live): KEBS leave types, balances, holidays, my requests; apply + withdraw — LeaveAppNode /api/leaveapp/leavePrimary ══
// No provenance guard on leave. KEBS picks the approver (your direct manager) and the workflow itself.
const KL_LV = "leaveapp/leavePrimary/";
const KL_LV_DEMO = "kebs.live.demoLeave";
const KLV = { at: 0, busy: false, types: [], hol: [], weekOff: [] };
const KL_LV_TINTS = ["t-blue", "t-red", "t-green", "t-violet", "t-amber", "t-teal", "t-pink", "t-slate"];
const KL_LV_BAK = { types: LEAVE_TYPES.slice() };
function klLeaveSwapIn() {
  try { if (!localStorage.getItem(KL_LV_DEMO)) localStorage.setItem(KL_LV_DEMO, JSON.stringify({ requests: S.requests, leaveUsed: S.leaveUsed })); } catch {}
}
function klLeaveSwapOut() {
  try { const d = JSON.parse(localStorage.getItem(KL_LV_DEMO)); if (d) Object.assign(S, d); localStorage.removeItem(KL_LV_DEMO); } catch {}
  LEAVE_TYPES.splice(0, LEAVE_TYPES.length, ...KL_LV_BAK.types); Object.assign(KLV, { at: 0, types: [], hol: [], weekOff: [] });
}
const klLvStatus = (s) => (/approv/i.test(s) ? "approved" : /reject/i.test(s) ? "rejected" : /withdr|cancel/i.test(s) ? "withdrawn" : "pending");
async function klLeaveLoad(force) {
  if (!klOn() || KLV.busy || (!force && Date.now() - KLV.at < 60000)) return; KLV.busy = true;
  const c = klClaims(), safe = (p) => p.catch(() => null);
  const [types, hol, wo] = await Promise.all([
    safe(klPost(KL_LV + "getEmployeeLeaveDetails", { associateId: c.aid, associateOid: c.oid })),
    safe(klPost(KL_LV + "getHolidayList", { currDateTime: `${D.today()} ${klHms().slice(0, 5)}`, associateOid: c.oid, associateId: c.aid })),
    safe(klPost(KL_LV + "getEmployeeWeekOff", { associateOid: c.oid, associateId: c.aid })),
  ]);
  const rows = [];
  for (let off = 0; off < 150; off += 15) {
    const j = await safe(klPost(KL_LV + "getLeaveDetails", { associateOid: c.oid, filterConfig: { mainFilterArray: [] }, pendingLimit: off, filterQuery: "" }));
    const page = j?.messType === "S" && Array.isArray(j.data) ? j.data : [];
    rows.push(...page); if (page.length < 15) break;
  }
  if (!klOn()) { KLV.busy = false; return; }
  KLV.types = (types?.messType === "S" && Array.isArray(types.data) ? types.data : []).filter((t) => t.is_need_to_show_in_summary !== 0);
  KLV.hol = hol?.messType === "S" && Array.isArray(hol.data) ? hol.data : [];
  if (!KLV.hol.length) { const h2 = await safe(klPost(KL_LV + "getHolidayListForEmployee", { associateId: c.aid, oid: c.oid })); KLV.hol = (h2?.messType === "S" && Array.isArray(h2.data) ? h2.data : []).map((h) => ({ name: h.holiday_name || h.name, date: D.iso(new Date(h.holiday_date || h.date)), is_fixed_holiday: 1 })); }
  KLV.noPolicy = types?.messType === "E" || !(Array.isArray(types?.data) && types.data.length);
  KLV.weekOff = wo?.messType === "S" && Array.isArray(wo.data) ? wo.data.map((d) => String(d).slice(0, 3).toLowerCase()) : ["sat", "sun"];
  klLeaveSwapIn();
  LEAVE_TYPES.splice(0, LEAVE_TYPES.length, ...KLV.types.map((t, i) => ({ id: "kl" + t.leaveCode, name: t.leaveName || t.leaveDescription || t.leaveType, total: null, tint: KL_LV_TINTS[i % KL_LV_TINTS.length], kl: t })));
  S.requests = rows.map((r) => {
    const dates = (klJSON(r.dates, []) || []).map((d) => (typeof d === "string" ? d : d.date)).filter(Boolean).sort();
    const from = dates[0] || String(r.applied_on || "").slice(0, 10), to = dates[dates.length - 1] || from, st = klLvStatus(r.status);
    const type = +r.is_wfh ? "wfh" : +r.is_od ? "onduty" : "leave", created = Date.parse(r.applied_on) || Date.now();
    const act = [{ text: "Request raised by you", ts: created, kind: "on" }]; if (st !== "pending") act.push({ text: `${r.status}${r.comments && typeof r.comments === "string" ? ` · ${r.comments}` : ""}`, ts: created, kind: st === "approved" ? "ok" : "bad" });
    return { id: "klr-" + r.id, kebsId: r.id, kebsRow: r, type, leaveType: "kl" + r.leave_id, from, to, dayType: +r.start_date_session > 1 ? "half" : "full", days: +r.days || dates.length || 1, reason: r.reason || "", status: st, created, attachments: [], comments: [], notify: [], activity: act };
  });
  KLV.at = Date.now(); KLV.busy = false;
  if (/^#\/(leave|requests|request|holidays|home)/.test(location.hash)) rerender();
}
// balances: KEBS gives the available balance per type (no used/total split)
const _leaveBalances = leaveBalances;
leaveBalances = function () {
  if (!klOn() || !KLV.at) return klOn() ? [] : _leaveBalances();
  return LEAVE_TYPES.map((t) => ({ ...t, total: null, used: S.requests.filter((r) => r.type === "leave" && r.leaveType === t.id && r.status === "pending").reduce((a, r) => a + (r.days || 1), 0), available: Math.max(0, +t.kl?.leaveBalance || 0) }));
};
// holidays from KEBS (your region's calendar)
const _holidaysFor = holidaysFor;
holidaysFor = function (year) {
  if (!klOn() || !KLV.hol.length) return _holidaysFor(year);
  return KLV.hol.filter((h) => String(h.date).startsWith(String(year))).map((h) => ({ date: String(h.date).slice(0, 10), name: h.name || h.description || "Holiday", floater: !+h.is_fixed_holiday })).sort((a, b) => (a.date < b.date ? -1 : 1));
};
const klWeekOff = (d) => KLV.weekOff.includes(["sun", "mon", "tue", "wed", "thu", "fri", "sat"][D.parse(d).getDay()]);
function klLeaveDates(from, to, t) {
  const out = [], hol = new Set(KLV.hol.map((h) => String(h.date).slice(0, 10)));
  for (let d = from; d <= to; d = D.add(d, 1)) { if (!t?.isWeekOffConsidered && klWeekOff(d)) continue; if (!t?.isHolidayConsidered && hol.has(d)) continue; out.push(d); }
  return out;
}
const _leaveSubmit = ACTIONS.leaveSubmit;
act("leaveSubmit", async (b) => {
  if (!klOn()) return _leaveSubmit(b);
  if (b.disabled) return;
  const F = DRAFT, lt = LEAVE_TYPES.find((x) => x.id === F.leaveType), t = lt?.kl;
  if (!t) return toast("Pick a leave type", "bad");
  const dates = klLeaveDates(F.from, F.to, t);
  if (!dates.length) return toast("These dates are weekly offs or holidays", "bad");
  const half = F.dayType === "half";
  if (half && !+t.is_half_day_leave) return toast(`${lt.name} can’t be taken as a half day`, "bad");
  const days = half ? 0.5 : dates.length;
  if (days > (+t.leaveBalance || 0)) return toast(`Only ${+t.leaveBalance || 0} ${lt.name.toLowerCase()} day(s) left`, "bad");
  const c = klClaims(), fmt = (d) => D.f(d, { day: "2-digit", month: "short", year: "numeric" });
  const label = b.innerHTML; b.disabled = true; b.textContent = "Requesting…";
  try {
    const j = await klPost(KL_LV + "applyLeave", { leaveDetails: { dateRange: `${fmt(F.from)} - ${fmt(F.to)}`, reason: F.reason.trim(), attachments: null,
      dates: dates.map((d) => ({ date: d, leaveType: t.leaveName || t.leaveDescription, leaveId: t.leaveCode })),
      associateOid: c.oid, leaveType: t.leaveType, leaveDescription: t.leaveName || t.leaveDescription, leaveId: t.leaveCode, sessionType: half ? 2 : 1 },
      isClaim: 0, associateId: c.aid, filterConfig: { mainFilterArray: [] } });
    if (j?.messType !== "S") throw new Error(klMsg(j) || "KEBS didn’t accept the request");
    KLV.at = 0; await klLeaveLoad(true);
    const mine = S.requests.filter((r) => r.type === "leave" && r.from === dates[0]).sort((x, y) => y.kebsId - x.kebsId)[0];
    try { navigator.vibrate?.([18, 40, 28]); } catch {}
    if (mine) requestDone(mine); else { swap("#/requests"); toast(klMsg(j) || "Leave requested"); }
  } catch (e) { b.disabled = false; b.innerHTML = label; toast(e.message, "bad"); }
});
const _withdrawReq = ACTIONS.withdrawReq;
act("withdrawReq", (b, e) => {
  const r = S.requests.find((x) => x.id === b.dataset.id);
  if (!klOn() || !r?.kebsId) return _withdrawReq?.(b, e);
  confirmSheet({ eyebrow: "Withdraw", text: "Withdraw this request? Your approver will be notified.", ok: "Yes, withdraw", danger: true, async onOk() {
    const c = klClaims();
    try {
      const j = await klPost(KL_LV + "withdrawLeaveV2", { initiator_aid: c.aid, initiator_oid: c.oid, aid: c.aid, oid: c.oid, leave_id: r.kebsId, current_date: D.today(), reason: "Withdrawn from the KEBS mobile app" });
      if (j?.messType !== "S") throw new Error(klMsg(j) || "KEBS didn’t withdraw it");
      KLV.at = 0; await klLeaveLoad(true); toast("Request withdrawn");
    } catch (er) { toast(er.message, "bad"); }
  } });
});
// load leave data whenever a leave screen opens
ROUTES.forEach((r) => {
  if (!/^\^(leave|requests|request|holidays)/.test(r.re.source)) return;
  const prev = r.render;
  r.render = (...a) => {
    if (!klOn()) return prev(...a);
    klLeaveLoad(); const out = prev(...a);
    const note = !KLV.at ? `<div class="kl-bar">${klLive()}<span class="grow"></span><span class="small muted">Loading…</span></div>`
      : KLV.noPolicy && r.re.source.startsWith("^leave") ? `<div class="kl-bar">${klLive()}</div><div class="banner warn">${I("info")}<span class="grow">KEBS has no leave policy or balance set up for this account yet. Ask HR to map your leave policy.</span></div>` : `<div class="kl-bar">${klLive()}</div>`;
    return typeof out === "string" ? out.replace('<div class="scroll">', `<div class="scroll">${note}`) : out;
  };
});
{ const prevEnd2 = klEnd; klEnd = function (...a) { klLeaveSwapOut(); return prevEnd2(...a); }; }
if (klOn()) klLeaveLoad(true);

// ══ Projects (live): KEBS Projects v2 (/api/pm) in the app's own Projects screens; mark tasks done / in progress ══
// List: auth/getProjectRoleAccessList → planning/getTotalProjectList · detail: getProjectCardData · team: retrieveISAData
// tasks: getMyTaskListView (mode 1 = mine, 2 = all) · status: updateMyTaskStatus {statusId 5 done, 4 in progress, 7 reset}
const KL_PJ_DEMO = "kebs.live.demoPj";
const KPJ = { at: 0, busy: false, access: null, detail: {}, tasks: {} };
const KL_PJ_TINTS = ["t-blue", "t-violet", "t-green", "t-amber", "t-teal", "t-pink", "t-slate"];
function klPjSwapIn() { try { if (!localStorage.getItem(KL_PJ_DEMO)) localStorage.setItem(KL_PJ_DEMO, JSON.stringify(S.pj)); } catch {} if (!S.pjLive) { S.pj = {}; S.pjLive = true; } }
function klPjSwapOut() { try { const d = JSON.parse(localStorage.getItem(KL_PJ_DEMO)); if (d) S.pj = d; localStorage.removeItem(KL_PJ_DEMO); } catch {} delete S.pjLive; Object.assign(KPJ, { at: 0, access: null, detail: {}, tasks: {} }); }
const klPjStatus = (s, id) => (/hold|suspend/i.test(s || "") ? "hold" : /complet|closed|done/i.test(s || "") ? "done" : "active");
const klTkStatus = (id) => (+id === 5 ? "done" : +id === 4 ? "doing" : "todo");
const KL_TK_ID = { done: 5, doing: 4, review: 4, todo: 7 };
const klPri = (p) => (/high|critical|urgent|1/i.test(String(p || "")) ? "high" : /low|3/i.test(String(p || "")) ? "low" : "med");
const klDay = (d) => (d ? String(d).slice(0, 10) : null);
function klPersonFromIsa(m, i) {
  const me = klClaims();
  if (String(m.associate_id) === String(me.aid) || m.oid === me.oid) return "me";
  return klPerson([m.first_name, m.middle_name, m.last_name].filter(Boolean).join(" ") || m.name || m.employee_name, m.associate_id || m.aid, i);
}
// same rule as KEBS web (pm-authorization.service.ts checkProjectRoleAccess): your project-app role (915/object 6)
// picks which project roles apply: "*" → Admin (1), "True" with no entries → Team member (9), else the listed role ids
async function klPjAccess() {
  if (KPJ.access) return KPJ.access;
  const c = klClaims();
  const [roles, mine] = await Promise.all([klPost("pm/auth/getProjectRoleAccessList", {}), klPost("pm/auth/getAccessFor", { oid: c.oid, type: "project" })]);
  const roleList = Array.isArray(roles) ? roles : Array.isArray(roles?.data) ? roles.data : [];
  const acc = (Array.isArray(mine) ? mine : Array.isArray(mine?.data) ? mine.data : []).find((r) => +r.application_id === 915 && +r.object_id === 6);
  let ids = [];
  if (acc?.object_value === "*") ids = [1];
  else if (acc?.object_value === "True") { const e = klJSON(acc.object_entries, acc.object_entries); ids = e == null || e === "null" || e === "*" ? [9] : (Array.isArray(e) ? e : [e]).map(Number); }
  KPJ.access = roleList.filter((r) => ids.includes(+r.id));
  if (!KPJ.access.length) KPJ.err = "You don’t have access to Projects in KEBS.";
  return KPJ.access;
}
async function klPjLoad(force) {
  if (!klOn() || KPJ.busy || (!force && Date.now() - KPJ.at < 90000)) return; KPJ.busy = true;
  try {
    const mainAccess = await klPjAccess();
    const j = await klPost("pm/planning/getTotalProjectList", { mainAccess, filterConfig: { search_params: "", condition_query: "" }, date: D.today() });
    const rows = j?.messType === "S" && Array.isArray(j.data) ? j.data : [];
    klPjSwapIn();
    const next = {};
    rows.forEach((r, i) => {
      const id = "klp-" + r.item_id, old = S.pj[id];
      next[id] = { ...(old || {}), id, kebs: { item: r.item_id, project: r.project_id }, name: r.item_name || r.project_name, code: r.project_code || r.profit_center || "", client: r.project_name && r.project_name !== r.item_name ? r.project_name : r.legal_entity || "",
        status: klPjStatus(r.project_status || r.item_status_name, r.item_status_id), tint: KL_PJ_TINTS[i % KL_PJ_TINTS.length], start: klDay(r.planned_start_date || r.project_start_date), end: klDay(r.planned_end_date || r.project_end_date),
        budget: 0, base: 0, manager: old?.manager || "", team: old?.team || ["me"], desc: old?.desc || "", milestones: old?.milestones || [], tasks: old?.tasks || [] };
    });
    S.pj = next; KPJ.at = Date.now();
  } catch (e) { KPJ.err = e.message; KPJ.at = Date.now(); }
  KPJ.busy = false;
  if (/^#\/projects/.test(location.hash)) rerender();
  // my tasks across projects (KEBS has no single "my tasks" list): first 12 active projects
  Object.values(S.pj).filter((p) => p.status === "active").slice(0, 12).forEach((p) => klPjTasks(p, 1));
}
async function klPjTasks(p, mode = 2) {
  const key = `${p.id}:${mode}`; if (KPJ.tasks[key] === "busy" || (KPJ.tasks[key] && Date.now() - KPJ.tasks[key] < 90000)) return; KPJ.tasks[key] = "busy";
  try {
    const all = [];
    for (let skip = 0; skip < 150; skip += 15) {
      const j = await klPost("pm/planning/getMyTaskListView", { projectId: p.kebs.project, itemId: p.kebs.item, mode, filterConfig: { skip, limit: 15, sort: [], search_params: "", isGroupBy: 0, groupByKey: "", groupByKeyValue: "", isFavList: 0, favTaskList: [] } });
      const page = Array.isArray(j?.data) ? j.data : []; all.push(...page); if (page.length < 15) break;
    }
    const me = klClaims(), mineSet = new Set();
    const tasks = all.map((t, i) => {
      const who = (Array.isArray(t.assigned_to) ? t.assigned_to : klJSON(t.assigned_to, []) || [])[0];
      // KEBS sends assignees as AIDs (numbers) or as objects
      const wAid = who == null ? null : typeof who === "object" ? who.associate_id || who.aid || who.id : who;
      const assignee = mode === 1 ? "me" : wAid == null ? "" : String(wAid) === String(me.aid) || who?.oid === me.oid ? "me"
        : S.people.some((x) => x.id === "kp-" + wAid) ? "kp-" + wAid : klPerson(typeof who === "object" ? who.name || [who.first_name, who.last_name].filter(Boolean).join(" ") || who.employee_name : `AID ${wAid}`, wAid, i);
      if (assignee === "me") mineSet.add(t.id);
      return { id: "klt-" + t.id, kebsId: t.id, title: t.description || t.task_name || "Task", assignee, status: klTkStatus(t.status_id), priority: klPri(t.priority), due: klDay(t.end_date || t.display_end_date), est: +t.estimated_hours || 0, desc: "", comments: [], created: Date.parse(t.start_date) || Date.now(), pct: +t.completion_percentage || 0 };
    });
    // merge: "all" replaces, "mine" only fills in when we have nothing better
    const cur = S.pj[p.id]; if (!cur) return;
    if (mode === 2 || !cur.tasks.some((x) => x.kebsId)) cur.tasks = mode === 2 ? tasks : tasks.concat(cur.tasks.filter((x) => !mineSet.has(x.kebsId)));
    KPJ.tasks[key] = Date.now();
  } catch { KPJ.tasks[key] = Date.now(); }
  if (/^#\/projects/.test(location.hash)) rerender();
}
async function klPjDetail(p) {
  if (KPJ.detail[p.id]) return; KPJ.detail[p.id] = "busy";
  const safe = (x) => x.catch(() => null);
  const [card, isa] = await Promise.all([
    safe(klPost("pm/planning/getProjectCardData", { itemId: p.kebs.item, projectId: p.kebs.project, date: D.today() })),
    safe(klPost("pm/planning/retrieveISAData", { projectID: p.kebs.item, currentDate: D.today() })),
  ]);
  const cur = S.pj[p.id]; if (!cur) return;
  const cd = card?.data && !Array.isArray(card.data) ? card.data : Array.isArray(card?.data) ? card.data[0] : null;
  if (cd) {
    const pm = (Array.isArray(cd.project_manager) ? cd.project_manager : klJSON(cd.project_manager, []) || [])[0];
    if (pm) cur.manager = String(pm.associate_id || pm.aid) === String(klClaims().aid) ? "me" : klPerson(pm.name || pm.employee_name || [pm.first_name, pm.last_name].filter(Boolean).join(" "), pm.associate_id || pm.aid, 0);
    cur.desc = [cd.delivery_type, cd.revenue_type, cd.sow_reference_number && `SOW ${cd.sow_reference_number}`].filter(Boolean).join(" · ");
    if (cd.at_risk) cur.desc = `At risk · ${cur.desc}`;
  }
  const team = (Array.isArray(isa?.data) ? isa.data : []).filter((m) => !m.end_date || klDay(m.end_date) >= D.today());
  if (team.length) { const ids = [...new Set(team.map(klPersonFromIsa))]; cur.team = ids.includes("me") ? ids : ["me", ...ids]; team.forEach((m) => { const pid = klPersonFromIsa(m, 0); const pp = S.people.find((x) => x.id === pid); if (pp && m.role) pp.role = m.role; }); }
  if (cur.manager && !cur.team.includes(cur.manager)) cur.team.push(cur.manager);
  KPJ.detail[p.id] = Date.now();
  if (/^#\/projects/.test(location.hash)) rerender();
}
// status changes go to KEBS (the app keeps its own rule: only the assignee or the PM can change a task)
async function klTaskSend(p, t, status, prev) {
  try {
    const j = await klPost("pm/planning/updateMyTaskStatus", { projectId: p.kebs.project, itemId: p.kebs.item, taskIds: t.kebsId, statusId: KL_TK_ID[status], actualStartDate: null, actualEndDate: null });
    if (j?.messType !== "S") throw new Error(klMsg(j) || "KEBS didn’t update the task");
  } catch (e) { t.status = prev; save(); rerender(); toast(e.message, "bad"); }
}
{
  const prevToggle = ACTIONS.tkToggle;
  act("tkToggle", (b, e) => {
    const p = pjOf(b.dataset.p), t = tkOf(p, b.dataset.t);
    if (!klOn() || !t?.kebsId) return prevToggle(b, e);
    const prev = t.status; prevToggle(b, e); if (t.status !== prev) klTaskSend(p, t, t.status, prev);
  });
  const prevSet = ACTIONS.tkSet;
  act("tkSet", (b, e) => {
    const [p, t] = tkFrom(b);
    if (!klOn() || !t?.kebsId || b.dataset.k !== "status") return t?.kebsId && klOn() && b.dataset.k !== "status" ? toast("Change this on KEBS web for now", "info") : prevSet(b, e);
    const prev = t.status; prevSet(b, e); if (t.status !== prev) klTaskSend(p, t, t.status, prev);
  });
  ["tkAdd", "tkRename", "tkDue", "tkPick", "tkLog"].forEach((n) => {
    const orig = ACTIONS[n]; if (!orig) return;
    act(n, (b, e) => { const p = pjOf(b?.dataset?.p) || pjOf((location.hash.match(/projects\/([^/?]+)/) || [])[1]); if (klOn() && p?.kebs) return toast(n === "tkAdd" ? "Add tasks on KEBS web for now" : "Change this on KEBS web for now", "info"); return orig(b, e); });
  });
}
ROUTES.forEach((r) => {
  const src = r.re.source; if (!src.startsWith("^projects")) return;
  const prev = r.render;
  r.render = (m, q, ...rest) => {
    if (!klOn()) return prev(m, q, ...rest);
    klPjLoad();
    if (!KPJ.at) return `<div class="screen">${topbar("Projects")}<div class="scroll">${klBar()}${klSkel(4)}</div></div>`;
    const id = m?.id; const p = id && S.pj[id];
    if (p?.kebs) { klPjDetail(p); klPjTasks(p, 2); }
    if (id && !p) return `<div class="screen">${topbar("Project")}<div class="scroll">${klBar()}${emptyState(["briefcase"], "Project not found", "It may not be visible to you in KEBS.")}</div></div>`;
    const out = prev(m, q, ...rest);
    if (src === "^projects$" && !Object.keys(S.pj).length && typeof out === "string") return out.replace('<div class="scroll">', `<div class="scroll">${klBar()}<div class="banner">${I("info")}<span class="grow">${esc(KPJ.err || "KEBS shows no projects for this account.")}</span></div>`);
    return typeof out === "string" ? out.replace('<div class="scroll">', `<div class="scroll">${klBar()}`) : out;
  };
});
{ const prevEnd3 = klEnd; klEnd = function (...a) { klPjSwapOut(); return prevEnd3(...a); }; }
