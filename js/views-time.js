// My Apps hub · Attendance · Time logs · Raise request (WFH / partial / on duty / regularize) · Request history + detail

const TILE_MS = { file: "request", history: "logs", fingerprint: "attend", list: "balances", calendar: "leave", coffee: "compoff", clipboard: "timesheet", alert: "alert", wallet: "track", scan: "scan", receipt: "bills", chart: "insights", payslip: "payslip", tax: "tax" };
const tileBtn = (icon, tint, t, s, attr) => `<button class="card tile" ${attr}><span class="tico ms">${msIcon(/holiday/i.test(t) ? "holidays" : TILE_MS[icon] || "more")}</span><span class="tt">${t}</span><span class="ts">${s}</span></button>`;
function reqCard(r) {
  const T2 = REQ_TYPES[r.type];
  const label = r.type === "leave" ? LEAVE_TYPES.find((l) => l.id === r.leaveType)?.name || "Leave" : T2.name;
  return `<button class="card hrow" data-go="#/request/${r.id}"><span class="li" style="padding:0;border:0"><span class="ic tint ${T2.tint}">${I(r.type === "leave" ? leaveIcon(r.leaveType) : T2.icon)}</span></span><span class="grow"><span class="small muted" style="display:block">${esc(label)}</span><b>${D.range(r.from, r.to)}</b> <span class="small muted">(${r.dayType === "half" ? "½ day" : plural(D.days(r.from, r.to), "day")})</span></span>${statusChip(r.status)}</button>`;
}

// ── My Apps ──
route("apps", (_, q) => {
  const tab = q.tab || "time";
  let body = "";
  if (tab === "time") {
    const pend = pendingRequests();
    body = `<div class="sec"><h2>Pending approval (${pend.length})</h2><button class="link" data-go="#/requests?f=pending">View all</button></div>
      ${pend.length ? reqCard(pend[0]) : emptyMini("checkCircle", "Nothing waiting on approval — you’re all set.")}
      <div class="sec"><h2>Attendance</h2></div>
      <div class="grid2">
        ${tileBtn("file", "t-green", "Raise request", "Request WFH, on duty and partial day.", `data-act="raiseReq"`)}
        ${tileBtn("history", "t-teal", "Logs and shifts", "View all attendance logs here.", `data-go="#/logs"`)}
        ${tileBtn("fingerprint", "t-blue", "Today’s attendance", "Clock in, clock out and today’s logs.", `data-go="#/attendance"`)}
        ${tileBtn("list", "t-red", "Request history", "View history for attendance requests.", `data-go="#/requests"`)}
      </div>
      <div class="sec"><h2>Leave</h2></div>
      <div class="grid2">
        ${tileBtn("calendar", "t-red", "Apply leave", "Apply for your next leave here.", `data-go="#/leave/apply"`)}
        ${tileBtn("list", "t-blue", "Leave balances", "View balances, history and transactions.", `data-go="#/leave/balances"`)}
        ${tileBtn("coffee", "t-amber", "Comp off", "Request comp off, view comp-off history.", `data-go="#/compoff"`)}
        ${tileBtn("calendar", "t-orange", "Holidays", `Next: ${esc(nextHoliday()?.name || "—")}`, `data-go="#/holidays"`)}
      </div>
      <div class="sec"><h2>Projects</h2></div>
      <div class="grid2">
        ${tileBtn("briefcase", "t-blue", "My projects", `${pjList().filter((p) => p.status === "active" && p.team.includes("me")).length} active · progress, budget and team.`, `data-go="#/projects"`)}
        ${tileBtn("checkCircle", "t-violet", "My tasks", (() => { const o = myTasks().filter((x) => x.t.status !== "done"), od = o.filter((x) => x.t.due && x.t.due < D.today()).length; return `${o.length} open${od ? ` · ${od} overdue` : ""}.`; })(), `data-go="#/projects?tab=tasks"`)}
      </div>
      ${can("crm") ? `<div class="sec"><h2>Sales</h2></div>
      <div class="grid2">
        ${tileBtn("target", "t-blue", "CRM pipeline", (() => { const o = S.crm ? S.crm.deals.filter((d) => ["qualify", "discovery", "proposal", "negotiation"].includes(d.stage)) : []; return `${o.length} open deals · ${typeof crmAmt === "function" ? crmAmt(o.reduce((x, d) => x + d.value, 0)) : ""} in pipeline.`; })(), `data-go="#/crm"`)}
        ${tileBtn("users", "t-violet", "Leads & contacts", (() => { const n = S.crm ? S.crm.leads.filter((l) => l.status === "new").length : 0; return `${n} new lead${n === 1 ? "" : "s"} to follow up.`; })(), `data-go="#/crm?tab=leads"`)}
      </div>` : ""}
      <div class="sec"><h2>Timesheet</h2></div>
      <div class="grid2">
        ${tileBtn("clipboard", "t-green", "Submit timesheet", "Add daily tasks, submit and view past timesheets.", `data-go="#/ts"`)}
        ${tileBtn("alert", "t-amber", "Rejected entries", "View rejected entries and resubmit them.", `data-go="#/ts/history?f=rejected"`)}
      </div>`;
  } else if (tab === "finances") {
    const pending = expList().filter((e) => e.status === "pending").reduce((a, e) => a + e.amount, 0);
    const month = D.today().slice(0, 7);
    const approved = expList().filter((e) => e.status === "approved" && e.date.startsWith(month)).reduce((a, e) => a + e.amount, 0);
    const hols = holidays().filter((h) => h.date >= D.today()).slice(0, 3);
    const mon = D.f(D.today(), { month: "short" });
    const pN = expList().filter((e) => e.status === "pending").length, aN = expList().filter((e) => e.status === "approved" && e.date.startsWith(month)).length;
    const rs = (n) => `<span class="pc-cur">₹</span>${Number(n).toLocaleString("en-IN")}`;
    body = `<a class="paycard" href="#/expenses" aria-label="Pending payout ${money(pending)}, view claims">
        <div class="pc-top"><span class="pc-ic">${I("wallet")}</span><span class="pc-lbl">Pending payout</span><span class="pc-chip">${I("clock")}${plural(pN, "claim")}</span></div>
        <div class="pc-amt">${rs(pending)}</div>
        <div class="pc-foot"><span class="pc-sub">${I("checkCircle")}<span>Approved in ${mon}</span><b>${rs(approved)}</b><em>· ${plural(aN, "claim")}</em></span><span class="pc-go">${I("chevR")}</span></div>
      </a>
      <div class="sec"><h2>Payroll</h2></div>
      <div class="grid2">
        ${tileBtn("payslip", "t-green", "Salary slips", "Monthly slips, PDFs and pay changes.", `data-go="#/pay"`)}
        ${tileBtn("tax", "t-blue", "Tax & declarations", "Regime, TDS, proofs and Form 16.", `data-go="#/tax"`)}
      </div>
      <div class="sec"><h2>Expenses</h2></div>
      <div class="grid2">
        ${tileBtn("wallet", "t-amber", "Track expense", "Claims, statuses and receipts.", `data-go="#/expenses"`)}
        ${tileBtn("scan", "t-blue", "Scan bill", "Snap a receipt to start a claim.", `data-go="#/expenses/new?mode=single"`)}
        ${tileBtn("receipt", "t-pink", "Saved receipts", "Receipts waiting to be claimed.", `data-go="#/expenses?tab=saved"`)}
        ${tileBtn("chart", "t-violet", "Expense insights", "Where your spend goes.", `data-go="#/expenses?tab=insights"`)}
      </div>
      <div class="sec"><h2>Upcoming holidays</h2><button class="link" data-go="#/holidays">View all</button></div>
      <div class="card"><div class="list">${hols.map((h) => `<div class="li"><span class="daycell"><small>${D.f(h.date, { month: "short" }).toUpperCase()}</small><b>${D.parse(h.date).getDate()}</b></span><span class="grow"><span class="t" style="display:block">${esc(h.name)}</span><span class="s">${D.dayName(h.date)}</span></span>${h.floater ? `<span class="chip vio">Floater</span>` : ""}</div>`).join("") || emptyMini("calendar", "No more public holidays this year.")}</div></div>`;
  } else if (tab === "performance") {
    const pr = S.praises.me;
    body = `<div class="sec"><h2>Praises (${pr.length})</h2><button class="link" data-go="#/profile">View all</button></div>
      ${pr[0] ? `<div class="card praise"><div class="hrow">${avatar(pr[0].from, "sm")}<span class="grow"><b style="display:block">${esc(person(pr[0].from).name)}</b><span class="tiny muted">${esc(person(pr[0].from).role)}</span></span><span class="tiny faint">${D.long(pr[0].date)}</span></div><span class="badge-praise">${I("award")}${esc(pr[0].badge)}</span><span class="small">${esc(pr[0].text)}</span></div>` : emptyMini("award", "No praises yet. Recognition from teammates shows up here.")}
      <button class="btn outline block" style="margin-top:10px" data-act="praisePick">${I("award")}Give a praise</button>
      <div class="sec"><h2>My goals</h2><span class="small muted">This quarter</span></div>
      <div class="stack">${S.goals.map((g) => `<div class="card hrow"><span class="prog-ring" style="--p:${g.p}" data-l="${g.p}%"></span><span class="grow"><b style="display:block">${esc(g.title)}</b><span class="small muted">${g.p >= 100 ? "Completed" : "In progress"}</span></span><div class="stack s6"><button class="ib sm" data-act="goalStep" data-id="${g.id}" data-d="10" aria-label="Increase progress">${I("plus")}</button><button class="ib sm" data-act="goalStep" data-id="${g.id}" data-d="-10" aria-label="Decrease progress">${I("chevD")}</button></div></div>`).join("")}</div>`;
  } else {
    body = `<div class="card accent hrow" style="margin-top:6px"><span class="tico ms help-ic">${msIcon("helpdesk")}</span><span class="grow"><b style="display:block">Need help?</b><span class="small muted">IT, payroll, facilities or HR — we’ll route it.</span></span><button class="btn primary sm" data-act="newTicket">Raise ticket</button></div>
      <div class="sec"><h2>My tickets</h2></div>
      <div class="stack">${S.tickets.map((t) => `<button class="card stack s6" data-act="openTicket" data-id="${t.id}"><div class="hrow"><span class="small muted grow">${t.id} · ${esc(t.cat)}</span>${statusChip(t.status)}</div><b>${esc(t.subject)}</b><span class="tiny faint">Raised ${D.ago(t.ts)} ago</span></button>`).join("") || emptyState(["ticket", "help", "msg"], "No tickets", "Anything you raise shows up here.")}</div>`;
  }
  return `<div class="screen">
    <div class="big-title"><h1>My apps</h1><p>Time, money, growth and help — in one place.</p></div>
    ${seg([["time", "Time"], ["finances", "Finances"], ["performance", "Performance"], ["helpdesk", "Helpdesk"]], tab, "appsTab")}
    <div class="scroll">${body}</div></div>`;
}, { dock: "apps" });
act("appsTab", (b) => swap(`#/apps?tab=${b.dataset.v}`));
act("goalStep", (b) => { const g = S.goals.find((x) => x.id === b.dataset.id); g.p = Math.max(0, Math.min(100, g.p + Number(b.dataset.d))); save(); rerender(); if (g.p === 100) toast("Goal completed 🎉"); });
act("praisePick", () => pickOption({ title: "Praise a teammate", options: S.people.map((p) => ({ v: p.id, label: p.name, sub: p.role })), onPick: (id) => go(`#/people/${id}?praise=1`) }));
act("newTicket", () => {
  let cat = "IT Support";
  const s = openSheet({
    title: "Raise a ticket",
    body: `<div class="stack s16"><div class="field"><span class="lbl">Category</span><div class="choices" data-cats>${["IT Support", "Payroll", "Facilities", "HR"].map((c) => `<button class="choice ${c === cat ? "on" : ""}" data-s="cat" data-v="${c}">${c}</button>`).join("")}</div></div>
      <div class="field"><label for="tk-s">Subject</label><input id="tk-s" class="inp" data-subj placeholder="Ex: Laptop battery drains quickly"></div>
      <div class="field"><label for="tk-b">Describe the issue <span class="opt">(optional)</span></label><textarea id="tk-b" class="inp" data-body placeholder="Steps, error messages, anything that helps"></textarea></div></div>`,
    foot: `<button class="btn primary block" data-s="send">Submit ticket</button>`,
    onMount(el) {
      onS(el, {
        cat(b) { cat = b.dataset.v; el.querySelectorAll("[data-cats] .choice").forEach((x) => x.classList.toggle("on", x.dataset.v === cat)); },
        send() {
          const subject = el.querySelector("[data-subj]").value.trim();
          if (!subject) { el.querySelector("[data-subj]").focus(); toast("Add a subject", "bad"); return; }
          S.tickets.unshift({ id: "HD-" + (1043 + S.tickets.length), cat, subject, body: el.querySelector("[data-body]").value.trim(), status: "open", ts: Date.now() });
          save(); closeSheet(s); rerender(); toast("Ticket raised");
        },
      });
    },
  });
});
act("openTicket", (b) => {
  const t = S.tickets.find((x) => x.id === b.dataset.id);
  const s = openSheet({ title: `${t.id}`, body: `<div class="stack"><div class="hrow"><span class="chip">${esc(t.cat)}</span>${statusChip(t.status)}</div><b style="font-size:17px">${esc(t.subject)}</b><p class="muted">${esc(t.body || "No description added.")}</p><span class="tiny faint">Raised ${new Date(t.ts).toLocaleString("en-GB")}</span></div>`,
    foot: t.status === "open" ? `<button class="btn ok block" data-s="res">${I("check")}Mark as resolved</button>` : "",
    onMount(el) { onS(el, { res() { t.status = "resolved"; save(); closeSheet(s); rerender(); toast("Ticket resolved"); } }); } });
});

// ── Raise request picker ──
act("raiseReq", () => {
  const s = openSheet({ title: "Raise request for", body: `<div class="list">${[["wfh", "Work From Home (WFH)", "home"], ["partial", "Partial Day", "clock"], ["onduty", "On Duty", "briefcase"], ["regularize", "Attendance Regularization", "calendar"]].map(([k, l, ic]) => `<button class="li" data-s="go" data-v="${k}"><span class="ic tint ${REQ_TYPES[k].tint}">${I(ic)}</span><span class="t grow">${l}</span><span class="chev">${I("chevR")}</span></button>`).join("")}</div>`,
    onMount(el) { onS(el, { go(b) { closeSheet(s); go(`#/req/${b.dataset.v}`); } }); } });
});

// ── Attendance (today or a given day) ──
function dayLog(d) {
  if (d === D.today()) { const t = S.att.today; return t.inTs ? { in: hhmm(t.inTs), out: t.outTs ? hhmm(t.outTs) : null, live: !t.outTs } : null; }
  return S.att.logs[d] || null;
}
function hoursOf(log) {
  if (!log?.in) return { eff: 0, gross: 0 };
  const outM = log.out ? toMin(log.out) : log.live ? toMin(hhmm(Date.now())) : toMin(log.in);
  const gross = Math.max(0, outM - toMin(log.in));
  return { gross, eff: Math.max(0, gross - (gross > 300 ? 50 : 0)) };
}
route("attendance", (_, q) => {
  const d = q.d || D.today(), isToday = d === D.today();
  const log = dayLog(d), h = hoursOf(log);
  const req = S.requests.find((r) => r.from <= d && r.to >= d && ["wfh", "onduty", "partial", "regularize", "leave"].includes(r.type) && r.status !== "withdrawn");
  const hol = holidays().find((x) => x.date === d);
  const t = S.att.today;
  return `<div class="screen">${topbar(isToday ? "Attendance – Today" : `Attendance – ${D.short(d)}`, { right: `<button class="ib" data-act="raiseReq" aria-label="Raise request">${I("plus")}</button>` })}
  <div class="scroll"><div class="stack">
    <div class="card stack">
      <div><b>${D.f(d, { day: "2-digit", month: "short" })}</b> <span class="muted">${D.dayName(d)}</span><div class="tiny muted">${SHIFT.name.toUpperCase()} (${D.hm(SHIFT.start)} – ${D.hm(SHIFT.end)})</div></div>
      <div class="grid2"><div><span class="eyebrow">Clock in</span><div class="timer" style="font-size:22px;margin-top:4px;color:${log?.in ? "var(--ok)" : "var(--ink-3)"}">${D.hm(log?.in)}</div></div><div class="right"><span class="eyebrow">Clock out</span><div class="timer" style="font-size:22px;margin-top:4px;color:${log?.out ? "var(--ok)" : "var(--ink-3)"}">${D.hm(log?.out)}</div></div></div>
      <div class="divider" style="margin:2px 0"></div>
      <div class="hrow small"><span class="grow muted">Effective hours <b style="color:var(--ink)">${fmtMin(h.eff)}</b></span><span class="muted">Gross hours <b style="color:var(--ink)">${fmtMin(h.gross)}</b></span></div>
      ${isToday ? (!t.inTs ? `<button class="btn primary block" data-act="clockToggle">${I("fingerprint")}Clock in</button>` : !t.outTs ? `<div class="hrow"><span class="timer grow" data-live="worked">${fmtClock(workedSec())}</span><button class="btn danger fill" data-act="clockToggle">Clock out</button></div>` : `<button class="btn ghost block" data-act="resumeShift">Resume shift</button>`) : ""}
      ${req ? `<div class="banner ${req.status === "approved" ? "ok" : "warn"}"><span class="grow">${REQ_TYPES[req.type].short} request ${req.status}</span><button class="link" data-go="#/request/${req.id}">View request</button></div>` : ""}
      ${hol ? `<div class="banner info">${I("calendar")}${esc(hol.name)} – public holiday</div>` : ""}
    </div>
    ${log ? `<div class="sec" style="margin-top:12px"><span class="eyebrow">Time logs</span></div>
      <div class="card stack s6"><b class="small">${esc(fullName().split(" ")[0])}</b>
        <div class="hrow small b" style="color:var(--ok)">${I("arrowIn")}${D.hm(log.in)} <span class="muted" style="font-weight:600">· In</span></div>
        ${log.out ? `<div class="hrow small b" style="color:var(--accent)">${I("arrowOut")}${D.hm(log.out)} <span class="muted" style="font-weight:600">· Out</span></div>` : log.live ? `<div class="hrow small b" style="color:var(--accent)">${I("clock")}Currently clocked in</div>` : `<div class="hrow small b" style="color:var(--danger)">${I("arrowOut")}OUT missing <button class="link" style="margin-left:auto" data-go="#/req/regularize?d=${d}">Regularize</button></div>`}
      </div>` : emptyState(["calendar", "clock", "fingerprint"], "No logs!", D.isWeekend(d) ? "It’s a weekly off." : "No attendance logs for this day. A few options you can explore:", `<div style="margin-top:16px"><button class="btn outline" data-act="raiseReq">More options</button></div>`)}
  </div></div></div>`;
});

// ── Time logs ──
route("logs", () => {
  const today = D.today();
  const days = [];
  for (let d = today; d >= D.add(today, -38); d = D.add(d, -1)) if (!D.isWeekend(d)) days.push(d);
  const regs = new Set(S.requests.filter((r) => r.type === "regularize" && r.status === "approved").map((r) => r.from));
  const leaves = S.requests.filter((r) => r.type === "leave" && r.status === "approved");
  let month = "", html = "";
  for (const d of days) {
    const m = D.f(d, { month: "long", year: "numeric" });
    if (m !== month) { month = m; html += `<div class="or" style="margin:18px 0 10px">${m}</div>`; }
    const log = dayLog(d), h = hoursOf(log), hol = holidays().find((x) => x.date === d), lv = leaves.find((r) => r.from <= d && r.to >= d);
    const late = log?.in ? toMin(log.in) - toMin(SHIFT.start) : 0;
    const chip = !log ? "" : late > 10 ? `<span class="chip warn">${late}m late</span>` : `<span class="chip ok">On time</span>`;
    html += `<button class="card stack s6" style="margin-bottom:10px" data-go="#/attendance?d=${d}">
      <div class="hrow"><b class="grow">${D.f(d, { weekday: "short", day: "2-digit" })}${log?.wfh ? ` <span class="small" style="color:var(--warn)">· Work from home</span>` : ""}</b>${chip}</div>
      <span class="tiny muted">${SHIFT.name.toUpperCase()} (${D.hm(SHIFT.start)} – ${D.hm(SHIFT.end)})</span>
      ${hol ? `<span class="small b" style="color:var(--accent)">${esc(hol.name)} · Holiday</span>` : lv ? `<span class="small b" style="color:var(--violet)">On leave</span>` : !log ? `<span class="small b" style="color:var(--danger)">No time entries logged</span>` : `
        <div class="grid2 small"><div><span class="tiny muted">Clock in</span><div class="b" style="color:${late > 10 ? "var(--danger)" : "var(--ok)"}">${D.hm(log.in)}</div></div><div class="right"><span class="tiny muted">Clock out</span><div class="b" style="color:${log.out ? "var(--ok)" : log.live ? "var(--accent)" : "var(--danger)"}">${log.out ? D.hm(log.out) : log.live ? "On the clock" : "OUT missing"}</div></div></div>
        ${regs.has(d) ? `<div class="banner ok" style="padding:6px 10px;justify-content:center;font-size:12px">Attendance adjusted</div>` : ""}
        <div class="grid2 tiny muted"><span>Effective hours <b style="color:var(--ink)">${fmtMin(h.eff)}</b></span><span class="right">Gross hours <b style="color:var(--ink)">${fmtMin(h.gross)}</b></span></div>`}
    </button>`;
  }
  return `<div class="screen">${topbar("Time logs")}<div class="scroll" data-lazy="10">${html}</div></div>`;
});

// ── Request history + detail ──
function activityFeed(r) {
  const mgr = S.me.manager;
  const when = (ts) => new Date(ts).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const ev = r.activity.slice().reverse().map((x) => {
    const byMgr = /approved|rejected by/i.test(x.text);
    const ic = x.kind === "ok" ? ["checkCircle", "t-green"] : x.kind === "bad" ? ["x", "t-red"] : /comment/i.test(x.text) ? ["msg", "t-blue"] : ["send", "t-orange"];
    return { who: byMgr ? mgr : "me", ic, title: x.text, ts: x.ts };
  });
  if (r.status === "pending") ev.unshift({ who: mgr, ic: ["clock", "t-amber"], title: "Waiting for approval", sub: `${person(mgr).name} · ${person(mgr).role}`, pending: true });
  return `<div class="feed">${ev.map((e) => `<div class="fd ${e.pending ? "pending" : ""}">
    <div class="fd-av">${avatar(e.who)}<span class="fd-badge ${e.ic[1]}">${I(e.ic[0])}</span></div>
    <div class="grow" style="min-width:0"><b class="fd-t">${esc(e.title)}</b><span class="small muted" style="display:block">${e.sub ? esc(e.sub) : esc(e.who === "me" ? "You" : person(e.who).name)}${e.ts ? ` · ${when(e.ts)}` : ""}</span></div>
  </div>`).join("")}</div>`;
}
route("requests", (_, q) => {
  const f = q.f || "all";
  const list = S.requests.filter((r) => f === "all" || r.status === f).sort((a, b) => b.created - a.created);
  return `<div class="screen">${topbar("Request history", { right: `<button class="ib" data-act="raiseReq" aria-label="Raise request">${I("plus")}</button>` })}
    ${seg([["all", "All"], ["pending", "Pending"], ["approved", "Approved"], ["withdrawn", "Withdrawn"]], f, "reqFilter")}
    <div class="scroll"><div class="stack" data-lazy="8">${list.map(reqCard).join("") || emptyState(["file", "list", "checkCircle"], "Nothing here", "Requests you raise will show up in this list.")}</div></div></div>`;
});
act("reqFilter", (b) => swap(`#/requests?f=${b.dataset.v}`));

route("request/:id", ({ id }, q) => {
  const r = S.requests.find((x) => x.id === id);
  if (!r) return `<div class="screen">${topbar("Request")}${emptyState(["file"], "Request not found", "It may have been removed.")}</div>`;
  const T2 = REQ_TYPES[r.type];
  const lt = r.type === "leave" ? LEAVE_TYPES.find((l) => l.id === r.leaveType)?.name : null;
  const banner = { pending: `<div class="banner warn">${I("clock")}Approval pending</div>`, approved: `<div class="banner ok">${I("checkCircle")}Approved</div>`, rejected: `<div class="banner bad">${I("x")}Rejected</div>`, withdrawn: `<div class="banner info">${I("info")}Withdrawn by you</div>` }[r.status];
  const extra = [
    lt && ["Leave type", lt], r.partialType && ["Partial day type", r.partialType], r.lateBy && [r.partialType === "Early departure" ? "Leaving early by" : "Late by", `${r.lateBy} minutes`],
    r.regType && ["Type", r.regType], r.inTime && ["In time", D.hm(r.inTime)], r.outTime && ["Out time", D.hm(r.outTime)],
  ].filter(Boolean);
  return `<div class="screen has-foot">${topbar(`${T2.name} request`)}
  <div class="scroll"><div class="stack">
    ${banner}
    <div class="sec" style="margin-top:8px"><h2>${T2.name} details</h2></div>
    <div class="card accent hrow"><span class="i" style="color:var(--accent);width:22px;height:22px">${I("calendar")}</span><span class="grow"><b style="display:block">${D.range(r.from, r.to)}</b><span class="small muted">${r.dayType === "half" ? "Half day" : plural(D.days(r.from, r.to), "day")}</span></span></div>
    ${extra.length ? `<div class="card">${extra.map(([k, v]) => `<div class="kv"><span>${k}</span><span>${esc(v)}</span></div>`).join("")}</div>` : ""}
    <div class="stack s6" style="margin-top:6px"><b class="small">Note added by you</b><span>${esc(r.reason || "—")}</span></div>
    ${r.attachments.length ? `<div class="stack s6"><b class="small">Attachments</b>${attachList(r.attachments)}</div>` : ""}
    ${r.notify.length ? `<div class="stack s6"><b class="small">Notified</b><div class="av-stack">${r.notify.map((p) => avatar(p, "sm")).join("")}</div></div>` : ""}
    ${r.comments.map((c) => `<div class="comment">${avatar("me", "sm")}<div class="bubble"><div class="hrow"><b class="grow">You</b><span class="tiny faint">${D.ago(c.ts)}</span></div>${esc(c.text)}</div></div>`).join("")}
    ${r.status === "pending" ? `<button class="link" style="align-self:flex-start" data-act="reqComment" data-id="${r.id}">+ Add comment</button>` : ""}
    <div class="sec"><h2>Activity</h2></div>
    ${activityFeed(r)}
  </div></div>
  <div class="foot">${q.new ? `<div class="banner ok">${I("checkCircle")}${T2.short} request submitted successfully!</div>` : ""}${r.status === "pending" ? `<button class="btn danger block" data-act="withdrawReq" data-id="${r.id}">Withdraw request</button>` : `<button class="btn ghost block" data-go="#/requests">All requests</button>`}</div></div>`;
});
act("withdrawReq", (b) => confirmSheet({ eyebrow: "Withdraw", text: "Withdraw this request? Your approver will be notified.", ok: "Yes, withdraw", danger: true, onOk() {
  const r = S.requests.find((x) => x.id === b.dataset.id); r.status = "withdrawn"; r.activity.push({ text: "Withdrawn by you", ts: Date.now(), kind: "bad" }); save(); swap(`#/request/${r.id}`); toast("Request withdrawn");
} }));
act("reqComment", (b) => {
  const s = openSheet({ title: "Add comment", body: `<textarea class="inp" data-t placeholder="Add context for your approver"></textarea>`, foot: `<button class="btn primary block" data-s="ok">Add comment</button>`,
    onMount(el) { onS(el, { ok() { const v = el.querySelector("[data-t]").value.trim(); if (!v) return; const r = S.requests.find((x) => x.id === b.dataset.id); r.comments.push({ text: v, ts: Date.now() }); r.activity.push({ text: "Comment added", ts: Date.now(), kind: "" }); save(); closeSheet(s); rerender(); } }); } });
});

// ── Request forms ──
const FORM_META = {
  wfh: { title: "Work From Home Request", cta: "Request work from home", kind: "WFH", note: "An email with WFH details will be sent to your teammates once this request is approved." },
  onduty: { title: "On Duty Request", cta: "Request on duty", kind: "on duty", note: "An email with on-duty details will be sent to your teammates once this request is approved." },
  partial: { title: "Partial Day Request", cta: "Request partial day", kind: "partial day", note: "An email with partial-day details will be sent to your teammates once this request is approved." },
  regularize: { title: "Attendance Regularization", cta: "Request", kind: "", note: "" },
};
route("req/:type", ({ type }, q) => {
  const M = FORM_META[type]; if (!M) return "";
  const yest = (() => { let d = D.add(D.today(), -1); while (D.isWeekend(d)) d = D.add(d, -1); return d; })();
  const F = draft("req-" + type, { from: q.d || (type === "regularize" ? yest : type === "partial" ? D.today() : null), to: q.d || (type === "regularize" ? yest : type === "partial" ? D.today() : null), dayType: "full", reason: "", notify: [], attachments: [], partialType: "Late arrival", lateBy: "30", regType: "Adjustment", inTime: "", outTime: "" });
  let fields = "";
  if (type === "wfh" || type === "onduty") {
    fields = `${rangeField("reqDates", F.from, F.to, { dayType: F.dayType })}
      <div class="field"><label for="f-r">Reason <span class="req" aria-label="required">*</span></label><input id="f-r" class="inp" data-bind="reason" value="${esc(F.reason)}" placeholder="${type === "wfh" ? "Reason for WFH" : "Ex: Travelling to Delhi office to attend a meeting"}"></div>
      ${type === "onduty" ? `<div class="field"><span class="lbl">Attachments <span class="req" aria-label="required">*</span></span>${attachList(F.attachments, "reqDetach")}<button class="link" style="align-self:flex-start" data-act="reqAttach">+ Add attachments</button><span class="tiny faint">PDF, JPEG or PNG up to 5 MB.</span></div>` : ""}
      <div class="stack s6"><span class="lbl">Also on ${M.kind} during this period</span>${alsoAway(F.from, F.to, M.kind)}</div>`;
  } else if (type === "partial") {
    fields = `<button class="range-box" data-act="reqDay" style="grid-template-columns:1fr auto"><div><div class="k">SELECTED DAY</div><div class="v" style="color:var(--accent)">${D.nice(F.from)}</div></div>${I("calendar")}</button>
      <span class="tiny muted" style="margin-top:-8px">${SHIFT.name.toUpperCase()} (${D.hm(SHIFT.start)} – ${D.hm(SHIFT.end)})</span>
      <div class="field"><span class="lbl">Partial day type</span><button class="inp sel" data-act="reqPartialType"><span>${esc(F.partialType)}</span>${I("chevD")}</button></div>
      <div class="field"><label for="f-l">${F.partialType === "Early departure" ? "Leaving early by" : F.partialType === "Mid-day break" ? "Away for" : "Late by"} (minutes)</label><input id="f-l" class="inp" type="number" min="5" max="240" step="5" data-bind="lateBy" value="${esc(F.lateBy)}"></div>
      <div class="field"><label for="f-r">Reason <span class="req" aria-label="required">*</span></label><input id="f-r" class="inp" data-bind="reason" value="${esc(F.reason)}" placeholder="Ex: Doctor’s appointment"></div>`;
  } else {
    const log = dayLog(F.from), h = hoursOf(log);
    if (!F.inTime) { F.inTime = log?.in || SHIFT.start; F.outTime = log?.out || SHIFT.end; }
    fields = `<button class="range-box" data-act="reqDay" style="grid-template-columns:1fr auto"><div><div class="k">DAY TO REGULARIZE</div><div class="v" style="color:var(--accent)">${D.nice(F.from)}</div></div>${I("calendar")}</button>
      <div class="field"><span class="lbl">Type</span><button class="inp sel" data-act="reqRegType"><span>${esc(F.regType)}</span>${I("chevD")}</button></div>
      <div class="stack s6"><b class="small">Add/update time entries to adjust attendance logs</b><div class="hrow tiny muted"><span class="grow">Effective hours <b style="color:var(--ink)">${fmtMin(h.eff)}</b></span><span>Gross hours <b style="color:var(--ink)">${fmtMin(h.gross)}</b></span></div></div>
      <div class="card grid2"><div class="field"><label for="f-in">${I("arrowIn")} In time</label><input id="f-in" class="inp" type="time" data-bind="inTime" value="${F.inTime}"></div><div class="field"><label for="f-out">${I("arrowOut")} Out time</label><input id="f-out" class="inp" type="time" data-bind="outTime" value="${F.outTime}"></div></div>
      <div class="field"><label for="f-r">Note <span class="req" aria-label="required">*</span></label><input id="f-r" class="inp" data-bind="reason" value="${esc(F.reason)}" placeholder="Ex: Biometric did not work"></div>`;
  }
  const notify = type === "regularize" ? "" : notifyField(F.notify, "reqNotify", M.note);
  const foot = type === "regularize"
    ? `<div class="row-btns"><button class="btn outline" data-act="back">Cancel</button><button class="btn primary" data-act="reqSubmit" data-type="${type}" data-cta>${M.cta}</button></div>`
    : `<button class="btn primary block" data-act="reqSubmit" data-type="${type}" data-cta>${M.cta}</button>`;
  return `<div class="screen has-foot">${topbar(M.title)}<div class="scroll"><div class="stack s16" style="padding-top:6px">${fields}${notify}</div></div><div class="foot">${foot}</div></div>`;
}, {
  mount({ type }) {
    FORM_CHECK = () => {
      const F = DRAFT, b = $("[data-cta]"); if (!F || !b) return;
      let ok = !!F.from && F.reason.trim().length > 0;
      if (type === "onduty") ok = ok && F.attachments.length > 0;
      if (type === "partial") ok = ok && Number(F.lateBy) > 0;
      if (type === "regularize") ok = ok && F.inTime && F.outTime && F.inTime < F.outTime;
      b.disabled = !ok;
    };
    FORM_CHECK();
  },
});
act("reqDates", () => { const F = DRAFT; pickDates({ title: "Select dates", start: F.from, end: F.to, dayType: F.dayType, half: F._k === "req-wfh", onDone({ start, end, dayType }) { F.from = start; F.to = end; F.dayType = dayType; rerender(); } }); });
act("reqDay", () => { const F = DRAFT; pickDates({ title: "Select day", mode: "single", start: F.from, onDone({ start }) { F.from = F.to = start; F.inTime = ""; F.outTime = ""; rerender(); } }); });
act("reqNotify", () => { const F = DRAFT; pickPeople({ selected: F.notify, onDone(ids) { F.notify = ids; rerender(); } }); });
act("reqAttach", () => { const F = DRAFT; pickFile(".pdf,.jpg,.jpeg,.png", (f) => { if (f.bytes > 5e6) return toast(`${f.name} is over 5 MB`, "bad"); F.attachments.push({ name: f.name, size: f.size }); rerender(); }); });
act("reqDetach", (b) => { DRAFT.attachments.splice(Number(b.dataset.i), 1); rerender(); });
act("reqPartialType", () => pickOption({ title: "Partial day type", value: DRAFT.partialType, options: ["Late arrival", "Early departure", "Mid-day break"].map((v) => ({ v, label: v })), onPick(v) { DRAFT.partialType = v; rerender(); } }));
act("reqRegType", () => pickOption({ title: "Regularization type", value: DRAFT.regType, options: [["Adjustment", "Fix wrong in/out times"], ["Missed punch", "Forgot to clock in or out"], ["Biometric failure", "Device didn’t record"]].map(([v, sub]) => ({ v, label: v, sub })), onPick(v) { DRAFT.regType = v; rerender(); } }));
act("reqSubmit", (b) => {
  const F = DRAFT, type = b.dataset.type; if (b.disabled) return;
  const clash = S.requests.find((r) => r.type === type && r.status === "pending" && r.from <= F.to && r.to >= F.from);
  if (clash) return toast("You already have a pending request for these dates", "bad");
  const r = { id: uid(), type, from: F.from, to: F.to, dayType: F.dayType, reason: F.reason.trim(), notify: F.notify, attachments: F.attachments, comments: [], status: "pending", created: Date.now(), activity: [{ text: "Request raised by you", ts: Date.now(), kind: "on" }] };
  if (type === "partial") Object.assign(r, { partialType: F.partialType, lateBy: F.lateBy, dayType: "half" });
  if (type === "regularize") Object.assign(r, { regType: F.regType, inTime: F.inTime, outTime: F.outTime });
  S.requests.push(r); save(); DRAFT = null;
  swap(`#/request/${r.id}?new=1`);
});
