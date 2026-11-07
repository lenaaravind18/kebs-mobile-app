// Notifications: one kebsNotify() for every event in the app.
// · In the foreground: a banner at the top (styled like the iOS / Android notification), stacked when several arrive.
// · In the background: a real system notification (Android app via KebsNative; browsers via the Notification API).
// · Reminders (clock in, timesheet, CRM meetings, tasks due) are scheduled natively so they fire when the app is closed.
// · Every notification also lands in Alerts. Each category can be switched off in Settings → Notifications.
// A server can later send push (FCM) into the same categories.

const NOTIFY_CATS = {
  approvals: { name: "Approvals", icon: "inbox", sub: "Requests waiting on you and decisions on yours" },
  expenses: { name: "Expenses", icon: "receipt", sub: "Receipts read, claims submitted and paid" },
  chat: { name: "Chat & mentions", icon: "msg", sub: "Replies and @mentions in project and deal chats" },
  tasks: { name: "Tasks & projects", icon: "clipboard", sub: "Tasks assigned to you and due today" },
  crm: { name: "Sales & CRM", icon: "target", sub: "Meetings, follow-ups and deal updates" },
  reminders: { name: "Reminders", icon: "clock", sub: "Clock in and timesheet nudges" },
};
const NOTIFY_KIND = { approvals: "approve", expenses: "expense", chat: "mention", tasks: "assign", crm: "reminder", reminders: "reminder" };
if (typeof PI_KIND !== "undefined") PI_KIND.expense = { label: "Expense", icon: "receipt" };

const nset = () => (S.settings.notif ||= { on: true, cats: {} });
const catOn = (c) => nset().on && nset().cats[c] !== false;
const hasNative = () => typeof window.KebsNative?.notify === "function";
function notifyPermission() {
  if (hasNative()) { try { return KebsNative.notifyStatus(); } catch { return "default"; } }
  return "Notification" in window ? Notification.permission : "unsupported";
}
function requestNotifyPermission() {
  if (hasNative()) { try { KebsNative.requestNotify(); } catch {} return; }
  if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().then(() => rerender());
}
addEventListener("kebsnotify", () => { if (/settings\/notifications/.test(location.hash)) rerender(); });
const nid = (s) => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h % 2000000000) + 10; };

// open the screen a notification is about (also called by the Android app when one is tapped)
window.kebsOpen = (route) => { if (!route || !/^#\//.test(route)) return; if (location.hash !== route) go(route); else rerender(); };

/** kebsNotify({ cat, title, body, route, quietOn, who }) — quietOn: skip the banner while you're already on that screen */
function kebsNotify({ cat = "approvals", title, body = "", route = "#/notifs", quietOn, who, alert = true }) {
  const n = { id: uid(), kind: NOTIFY_KIND[cat] || "reminder", who, html: `<b>${esc(title)}</b>${body ? ` — ${esc(body)}` : ""}`, ts: Date.now(), read: false, go: route, push: true };
  if (alert) { S.notifs.unshift(n); save(); }
  if (!catOn(cat)) return;
  const hidden = document.visibilityState === "hidden";
  if (!hidden) {
    if (quietOn && hpath(location.hash) === quietOn) return;
    return notifyBanner({ title, body, route, n });
  }
  if (hasNative()) { try { KebsNative.notify(nid(n.id), cat, title, body, route); } catch {} }
  else if ("Notification" in window && Notification.permission === "granted") {
    try { const x = new Notification(title, { body, icon: "icon.svg", badge: "icon.svg", tag: n.id }); x.onclick = () => { focus(); kebsOpen(route); x.close(); }; } catch {}
  }
}

// ── in-app banner (stacked like the system ones) ──
const NB = { list: [], timer: 0 };
function notifyBanner(x) {
  NB.list.unshift(x); NB.list = NB.list.slice(0, 4);
  let el = $("#nbanner");
  if (!el) { el = document.createElement("div"); el.id = "nbanner"; el.setAttribute("role", "status"); el.setAttribute("aria-live", "polite"); $("#shell").append(el); nbWire(el); }
  const top = NB.list[0], more = NB.list.length - 1;
  el.innerHTML = `<button class="nb-card" data-r="${esc(top.route)}">
      <span class="nb-head"><img src="icon.svg" alt=""><span class="grow">KEBS</span><span class="nb-time">now</span></span>
      <b class="nb-t">${esc(top.title)}</b>${top.body ? `<span class="nb-b">${esc(top.body)}</span>` : ""}
      ${more ? `<span class="nb-more">${plural(more, "more notification")}</span>` : ""}
    </button>${more ? `<i class="nb-layer l1"></i>${more > 1 ? `<i class="nb-layer l2"></i>` : ""}` : ""}`;
  el.classList.remove("out"); void el.offsetWidth; el.classList.add("in");
  try { navigator.vibrate?.([10, 40, 10]); } catch {}
  clearTimeout(NB.timer); NB.timer = setTimeout(nbHide, 5200);
}
function nbHide() { const el = $("#nbanner"); if (!el) return; el.classList.add("out"); el.classList.remove("in"); setTimeout(() => { NB.list = []; el.innerHTML = ""; }, 260); }
function nbWire(el) {
  let y0 = null;
  el.addEventListener("pointerdown", (e) => { y0 = e.clientY; clearTimeout(NB.timer); });
  el.addEventListener("pointerup", (e) => {
    const dy = y0 == null ? 0 : e.clientY - y0; y0 = null;
    if (dy < -24) return nbHide(); // swipe up to dismiss
    const c = e.target.closest(".nb-card"); if (c) { nbHide(); kebsOpen(c.dataset.r); return; }
    NB.timer = setTimeout(nbHide, 3000);
  });
}

// ── scheduled reminders (native; while open in a browser, a timer covers the next few hours) ──
function reminderList() {
  const out = [], now = Date.now(), at = (date, hm) => { const [h, m] = (hm || "09:00").split(":").map(Number); const d = D.parse(date); d.setHours(h, m, 0, 0); return d.getTime(); };
  const td = D.today();
  // clock in at shift start on the next working day you haven't clocked in
  if (catOn("reminders") && typeof SHIFT !== "undefined") {
    for (let i = 0; i < 4; i++) {
      const d = D.add(td, i); if (D.isWeekend(d)) continue;
      if (i === 0 && S.att?.today?.inTs) continue;
      const t = at(d, SHIFT.start); if (t > now) { out.push({ cat: "reminders", title: "Time to clock in", body: `Your ${SHIFT.name || "general"} shift starts at ${D.hm(SHIFT.start)}.`, route: "#/clockin", at: t, key: "clock" + d }); break; }
    }
    // timesheet: Friday 4 PM
    const fri = D.add(D.monday(td), 4), tf = at(fri, "16:00");
    if (tf > now) out.push({ cat: "reminders", title: "Submit your timesheet", body: "This week’s timesheet is due today. Add any missing hours first.", route: "#/ts", at: tf, key: "ts" + fri });
  }
  // CRM: 10 minutes before a timed activity, 9 AM on the day for the rest
  if (catOn("crm") && S.crm) S.crm.acts.filter((a) => !a.done && a.due && a.due >= td).forEach((a) => {
    const t = a.time ? at(a.due, a.time) - 10 * 60e3 : at(a.due, "09:00");
    if (t > now) out.push({ cat: "crm", title: a.time ? `${ACT_T[a.type][0]} in 10 minutes` : `Due today: ${a.title}`, body: a.time ? `${a.title} · ${crmRefName(a.ref).split(" · ")[0]}` : crmRefName(a.ref).split(" · ")[0], route: crmRefHref(a.ref), at: t, key: "crm" + a.id });
  });
  // tasks due today: 9 AM
  if (catOn("tasks") && typeof myTasks === "function") {
    const due = myTasks().filter((x) => x.t.status !== "done" && x.t.due === td), t = at(td, "09:00");
    if (due.length && t > now) out.push({ cat: "tasks", title: `${plural(due.length, "task")} due today`, body: due.map((x) => x.t.title).slice(0, 2).join(", "), route: "#/projects?tab=tasks", at: t, key: "tasks" + td });
  }
  return out.filter((r) => r.at - now < 7 * 864e5).map((r) => ({ ...r, id: nid(r.key) }));
}
let NB_TIMERS = [];
function syncReminders() {
  const list = nset().on ? reminderList() : [];
  if (typeof window.KebsNative?.syncSchedule === "function") { try { KebsNative.syncSchedule(JSON.stringify(list)); } catch {} return; }
  NB_TIMERS.forEach(clearTimeout); NB_TIMERS = [];
  list.filter((r) => r.at - Date.now() < 6 * 36e5).forEach((r) => NB_TIMERS.push(setTimeout(() => kebsNotify(r), r.at - Date.now())));
}
{ const base = save; let t = 0; save = function () { base.apply(this, arguments); clearTimeout(t); t = setTimeout(syncReminders, 800); }; }
setTimeout(syncReminders, 1500);
// opened from a notification while the app was closed
setTimeout(() => { try { const r = window.KebsNative?.takeLaunchRoute?.(); if (r) kebsOpen(r); } catch {} }, 900);

// ── Settings → Notifications ──
route("settings/notifications", () => {
  const p = notifyPermission(), on = nset().on;
  const perm = p === "granted" ? "" : p === "unsupported" ? `<div class="banner info">${I("info")}This browser can’t show notifications. You’ll still see them inside KEBS and in Alerts.</div>`
    : `<div class="card nf-perm"><span class="nf-perm-ic">${I("bell")}</span><span class="grow"><b>${p === "denied" ? "Notifications are blocked" : "Turn on notifications"}</b><span class="small muted">${p === "denied" ? "Allow them for KEBS in your phone’s settings so approvals and reminders reach you." : "Get approvals, mentions and reminders even when KEBS is closed."}</span></span></div>
       <button class="btn primary block" data-act="nfAllow">${p === "denied" ? "Open notification settings" : "Allow notifications"}</button>`;
  return settingsPage("Notifications", `${perm}
    <div class="card hrow" style="margin-top:14px"><span class="grow"><b style="display:block">Notifications</b><span class="small muted">${on ? "On for the categories below" : "Off — you’ll only see them in Alerts"}</span></span><button class="switch" role="switch" aria-checked="${on}" aria-label="Notifications" data-act="nfAll"></button></div>
    <div class="sec"><h2>Notify me about</h2></div>
    <div class="card list nf-cats">${Object.entries(NOTIFY_CATS).map(([k, c]) => `<div class="li"><span class="ic">${I(c.icon)}</span><span class="grow"><span class="t" style="display:block">${c.name}</span><span class="s">${c.sub}</span></span><button class="switch" role="switch" aria-checked="${on && catOn(k)}" ${on ? "" : "disabled"} aria-label="${c.name}" data-act="nfCat" data-c="${k}"></button></div>`).join("")}</div>
    <button class="btn outline block" style="margin-top:16px" data-act="nfTest">${I("bell")}Send a test notification</button>
    <p class="tiny muted" style="text-align:center;margin-top:8px">Sent in 5 seconds — switch to another app to see it as a phone notification.</p>`);
});
act("nfAllow", () => requestNotifyPermission());
act("nfAll", () => { nset().on = !nset().on; save(); rerender(); });
act("nfCat", (b) => { const c = nset().cats; c[b.dataset.c] = c[b.dataset.c] === false; save(); rerender(); });
act("nfTest", () => { toast("Test notification in 5 seconds"); setTimeout(() => kebsNotify({ cat: "expenses", title: "Expense analyzed successfully", body: "Uber · ₹507 · ready to submit", route: "#/expenses", alert: false }), 5000); });

// ask once, gently, after sign-in
setTimeout(() => {
  if (!S.authed || S.settings.notifAsked || notifyPermission() !== "default" || hpath(location.hash) !== "home") return;
  S.settings.notifAsked = true; save();
  const s = openSheet({ title: "", body: `<div class="nf-ask"><span class="nf-ask-ic">${I("bell")}</span><h2>Never miss an approval</h2><p class="muted">KEBS can notify you about approvals, mentions, receipts that are ready and reminders to clock in — even when the app is closed.</p></div>`,
    foot: `<div class="row-btns"><button class="btn outline" style="flex:1" data-s="no">Not now</button><button class="btn primary" style="flex:1" data-s="yes">Turn on</button></div>`,
    onMount(el) { onS(el, { no() { closeSheet(s); }, yes() { closeSheet(s); requestNotifyPermission(); } }); } });
}, 4000);
