// Support desk: the KEBS support team's ticket app on the phone. Same flow as the Support dashboard on the web:
// dashboard numbers and views → a ticket (overview, conversation, AI assist) → change its status with a reason,
// reply in public or post a private note, and email the requester or the assignee from templates.

const SUP_PRI = ["Critical", "High", "Medium", "Low"];
const SUP_ST = ["Open", "Reopened", "In Progress", "On Hold", "Resolved", "Closed"];
const SUP_OPEN = ["Open", "Reopened", "In Progress", "On Hold"];
const SUP_SLA = { Critical: 4, High: 8, Medium: 16, Low: 32 }; // resolution, working hours
const SUP_RESP = { Critical: 1, High: 2, Medium: 4, Low: 8 };
const SUP_AGE = { Critical: 8, High: 16, Medium: 32, Low: 64 };
const SUP_STC = { Open: "#3b82f6", Reopened: "#f97316", "In Progress": "#8b5cf6", "On Hold": "#f59e0b", Resolved: "#16a34a", Closed: "#94a3b8" };
const SUP_PRC = { Critical: "#ef4444", High: "#f97316", Medium: "#eab308", Low: "#22c55e" };
const SUP_ST_IC = { Open: "inbox", Reopened: "refresh", "In Progress": "play", "On Hold": "clock", Resolved: "checkCircle", Closed: "archive" };
const SUP_REASONS = {
  Open: ["New information received", "Back in the queue"],
  Reopened: ["Issue still happens", "Fix did not work", "Same issue again"],
  "In Progress": ["Work started", "Analysis started", "Fix in development"],
  "On Hold": ["Waiting for customer", "Waiting on third party", "Planned for a release", "Needs approval"],
  Resolved: ["Fixed", "Workaround given", "Configuration changed", "Data corrected"],
  Closed: ["Confirmed by customer", "No response from customer", "Duplicate", "Not an issue", "Cancelled by customer"],
};
const SUP_RES_TYPES = ["Configuration", "Data Correction", "Code Fix", "User Training", "Duplicate", "No Issue Found", "Workaround"];
const SUP_CUST = {
  zifo: { name: "Zifo", pre: "ZIF", dom: "zifornd.com", people: ["Priya Raman", "Arjun Mehta", "Kavya Iyer", "Rohit Sharma"] },
  maveric: { name: "Maveric", pre: "MAV", dom: "maveric-systems.com", people: ["Sneha Kulkarni", "Vikram Rao", "Ananya Das", "Karthik Nair"] },
  agilisium: { name: "Agilisium", pre: "AGL", dom: "agilisium.com", people: ["Meera Pillai", "Siddharth Jain", "Divya Menon", "Rahul Verma"] },
  stellium: { name: "Stellium", pre: "STL", dom: "stellium.com", people: ["Nisha Reddy", "Aditya Joshi", "Pooja Bhat", "Manoj Kumar"] },
  congruent: { name: "Congruent", pre: "CGT", dom: "congruentsolutions.com", people: ["Lakshmi Srinivasan", "Varun Gupta", "Ishita Roy", "Deepak Shetty"] },
};
const SUP_AGENTS = ["Aravind S", "Deepa Krishnan", "Harish Babu", "Janani Mohan", "Naveen Prakash", "Revathi Sundar", "Suresh Kannan", "Uma Shankar"];
const SUP_MODS = ["Timesheets", "Billing", "Invoicing", "Project Setup", "Resource Allocation", "Reports", "Integrations", "User Access"];
const SUP_TITLES = [
  ["Project budget not updating after approval", "Issue"], ["Backfill missing timesheet entries for September", "Data Request", "Data Fix"],
  ["Duplicate entries in utilisation report", "Issue"], ["Approval workflow stuck at manager stage", "Issue"], ["SSO login redirects to blank page", "Issue"],
  ["Rate card changes not applied to new timesheets", "Issue"], ["Export of billable hours for Q3 audit", "Data Request", "New Request"],
  ["Report export to Excel times out", "Issue"], ["Invoice PDF shows incorrect tax amount", "Issue"], ["Historical invoice data extract (FY25)", "Data Request", "New Request"],
  ["Integration sync with SAP failing overnight", "Issue"], ["List of inactive users for licence review", "Data Request", "Support"],
  ["Currency conversion wrong on cross-border invoice", "Issue"], ["Update billing rates for renewed contract", "Data Request", "Data Fix"],
  ["Email notifications not sent for approvals", "Issue"], ["Add a new cost centre to project setup", "Data Request", "Enhancement"],
];
const SUP_VIEWS = [["open", "Open tickets", "inbox"], ["mine", "My queue", "user"], ["breached", "SLA breached", "alert"], ["today", "Breaching today", "clock"],
  ["unassigned", "Unassigned", "users"], ["done", "Resolved & closed", "checkCircle"], ["all", "All tickets", "list"]];

// ── helpers ──
const supR = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 10000) / 10000; };
const supPick = (a, s) => a[Math.floor(supR(s) * a.length)];
const supMe = () => (typeof fullName === "function" ? fullName() : "Me");
const supFirst = (n) => String(n || "").split(/\s+/)[0];
const supMail = (name, dom = "kaartech.com") => `${String(name).toLowerCase().replace(/[^a-z\s]/g, "").trim().split(/\s+/).join(".")}@${dom}`;
const supReqMail = (t) => supMail(t.req, SUP_CUST[t.cust].dom);
const supDT = (ts) => { const d = new Date(ts); const h = d.getHours() % 12 || 12; return `${String(d.getDate()).padStart(2, "0")}-${MONTHS_S[d.getMonth()]}-${String(d.getFullYear()).slice(2)} ${String(h).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() < 12 ? "AM" : "PM"}`; };
const MONTHS_S = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const supTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const supDur = (ms) => { const m = Math.round(ms / 60000); return m < 60 ? `${Math.max(1, m)}m` : m < 48 * 60 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };
const supHue = (s) => Math.round(supR(s) * 360);
const supAv = (name, cls = "") => `<span class="sup-av ${cls}" style="--h:${supHue(name)}" aria-hidden="true">${esc(initials(name || "?"))}</span>`;
// add working hours (Mon–Fri, 09:00–17:00)
function supAddWork(ts, h) {
  let d = new Date(ts), left = h * 60;
  for (let g = 0; left > 0 && g < 500; g++) {
    const day = d.getDay(), hr = d.getHours() + d.getMinutes() / 60;
    if (day === 0 || day === 6 || hr >= 17) { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); continue; }
    if (hr < 9) { d.setHours(9, 0, 0, 0); continue; }
    const use = Math.min((17 - hr) * 60, left); d = new Date(d.getTime() + use * 60000); left -= use;
  }
  return d.getTime();
}
function supSla(t) {
  if (t.type !== "Issue" || !t.due) return { tone: "none", label: "No SLA" };
  if (!SUP_OPEN.includes(t.status)) return t.resolvedAt && t.resolvedAt <= t.due ? { tone: "met", label: "SLA met" } : { tone: "missed", label: "SLA missed" };
  const diff = t.due - Date.now();
  if (t.status === "On Hold") return { tone: "hold", label: diff < 0 ? "Paused · past due" : "SLA paused" };
  if (diff < 0) return { tone: "breached", label: `Overdue ${supDur(-diff)}` };
  const eod = new Date(); eod.setHours(23, 59, 59, 999);
  return { tone: t.due <= eod.getTime() ? "soon" : "ok", label: `Due in ${supDur(diff)}` };
}
const supBreached = (t) => supSla(t).tone === "breached";
const supToday = (t) => supSla(t).tone === "soon";

// ── sample data, shaped like the KEBS export ──
function supSeed() {
  const now = Date.now(), H = 3600e3, me = supMe(), keys = Object.keys(SUP_CUST), tickets = [], msgs = {};
  for (let i = 0; i < 40; i++) {
    const ck = keys[i % 5], c = SUP_CUST[ck], s = "sup" + i;
    const [title, type, cat = "Issue"] = SUP_TITLES[(i * 7 + Math.floor(i / 5)) % SUP_TITLES.length];
    let pri = supPick(["Critical", "High", "High", "Medium", "Medium", "Medium", "Low", "Low"], s + "p");
    let status = supPick(["Open", "Open", "Open", "In Progress", "In Progress", "In Progress", "On Hold", "Reopened", "Resolved", "Resolved", "Closed", "Closed"], s + "s");
    let created = now - Math.round((0.4 + supR(s + "c") ** 2 * 18 * 24) * H);
    const a = supR(s + "a"); let owner = a < 0.3 ? me : a < 0.4 ? null : supPick(SUP_AGENTS, s + "o");
    if (i === 0) { pri = "High"; status = "Open"; owner = me; created = now - 30 * H; }
    if (i === 1) { pri = "Critical"; status = "In Progress"; owner = me; created = now - 1.5 * H; }
    if (i === 2) { pri = "Critical"; status = "Open"; owner = null; created = now - 0.8 * H; }
    const done = !SUP_OPEN.includes(status), due = type === "Issue" ? supAddWork(created, SUP_SLA[pri]) : null;
    const resolvedAt = done ? Math.min(now - H, created + Math.round((0.1 + supR(s + "d") * 3) * 24 * H)) : null;
    const req = supPick(c.people, s + "r"), module = supPick(SUP_MODS, s + "m"), env = supPick(["Production", "Production", "UAT"], s + "e");
    const t = { id: `${c.pre}-${1100 - i * 3}`, cust: ck, title, type, cat, pri, status, module, owner, req, created, updated: resolvedAt || created + H, due, resolvedAt, env,
      desc: `Hi team,\n\n${title} in ${module} (${env}). ${supPick(["It started after yesterday's release.", "This affects the whole finance team.", "We see it for some users but not all.", "Steps: open the screen, apply the filter, click Save.", "This is blocking our month-end close."], s + "x")}\n\nPlease look into this on priority.\n\nThanks,\n${req}`,
      resType: done ? supPick(SUP_RES_TYPES, s + "rt") : null, rootCause: done ? supPick(["Stale cache on the approval service", "Missing mapping for the new cost centre", "Rate card effective date set in the future", "Batch job timed out on large months"], s + "rc") : "",
      happy: Math.round(70 + supR(s + "h") * 28) };
    tickets.push(t); msgs[t.id] = supThreadSeed(t, s);
  }
  return { tickets, msgs, v: 1 };
}
function supThreadSeed(t, s) {
  const H = 3600e3, by = t.owner || "KEBS Support", m = [{ kind: "event", who: t.req, text: "opened this ticket", at: t.created }];
  const add = (o) => m.push({ kind: "msg", team: "kebs", ...o });
  if (t.owner) m.push({ kind: "event", who: t.owner, text: "was assigned this ticket", at: t.created + 0.3 * H });
  if (t.status !== "Open" || supR(s + "k") > 0.5) add({ who: by, text: `Hi ${supFirst(t.req)},\n\nThanks for raising ${t.id}. We are looking into it and will update you shortly.\n\nRegards,\n${by}`, at: t.created + 0.8 * H });
  if (["In Progress", "Reopened", "Resolved", "Closed"].includes(t.status)) add({ who: by, internal: true, text: `Reproduced on UAT. Checking the ${t.module} job logs — looks related to last week's patch.`, at: t.created + 2 * H });
  if (t.status === "On Hold") {
    add({ who: by, text: `Hi ${supFirst(t.req)},\n\nCould you share a bit more about ${t.id}: what you see, the steps you tried, and a screenshot if possible?`, at: t.created + 3 * H });
    m.push({ kind: "event", who: by, text: "moved this to On Hold · Waiting for customer", at: t.created + 3.1 * H });
  }
  if (t.status === "Reopened") {
    m.push({ kind: "msg", team: "external", who: t.req, text: "The issue happens again today, same screen.", at: Math.max(t.created + 26 * H, Date.now() - 5 * H) });
    m.push({ kind: "event", who: by, text: "moved this to Reopened · Issue still happens", at: Math.max(t.created + 26.2 * H, Date.now() - 4.8 * H) });
  }
  if (t.resolvedAt) {
    add({ who: by, text: `Hi ${supFirst(t.req)},\n\nWe have fixed ${t.id} (${t.title}). Please verify on your side; we will close the ticket if we do not hear back in 2 working days.`, at: t.resolvedAt - 0.2 * H });
    m.push({ kind: "event", who: by, text: `moved this to Resolved · ${t.resType}`, at: t.resolvedAt });
    if (t.status === "Closed") {
      m.push({ kind: "msg", team: "external", who: t.req, text: "Confirmed, it works now. Thanks for the quick help!", at: t.resolvedAt + 3 * H });
      m.push({ kind: "event", who: by, text: "moved this to Closed · Confirmed by customer", at: t.resolvedAt + 3.2 * H });
    }
  }
  if (t.status === "Open" && Date.now() - t.created > 20 * H) m.push({ kind: "msg", team: "external", who: t.req, text: "Any update on this? We need it fixed before the month-end run.", at: Date.now() - 2.5 * H });
  return m.sort((a, b) => a.at - b.at);
}
function supData() {
  if (!(S.sup && S.sup.v === 1)) S.sup = supSeed();
  const d = S.sup; if (!d.filesV) { d.tickets.forEach((t, i) => { t.files ||= supSeedFiles(t, i); }); d.filesV = 1; }
  return d;
}
const supT = (id) => supData().tickets.find((t) => t.id === id);
const supMsgs = (id) => (supData().msgs[id] ||= []);

function supList(view, cust) {
  const me = supMe(), all = supData().tickets.filter((t) => !cust || t.cust === cust), open = all.filter((t) => SUP_OPEN.includes(t.status));
  const list = { open, mine: open.filter((t) => t.owner === me), breached: open.filter(supBreached), today: open.filter(supToday), unassigned: open.filter((t) => !t.owner),
    done: all.filter((t) => !SUP_OPEN.includes(t.status)), all }[view] || open;
  const rank = (t) => ({ breached: 0, soon: 1, ok: 2, hold: 3, none: 4, met: 5, missed: 5 }[supSla(t).tone]);
  return [...list].sort((a, b) => rank(a) - rank(b) || SUP_PRI.indexOf(a.pri) - SUP_PRI.indexOf(b.pri) || (a.due || 9e15) - (b.due || 9e15) || b.created - a.created);
}

// ── ticket row ──
const supRow = (t) => { const sla = supSla(t);
  return `<button class="sup-row" data-go="#/support/t/${t.id}" data-l="${esc((t.id + " " + t.title + " " + t.req + " " + SUP_CUST[t.cust].name + " " + t.module + " " + (t.owner || "")).toLowerCase())}">
    <i class="sup-pbar" style="--c:${SUP_PRC[t.pri]}" title="${t.pri}"></i>
    <span class="grow" style="min-width:0">
      <span class="sup-r1"><span>${t.id} · ${SUP_CUST[t.cust].name}</span><span class="sup-sla ${sla.tone}">${sla.label}</span></span>
      <b class="sup-r2">${esc(t.title)}</b>
      <span class="sup-r3"><span class="sup-st" style="--c:${SUP_STC[t.status]}"><i></i>${t.status}</span><span>${t.pri}</span><span class="ell">${esc(t.module)}</span><span class="sup-own">${t.owner ? supAv(t.owner, "xs") : `<em>Unassigned</em>`}</span></span>
    </span></button>`; };

// ── dashboard ──
let SUP_Q = "";
route("support", (_, q) => {
  if (typeof can === "function" && !can("support")) return roleLocked("Support desk");
  const view = q.v || "open", cust = q.c || "", all = supData().tickets.filter((t) => !cust || t.cust === cust);
  const open = all.filter((t) => SUP_OPEN.includes(t.status)), br = open.filter(supBreached).length, today = open.filter(supToday).length, hold = open.filter((t) => t.status === "On Hold").length;
  const issuesDone = all.filter((t) => t.type === "Issue" && t.resolvedAt), met = issuesDone.length ? Math.round((issuesDone.filter((t) => t.resolvedAt <= t.due).length / issuesDone.length) * 100) : 100;
  const list = supList(view, cust), cnt = (v) => supList(v, cust).length;
  const tile = (v, icon, label, n, c, extra = "") => `<button class="sup-tile ${view === v ? "on" : ""}" data-act="supView" data-v="${v}" style="--c:${c}"><span class="sup-tl">${I(icon)}${label}</span><b class="num">${n}</b>${extra}</button>`;
  const byPri = SUP_PRI.map((p) => [p, open.filter((t) => t.pri === p).length]);
  const mineGroups = view === "mine" ? [["Breaching in under 2 hours", list.filter((t) => supSla(t).tone !== "breached" && t.due && t.due - Date.now() < 2 * 3600e3 && t.status !== "On Hold")], ["Already breached", list.filter(supBreached)]] : [];
  const rest = view === "mine" ? list.filter((t) => !mineGroups.some(([, g]) => g.includes(t))) : list;
  const block = (title, arr) => arr.length ? `${title ? `<div class="sup-gh">${title}<span>${arr.length}</span></div>` : ""}<div class="card sup-list">${arr.map(supRow).join("")}</div>` : "";
  return `<div class="screen">${topbar("Support desk", { sub: cust ? SUP_CUST[cust].name : "KEBS Support", right: `<button class="ib" data-act="supCust" aria-label="Choose customer">${I("building")}</button>` })}
    <div class="scroll"><div class="stack" style="padding-top:4px">
      <div class="card sup-sum">
        <div class="sup-sum-h"><h3>Ticket summary</h3><span class="tiny muted">${plural(all.length, "ticket")}</span></div>
        <div class="sup-tiles">
          ${tile("open", "inbox", "Open", open.length, "#3b82f6")}
          ${tile("today", "clock", "Due today", today, "#f97316")}
          ${tile("breached", "alert", "Breached", br, "#ef4444")}
          ${tile("unassigned", "users", "Unassigned", open.filter((t) => !t.owner).length, "#8b5cf6")}
          ${tile("mine", "user", "My queue", open.filter((t) => t.owner === supMe()).length, "#0ea5e9")}
          <div class="sup-tile wide" style="--c:var(--ok)"><span class="sup-tl">${I("award")}SLA met</span><span class="sup-bar"><i style="width:${met}%"></i></span><b class="num">${met}%</b></div>
        </div>
        <div class="sup-pri">${byPri.map(([p, n]) => `<i style="flex:${n || 0.001};--c:${SUP_PRC[p]}"></i>`).join("")}</div>
        <div class="sup-pri-l">${byPri.map(([p, n]) => `<span><i style="--c:${SUP_PRC[p]}"></i>${p} <b>${n}</b></span>`).join("")}</div>
      </div>
      ${filterHead(SUP_VIEWS.find((v) => v[0] === view)?.[1] || "Open tickets", "supView", view, SUP_VIEWS.map(([v, l, ic]) => [v, l, ic, cnt(v)]), "Show tickets")}
      <label class="searchbox">${I("search")}<input data-sq placeholder="Search ID, title, requester, app" value="${esc(SUP_Q)}" enterkeyhint="search" autocomplete="off"></label>
      ${list.length ? (view === "mine" ? mineGroups.map(([t, g]) => block(t, g)).join("") + block(mineGroups.some(([, g]) => g.length) ? "Everything else open" : "", rest) : block("", list)) : emptyState(["checkCircle"], view === "breached" ? "Nothing has breached" : "No tickets here", view === "mine" ? "Your queue is clear. Pick up an unassigned ticket?" : "Try another view or customer.", view === "mine" ? `<button class="btn primary" data-act="supView" data-v="unassigned">See unassigned</button>` : "")}
      <div class="sup-none" hidden>${emptyMini("search", "No tickets match. Try another word.")}</div>
    </div></div></div>`;
}, {
  parent: "#/home",
  mount() {
    const inp = $("[data-sq]"); if (!inp) return;
    const run = () => { SUP_Q = inp.value; const q = inp.value.trim().toLowerCase(); let any = false;
      $$(".sup-list").forEach((l) => { let n = 0; l.querySelectorAll(".sup-row").forEach((r) => { const ok = !q || r.dataset.l.includes(q); r.hidden = !ok; if (ok) n++; }); l.hidden = !n; const h = l.previousElementSibling; if (h?.classList.contains("sup-gh")) h.hidden = !n; if (n) any = true; });
      const no = $(".sup-none"); if (no) no.hidden = any || !$$(".sup-row").length; };
    inp.addEventListener("input", run); if (SUP_Q) run();
  },
});
const supQ = () => new URLSearchParams((location.hash.split("?")[1]) || "");
act("supView", (b) => { const q = supQ(); q.set("v", b.dataset.v); swap(`#/support?${q}`); });
act("supCust", () => {
  const q = supQ(), cur = q.get("c") || "";
  pickOption({ title: "Customer", value: cur, options: [{ v: "", label: "All customers", icon: "globe" }, ...Object.entries(SUP_CUST).map(([k, c]) => ({ v: k, label: c.name, icon: "building", sub: `${supData().tickets.filter((t) => t.cust === k && SUP_OPEN.includes(t.status)).length} open` }))],
    onPick: (v) => { v ? q.set("c", v) : q.delete("c"); swap(`#/support?${q}`); } });
});

// ── ticket ──
const SUP_DRAFT = {}; let SUP_PV = false;
function supRing(label, used, target, sub, { done = false, text = "" } = {}) {
  const p = done ? 1 : target ? used / target : 0, c = done ? "var(--ok)" : p >= 1 ? "var(--danger)" : p >= 0.75 ? "#f59e0b" : "var(--ok)";
  return `<div class="sup-ring">${progressRing(Math.min(1, p), { size: 58, stroke: 6, color: c, label: text || (done ? "Met" : p >= 1 ? "Late" : `${Math.round(p * 100)}%`) })}<b>${label}</b><small>${sub}</small></div>`;
}
route("support/t/:id", ({ id }, q) => {
  if (typeof can === "function" && !can("support")) return roleLocked("Support desk");
  const t = supT(id);
  if (!t) return `<div class="screen">${topbar("Ticket")}${emptyState(["clipboard"], "Ticket not found", "It may have been merged or removed.", `<button class="btn primary" data-go="#/support">Back to tickets</button>`)}</div>`;
  const tab = q.tab || "overview", c = SUP_CUST[t.cust], sla = supSla(t), H = 3600e3, ms = supMsgs(id);
  const top = topbar(`#${esc(t.id)}`, { sub: c.name, right: `<button class="ib" data-act="supMore" data-id="${id}" aria-label="More actions">${I("dots")}</button>` });
  const tabs = seg([["overview", "Overview"], ["chat", `Chat${ms.filter((m) => m.kind === "msg").length ? ` · ${ms.filter((m) => m.kind === "msg").length}` : ""}`], ["activity", "Activity"], ["ai", "AI"]], tab, "supTab");
  let body = "", foot = "";
  if (tab === "overview") {
    const firstReply = ms.find((m) => m.kind === "msg" && m.team === "kebs"), respUsed = ((firstReply ? firstReply.at : Date.now()) - t.created) / H;
    const resUsed = ((t.resolvedAt || Date.now()) - t.created) / H;
    const reqAll = supData().tickets.filter((x) => x.req === t.req), related = supData().tickets.filter((x) => x.id !== t.id && x.cust === t.cust && x.module === t.module).slice(0, 3);
    const det = [["App Name", t.module], ["Type", t.cat === "Issue" ? "Issue" : `${t.type} · ${t.cat}`], ["Priority", `<span class="sup-pd" style="--c:${SUP_PRC[t.pri]}"><i></i>${t.pri}</span>`, "supPri"], ["Status", `<span class="sup-st" style="--c:${SUP_STC[t.status]}"><i></i>${t.status}</span>`, "supStatus"],
      ["Assigned To", t.owner ? esc(t.owner) : `<em class="muted">Unassigned</em>`, "supAssign"], ["Team", "KEBS Team"], ["Created By", esc(t.req)], ["Created Date", supDT(t.created)], ["Due Date", t.due ? supDT(t.due) : "—"], ["Environment", t.env],
      ...(t.resolvedAt ? [["Resolved On", supDT(t.resolvedAt)], ["Resolution Type", t.resType || "—"], ["Root Cause", esc(t.rootCause || "—")]] : [])];
    body = `<div class="card sup-head">
        <div class="sup-hr"><button class="sup-stb" data-act="supStatus" data-id="${id}" style="--c:${SUP_STC[t.status]}">${I(SUP_ST_IC[t.status])}${t.status}${I("chevD")}</button><span class="sup-pd" style="--c:${SUP_PRC[t.pri]}"><i></i>${t.pri}</span><span class="sup-sla ${sla.tone}">${sla.label}</span></div>
        <h2>${esc(t.title)}</h2>
        <p class="small muted">${c.name} · ${esc(t.module)} · opened ${D.ago(t.created) === "now" ? "just now" : D.ago(t.created) + " ago"}</p>
        ${t.type === "Issue" ? `<div class="sup-rings">${supRing("Response", respUsed, SUP_RESP[t.pri], firstReply ? `replied in ${supDur(respUsed * H)}` : `${SUP_RESP[t.pri]}h target`, { done: !!firstReply && respUsed <= SUP_RESP[t.pri] })}${supRing("Resolution", resUsed, (t.due - t.created) / H || SUP_SLA[t.pri], t.resolvedAt ? "resolved" : `${SUP_SLA[t.pri]} working h`, { done: !!t.resolvedAt && t.resolvedAt <= t.due })}${supRing("Aging", resUsed, SUP_AGE[t.pri], `${SUP_AGE[t.pri]}h limit`, { text: supDur(resUsed * H) })}</div>` : `<p class="tiny muted" style="margin-top:10px">${I("info")} Data requests don't carry an SLA.</p>`}
      </div>
      <div class="sup-acts">
        <button data-act="supStatus" data-id="${id}">${I("refresh")}<span>Status</span></button>
        <button data-act="supAssign" data-id="${id}">${I("user")}<span>${t.owner ? "Reassign" : "Assign"}</span></button>
        <button data-act="supEmail" data-id="${id}" data-m="req">${I("mail")}<span>Email</span></button>
        <button data-act="supTab" data-v="chat">${I("msg")}<span>Reply</span></button>
      </div>
      <div class="card rp-card"><div class="rp-ch"><h3>${I("file")}Description</h3></div><p class="sup-desc">${esc(t.desc)}</p></div>
      ${supFilesCard(t)}
      <div class="card rp-card"><div class="rp-ch"><h3>${I("list")}Details</h3></div><div class="sup-det">${det.map(([k, v, a]) => `<${a ? `button data-act="${a}" data-id="${id}"` : "div"} class="sup-dr"><span>${k}</span><b>${v}</b>${a ? I("chevR") : ""}</${a ? "button" : "div"}>`).join("")}</div></div>
      <button class="card sup-reqc" data-go="#/support/c/${t.cust}/${encodeURIComponent(t.req)}">${supAv(t.req, "md")}<span class="grow" style="min-width:0"><small class="muted">Requester</small><b class="ell" style="display:block">${esc(t.req)}</b><span class="tiny muted">${c.name} · ${reqAll.filter((x) => SUP_OPEN.includes(x.status)).length} open of ${reqAll.length}</span></span>${I("chevR")}</button>
      ${related.length ? `<div class="card rp-card"><div class="rp-ch"><h3>${I("history")}Related tickets</h3></div><div class="sup-list flat">${related.map(supRow).join("")}</div></div>` : ""}`;
  } else if (tab === "chat") {
    // same components as the project team chat (Quick collab): day pills, grouped bubbles, time in the bubble, rounded composer
    const show = q.show || "all", list = ms.filter((m) => show === "all" || (show === "comments" ? m.kind === "msg" : show === "private" ? m.internal : m.kind === "event"));
    let out = "", lastDay = "", prev = null;
    list.forEach((m, i) => {
      const day = D.iso(m.at);
      if (day !== lastDay) { out += `<div class="pc-day"><span>${D.diff(day, D.today()) < 2 && typeof dayLabel === "function" ? dayLabel(day) : D.nice(day)}</span></div>`; lastDay = day; prev = null; }
      if (m.kind === "event") { out += `<div class="pc-day sup-sys"><span><b>${esc(m.who === supMe() ? "You" : m.who)}</b> ${esc(m.text)} · ${supTime(m.at)}</span></div>`; prev = null; return; }
      // internal notes: a note card (not a chat bubble) on the author's side, with their avatar, so they never read as a reply to the customer
      if (m.internal) {
        const nm = m.who === supMe();
        out += `<div class="pc-msg sup-nrow ${nm ? "me" : ""}">${nm ? avatar("me", "sm") : supAv(m.who, "pc")}<div class="pc-col"><div class="sup-note ${nm ? "me" : ""}"><div class="sup-note-h">${I("lock")}<b>Internal note</b><span class="ell">${esc(nm ? "You" : m.who)} · ${supTime(m.at)}</span></div>
          ${supMsgFiles(t, m)}${m.text ? `<p>${esc(m.text).split("\n").join("<br>")}</p>` : ""}<small class="sup-note-f">Only the KEBS team can see this</small></div></div></div>`;
        prev = null; return;
      }
      const next = list[i + 1], mine = m.who === supMe();
      const cont = prev && prev.who === m.who && m.at - prev.at < 6e5;
      const endGroup = !next || next.kind !== "msg" || next.internal || next.who !== m.who || next.at - m.at >= 6e5 || D.iso(next.at) !== day;
      const meta = `<span class="pc-bt">${m.internal ? "Private · " : ""}${supTime(m.at)}</span>`;
      out += `<div class="pc-msg ${mine ? "me" : ""} ${cont ? "cont" : ""}">
        ${endGroup ? (mine ? avatar("me", "sm") : supAv(m.who, "pc")) : `<span class="pc-av-sp"></span>`}
        <div class="pc-col"><div class="pc-bub ${m.internal ? "sup-pv" : ""}">
          ${!mine && !cont ? `<b class="pc-bn sup-bn" style="--h:${supHue(m.who)}">${esc(m.who)}<span class="pc-role"> · ${m.team === "kebs" ? "KEBS" : esc(SUP_CUST[t.cust].name)}</span></b>` : ""}
          ${m.internal && !cont ? `<span class="sup-pvl">${I("lock")}Private note · only the KEBS team sees this</span>` : ""}
          ${supMsgFiles(t, m)}
          ${m.text ? `<p>${esc(m.text).split("\n").join("<br>")}${meta}</p>` : meta.replace('class="pc-bt"', 'class="pc-bt solo"')}
        </div></div></div>`;
      prev = m;
    });
    body = `${filterHead("Conversation", "supShow", show, [["all", "Everything", "list"], ["comments", "Comments", "msg"], ["private", "Private notes", "lock"], ["history", "History", "history"]], "Show")}
      ${list.length ? out : `<div class="pc-empty">${emptyState(["msg"], "No messages yet", "Reply to the customer or leave a private note for the team. Type / for canned replies.")}</div>`}`;
    // same input box as the Kais chat: text on top, small actions and the send arrow underneath
    const cf = SUP_CFILES[id] || [];
    foot = `<form class="kcomposer sup-cmp ${SUP_PV ? "pv" : ""}" onsubmit="return false"><div class="kbox">
      ${cf.length ? `<div class="kattach">${cf.map((f, j) => `<div class="kfile">${f.src ? `<img class="sup-fthumb" src="${f.src}" alt="">` : fileIcon(f.name)}<span class="grow" style="min-width:0"><b class="ell">${esc(f.name)}</b><small>${esc(f.size)}</small></span><button type="button" data-act="supUnattach" data-id="${id}" data-i="${j}" aria-label="Remove ${esc(f.name)}">${I("x")}</button></div>`).join("")}</div>` : ""}
      <textarea rows="1" maxlength="4000" placeholder="${SUP_PV ? "Private note…" : "Reply to customer…"}" aria-label="Message" enterkeyhint="send">${esc(SUP_DRAFT[id] || "")}</textarea>
      <div class="hrow">
        <button type="button" class="sup-vis" data-act="supVis" aria-label="${SUP_PV ? "Private note — tap for a public reply" : "Public reply — tap for a private note"}">${I(SUP_PV ? "lock" : "globe")}<span>${SUP_PV ? "Private" : "Public"}</span></button>
        <button type="button" class="ib sm" data-act="supAttach" data-id="${id}" aria-label="Attach files">${I("clip")}</button>
        <button type="button" class="ib sm sup-slash" data-act="supCanned" data-id="${id}" aria-label="Canned replies">/</button>
        <span class="grow"></span>
        <button type="button" class="ksend" data-act="supSend" data-id="${id}" aria-label="Send">${I("arrowUp")}</button>
      </div></div></form>`;
  } else if (tab === "activity") {
    // activity log: every change to the ticket as a timeline (Milestones or All changes, like the web dashboard)
    const mode = q.mode || "all", rows = supActivity(t).filter((r) => mode === "all" || r.ms);
    const first = ms.find((m) => m.kind === "msg" && m.team === "kebs" && !m.internal);
    body = `<div class="card sup-ast">
        <div><span>Age</span><b>${supDur((t.resolvedAt || Date.now()) - t.created)}</b></div>
        <div><span>First response</span><b>${first ? supDur(first.at - t.created) : "—"}</b></div>
        <div><span>Changes</span><b>${supActivity(t).length}</b></div>
      </div>
      ${filterHead("Activity", "supMode", mode, [["all", "All changes", "list"], ["ms", "Milestones", "milestone"]], "Show")}
      ${rows.length ? `<div class="card sup-feed"><div class="feed">${rows.slice().reverse().map((r) => { const mine = r.who === supMe();
        return `<div class="fd"><div class="fd-av">${mine ? avatar("me") : supAv(r.who, "fd")}<span class="fd-badge ${SUP_TINT[r.c] || "t-slate"}">${I(r.ic)}</span></div>
          <div class="grow" style="min-width:0"><b class="fd-t">${esc(mine ? "You" : r.who)} ${r.html}</b>${r.snip ? `<span class="small muted sup-fsnip">${esc(r.snip)}</span>` : ""}
          <span class="small muted" style="display:block">${D.ago(r.at) === "now" ? "Just now" : D.ago(r.at) + " ago"} · ${supDT(r.at)}</span></div></div>`; }).join("")}</div></div>` : emptyMini("history", "Nothing logged yet.")}`;
  } else {
    const a = supAssist(t);
    body = `<div class="card rp-card"><div class="rp-ch"><h3>${I("info")}Where it stands</h3></div><p class="sup-p">${a.stand}</p><p class="tiny muted">${a.last}</p></div>
      <div class="card rp-card"><div class="rp-ch"><h3>${I("target")}Likely root cause</h3><span class="tiny muted">${a.conf}</span></div><p class="sup-p"><b>${a.cause}</b></p><p class="tiny muted">${a.why}</p></div>
      <div class="card rp-card"><div class="rp-ch"><h3>${I("sparkles")}Suggested reply</h3></div><p class="sup-desc">${esc(a.reply)}</p>
        <div class="row-btns" style="margin-top:12px"><button class="btn outline" style="flex:1" data-act="supUseReply" data-id="${id}">${I("msg")}Use in reply</button><button class="btn primary" style="flex:1" data-act="supEmail" data-id="${id}" data-m="req" data-ai="1">${I("mail")}Email it</button></div></div>
      <div class="card rp-card"><div class="rp-ch"><h3>${I("history")}Similar tickets</h3></div>${a.similar.length ? `<div class="sup-list flat">${a.similar.map(([x, p]) => `<button class="sup-sim" data-go="#/support/t/${x.id}"><b class="sup-pct ${p >= 80 && SUP_OPEN.includes(x.status) ? "dup" : ""}">${p}%</b><span class="grow" style="min-width:0"><b class="ell" style="display:block">${esc(x.title)}</b><span class="tiny muted">${x.id} · ${x.status}${x.resType ? ` · ${x.resType}` : ""}${p >= 80 && SUP_OPEN.includes(x.status) ? " · possible duplicate" : ""}</span></span>${I("chevR")}</button>`).join("")}</div>` : emptyMini("search", "No similar tickets found.")}</div>`;
  }
  return `<div class="screen sup-t">${top}<div class="sup-tabs">${tabs}</div>${tab === "chat" ? `<div class="pc-wrap"><div class="scroll pc-thread" data-sup-scroll>${body}</div></div>` : `<div class="scroll" data-sup-scroll><div class="stack" style="padding-top:2px">${body}</div></div>`}${foot}</div>`;
}, {
  parent: () => "#/support",
  mount({ id }, q) {
    const sc = $("[data-sup-scroll]"); if ((q.tab || "") === "chat" && sc) sc.scrollTop = sc.scrollHeight;
    const ta = $(".sup-cmp textarea"); if (!ta) return;
    const grow = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; }; grow();
    ta.addEventListener("input", () => { SUP_DRAFT[id] = ta.value; grow(); if (ta.value === "/") { ta.value = ""; SUP_DRAFT[id] = ""; supCanned(id); } });
  },
});
act("supTab", (b) => { const id = location.hash.match(/support\/t\/([^?]+)/)?.[1]; if (id) swap(`#/support/t/${id}${b.dataset.v === "overview" ? "" : `?tab=${b.dataset.v}`}`); });
act("supShow", (b) => { const id = location.hash.match(/support\/t\/([^?]+)/)?.[1]; if (id) swap(`#/support/t/${id}?tab=chat&show=${b.dataset.v}`); });
act("supVis", () => {
  SUP_PV = !SUP_PV; const box = $(".sup-cmp"); if (!box) return;
  box.classList.toggle("pv", SUP_PV); box.querySelector(".sup-vis").innerHTML = I(SUP_PV ? "lock" : "globe") + `<span>${SUP_PV ? "Private" : "Public"}</span>`;
  box.querySelector("textarea").placeholder = SUP_PV ? "Private note…" : "Reply to customer…";
  toast(SUP_PV ? "Private note · only the KEBS team sees this" : "Public reply · the customer sees this", "info");
});
act("supSend", (b) => {
  const id = b.dataset.id, ta = $(".sup-cmp textarea"), text = ta?.value.trim(), files = SUP_CFILES[id] || [];
  if (!text && !files.length) { ta?.focus(); return; }
  const t = supT(id);
  supMsgs(id).push({ kind: "msg", team: "kebs", who: supMe(), text: text || "", at: Date.now(), internal: SUP_PV, ...(files.length ? { files } : {}) });
  files.forEach((f) => { f.from = SUP_PV ? "Private note" : "Chat"; (t.files ||= []).push(f); });
  t.updated = Date.now(); SUP_DRAFT[id] = ""; SUP_CFILES[id] = []; save(); rerender();
  try { navigator.vibrate?.(10); } catch {}
  toast(files.length && !text ? `${plural(files.length, "file")} shared` : SUP_PV ? "Private note added" : "Reply posted");
});
act("supUseReply", (b) => { SUP_DRAFT[b.dataset.id] = supAssist(supT(b.dataset.id)).reply; SUP_PV = false; swap(`#/support/t/${b.dataset.id}?tab=chat`); });

// canned replies ("/")
const SUP_CANNED = [
  ["ack", "Acknowledge", "Hi {{first}},\n\nThanks for raising {{id}}. We are looking into it and will update you shortly.\n\nRegards,\n{{me}}"],
  ["moreinfo", "Need more details", "Hi {{first}},\n\nCould you share a bit more about {{id}}: what you see, the steps you tried, and a screenshot if possible? That will help us reproduce it.\n\nRegards,\n{{me}}"],
  ["access", "Access granted", "Hi {{first}},\n\nAccess for {{app}} has been granted. Please log out and log in again, then let us know if it works.\n\nRegards,\n{{me}}"],
  ["fixed", "Fixed, please verify", "Hi {{first}},\n\nWe have fixed {{id}} ({{title}}). Please verify on your side; we will close the ticket if we do not hear back in 2 working days.\n\nRegards,\n{{me}}"],
  ["followup", "Gentle follow-up", "Hi {{first}},\n\nJust following up on {{id}}. Could you confirm whether the issue is resolved on your side?\n\nRegards,\n{{me}}"],
  ["close", "Closing", "Hi {{first}},\n\nAs confirmed, we are closing {{id}}. Feel free to raise a new ticket if anything else comes up.\n\nRegards,\n{{me}}"],
];
const supFill = (s, t) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => ({ first: supFirst(t.req), requester: t.req, id: t.id, title: t.title, customer: SUP_CUST[t.cust].name, app: t.module, priority: t.pri, status: t.status, assignee: t.owner || "Unassigned", due: t.due ? supDT(t.due) : "—", me: supMe() }[k] ?? ""));
function supCanned(id) {
  const t = supT(id);
  pickOption({ title: "Canned replies", options: SUP_CANNED.map(([k, l, s]) => ({ v: k, label: `/${k} · ${l}`, icon: "msg", sub: supFill(s, t).split("\n").filter(Boolean)[1]?.slice(0, 70) + "…" })),
    onPick: (k) => { SUP_DRAFT[id] = supFill(SUP_CANNED.find((c) => c[0] === k)[2], t); rerender(); setTimeout(() => $(".sup-cmp textarea")?.focus(), 60); } });
}
act("supCanned", (b) => supCanned(b.dataset.id));

const SUP_TINT = { "#3b82f6": "t-blue", "#f97316": "t-orange", "#8b5cf6": "t-violet", "#f59e0b": "t-amber", "#16a34a": "t-green", "#94a3b8": "t-slate", "#0ea5e9": "t-teal", "#64748b": "t-slate", "#ef4444": "t-red" };
// the ticket's activity log, built from its history and messages
function supActivity(t) {
  return supMsgs(t.id).map((m) => {
    if (m.kind === "msg") {
      const pv = m.internal, ext = m.team === "external";
      return { at: m.at, who: m.who, ms: false, ic: pv ? "lock" : "msg", c: pv ? "#f59e0b" : ext ? "#0ea5e9" : "#64748b",
        html: pv ? "added a private note" : ext ? "replied" : "replied to the customer", snip: m.text.replace(/\s+/g, " ").slice(0, 110) };
    }
    const x = m.text, st = x.match(/^moved this to ([A-Za-z ]+?)(?: · |$)/);
    if (st) return { at: m.at, who: m.who, ms: true, ic: SUP_ST_IC[st[1]] || "refresh", c: SUP_STC[st[1]] || "#64748b", html: `changed the status to <b>${esc(st[1])}</b>${x.includes(" · ") ? ` · ${esc(x.split(" · ").slice(1).join(" · "))}` : ""}` };
    if (/^opened/.test(x)) return { at: m.at, who: m.who, ms: true, ic: "ticket", c: "#3b82f6", html: "opened this ticket" };
    if (/^(attached|removed) /.test(x)) return { at: m.at, who: m.who, ms: false, ic: "clip", c: "#64748b", html: esc(x) };
    if (/assign/.test(x)) return { at: m.at, who: m.who, ms: true, ic: "user", c: "#8b5cf6", html: esc(x) };
    if (/^emailed/.test(x)) return { at: m.at, who: m.who, ms: true, ic: "mail", c: "#0ea5e9", html: `sent an email`, snip: x.replace(/^emailed /, "To ") };
    if (/priority/.test(x)) return { at: m.at, who: m.who, ms: false, ic: "flame", c: "#f97316", html: esc(x) };
    return { at: m.at, who: m.who, ms: false, ic: "history", c: "#64748b", html: esc(x) };
  }).sort((a, b) => a.at - b.at);
}
act("supMode", (b) => { const id = location.hash.match(/support\/t\/([^/?]+)/)?.[1]; if (id) swap(`#/support/t/${id}?tab=activity${b.dataset.v === "ms" ? "&mode=ms" : ""}`); });
// AI assist (worked out on the device from this ticket and past ones)
function supAssist(t) {
  const ms = supMsgs(t.id).filter((m) => (m.kind === "msg" && !m.internal) || (m.kind === "event" && /^emailed /.test(m.text))).map((m) => (m.kind === "event" ? { ...m, team: "kebs" } : m)), last = ms[ms.length - 1];
  const words = (s) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));
  const tw = words(t.title);
  const similar = supData().tickets.filter((x) => x.id !== t.id).map((x) => { const xw = words(x.title), inter = [...tw].filter((w) => xw.has(w)).length, uni = new Set([...tw, ...xw]).size || 1;
    return [x, Math.round(Math.min(99, (inter / uni) * 100 + (x.module === t.module ? 12 : 0)))]; }).filter(([, p]) => p >= 25).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const RC = [[/access|login|sso|permission|licen/i, "Access & permissions"], [/export|report|extract|list of/i, "Reports & exports"], [/sync|integration|sap/i, "Integration"], [/time.?out|slow/i, "Performance"],
    [/rate card|config|workflow|approval|cost centre/i, "Configuration"], [/backfill|missing|update billing|data/i, "Data correction"], [/tax|duplicate|wrong|not updating|blank|not sent/i, "Product bug"]];
  const hit = RC.find(([re]) => re.test(t.title)), past = similar.find(([x]) => x.resType);
  const stand = !last ? "No reply yet — the customer is waiting for a first response." : last.team === "external" ? "Waiting on the team: the customer replied last." : "Waiting on the customer to reply.";
  const reply = past ? `Hi ${supFirst(t.req)},\n\nThis looks like ${past[0].id} (${past[0].title}), which we resolved with a ${past[0].resType.toLowerCase()}. We are applying the same fix for ${t.id} and will confirm shortly.\n\nRegards,\n${supMe()}` : supFill(SUP_CANNED[0][2], t);
  return { stand, last: last ? `Last reply by ${last.who === supMe() ? "you" : esc(last.who)} · ${D.ago(last.at) === "now" ? "just now" : D.ago(last.at) + " ago"}` : `Opened ${D.ago(t.created)} ago`,
    cause: hit ? hit[1] : "Other", conf: hit ? (past ? "High confidence" : "Medium confidence") : "Low confidence", why: hit ? `Matched from the title${past ? ` and ${past[0].id}, a similar ${past[0].status.toLowerCase()} ticket` : ""}.` : "Not enough signal in the title — ask for steps and a screenshot.",
    reply, similar };
}

// more actions
act("supMore", (b) => {
  const t = supT(b.dataset.id);
  pickOption({ title: `#${t.id}`, options: [{ v: "status", label: "Change status", icon: "refresh" }, { v: "assign", label: t.owner ? "Reassign" : "Assign", icon: "user" }, { v: "pri", label: "Change priority", icon: "flame" },
    { v: "mail", label: "Email requester", icon: "mail" }, { v: "esc", label: "Email assignee (SLA chase)", icon: "send" }, { v: "chat", label: "Open discussion", icon: "msg" }, { v: "req", label: "Requester's tickets", icon: "user" }, { v: "copy", label: "Copy ticket ID", icon: "copy" }],
    onPick: (v) => {
      const d = { dataset: { id: t.id } };
      if (v === "status") supStatusSheet(t); else if (v === "assign") ACTIONS.supAssign(d); else if (v === "pri") ACTIONS.supPri(d);
      else if (v === "mail") supEmail(t, "req"); else if (v === "esc") supEmail(t, "team"); else if (v === "chat") swap(`#/support/t/${t.id}?tab=chat`);
      else if (v === "req") go(`#/support/c/${t.cust}/${encodeURIComponent(t.req)}`); else { try { navigator.clipboard.writeText(t.id); } catch {} toast(`${t.id} copied`); }
    } });
});
act("supAssign", (b) => {
  const t = supT(b.dataset.id), me = supMe();
  pickOption({ title: "Assign to", value: t.owner || "", options: [{ v: me, label: `${me} (you)`, icon: "user" }, ...SUP_AGENTS.map((a) => ({ v: a, label: a, icon: "user", sub: `${supData().tickets.filter((x) => x.owner === a && SUP_OPEN.includes(x.status)).length} open` })), { v: "", label: "Unassigned", icon: "users" }],
    onPick: (v) => { const prev = t.owner; if ((v || null) === prev) return; t.owner = v || null; t.updated = Date.now();
      supMsgs(t.id).push({ kind: "event", who: me, text: v ? (v === me ? "assigned this to themselves" : `assigned this to ${v}`) : "unassigned this ticket", at: Date.now() }); save(); rerender();
      toastUndo(`${t.id}: ${v ? `assigned to ${v === me ? "you" : v}` : "unassigned"}`, () => { t.owner = prev; supMsgs(t.id).pop(); save(); rerender(); }); } });
});
act("supPri", (b) => {
  const t = supT(b.dataset.id);
  pickOption({ title: "Priority", value: t.pri, options: SUP_PRI.map((p) => ({ v: p, label: p, icon: "flame", sub: `${SUP_SLA[p]} working hours to resolve` })),
    onPick: (v) => { if (v === t.pri) return; const from = t.pri; t.pri = v; if (t.type === "Issue") t.due = supAddWork(t.created, SUP_SLA[v]); t.updated = Date.now();
      supMsgs(t.id).push({ kind: "event", who: supMe(), text: `changed priority ${from} → ${v}`, at: Date.now() }); save(); rerender(); toast(`${t.id}: priority ${v}`); } });
});

// ── attachments: on the ticket, in chat messages and in emails (10 MB each) ──
const SUP_MAX = 10 * 1024 * 1024, SUP_CFILES = {};
const supFileKey = (f) => `${f.at}:${f.name}`;
function supSeedFiles(t, i) {
  const r = supR(t.id + "f"); if (r < 0.35) return [];
  const mod = t.module.toLowerCase().replace(/\s+/g, "_");
  const pool = [[`${mod}_error.png`, "318 KB"], ["steps_to_reproduce.docx", "46 KB"], [`${mod}_export.xlsx`, "1.2 MB"], ["browser_console_log.txt", "12 KB"], ["approval_screen.jpg", "540 KB"]];
  return Array.from({ length: r > 0.8 ? 2 : 1 }, (_, k) => { const [name, size] = pool[(i + k * 2) % pool.length]; return { name, size, by: t.req, at: t.created + (k + 1) * 240000, from: "Raised with the ticket" }; });
}
function supPickFiles(cb) {
  const inp = document.createElement("input"); inp.type = "file"; inp.multiple = true;
  inp.onchange = async () => {
    const out = [];
    for (const f of inp.files) {
      if (f.size > SUP_MAX) { toast(`${f.name} is over 10 MB`, "bad"); continue; }
      const o = { name: f.name, size: fmtSize(f.size), by: supMe(), at: Date.now() + out.length };
      if (f.type.startsWith("image/") && f.size < 1.5e6) o.src = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(null); fr.readAsDataURL(f); });
      out.push(o);
    }
    if (out.length) cb(out);
  };
  inp.click();
}
function supAddFiles(t, files, from) {
  files.forEach((f) => { f.from = from; (t.files ||= []).push(f); });
  supMsgs(t.id).push({ kind: "event", who: supMe(), text: `attached ${files.length === 1 ? files[0].name : plural(files.length, "file")}`, at: Date.now() });
  t.updated = Date.now(); save();
}
// files inside a chat bubble: the same image grid and file rows as Quick collab
function supMsgFiles(t, m) {
  if (!m.files?.length) return "";
  const imgs = m.files.filter((f) => f.src), docs = m.files.filter((f) => !f.src);
  return `${imgs.length ? `<div class="pc-imgs n${Math.min(imgs.length, 4)}">${imgs.slice(0, 4).map((f) => `<button type="button" class="pc-img" data-act="supFile" data-id="${t.id}" data-k="${esc(supFileKey(f))}" aria-label="Open ${esc(f.name)}"><img src="${f.src}" alt=""></button>`).join("")}</div>` : ""}
    ${docs.map((f) => `<button type="button" class="pc-doc" data-act="supFile" data-id="${t.id}" data-k="${esc(supFileKey(f))}">${fileIcon(f.name)}<span class="grow" style="min-width:0"><b class="ell">${esc(f.name)}</b><small>${esc(f.size)}</small></span></button>`).join("")}`;
}
function supFilesCard(t) {
  const files = t.files || [], me = supMe();
  return `<div class="card rp-card"><div class="rp-ch"><h3>${I("clip")}Attachments${files.length ? ` · ${files.length}` : ""}</h3><button class="link" data-act="supAddFile" data-id="${t.id}">+ Add</button></div>
    ${files.length ? `<div class="sup-files">${files.map((f) => `<button class="sup-file" data-act="supFile" data-id="${t.id}" data-k="${esc(supFileKey(f))}">${f.src ? `<img class="sup-fthumb" src="${f.src}" alt="">` : fileIcon(f.name)}<span class="grow" style="min-width:0"><b class="ell">${esc(f.name)}</b><small class="ell">${esc(f.size)} · ${esc(f.by === me ? "You" : f.by)} · ${D.ago(f.at) === "now" ? "just now" : D.ago(f.at) + " ago"}</small></span>${I("chevR")}</button>`).join("")}</div>`
      : emptyMini("clip", "No files yet. Add screenshots, logs or exports.")}</div>`;
}
act("supAddFile", (b) => { const t = supT(b.dataset.id); supPickFiles((fs) => { supAddFiles(t, fs, "Added to the ticket"); rerender(); toast(`${plural(fs.length, "file")} attached`); }); });
act("supAttach", (b) => { const id = b.dataset.id; supPickFiles((fs) => { (SUP_CFILES[id] ||= []).push(...fs); rerender(); setTimeout(() => $(".sup-cmp textarea")?.focus(), 60); }); });
act("supUnattach", (b) => { SUP_CFILES[b.dataset.id]?.splice(Number(b.dataset.i), 1); rerender(); });
// images open full screen; the details sheet is one tap away
function supViewImg(t, f) {
  openImage({ src: f.src, name: f.name, sub: `${f.size} · ${f.by === supMe() ? "You" : f.by} · ${supDT(f.at)}`, actions: [
    { icon: "download", label: "Download", run() { const a = document.createElement("a"); a.href = f.src; a.download = f.name; a.click(); toast(`${f.name} downloaded`); } },
    { icon: "info", label: "Details", run() { closeImage(); ACTIONS.supFile({ dataset: { id: t.id, k: supFileKey(f), info: "1" } }); } },
  ] });
}
act("supFile", (b) => {
  const t = supT(b.dataset.id), k = b.dataset.k;
  const f = (t.files || []).find((x) => supFileKey(x) === k) || supMsgs(t.id).flatMap((m) => m.files || []).find((x) => supFileKey(x) === k); if (!f) return;
  if (f.src && !b.dataset.info) return supViewImg(t, f);
  const mine = f.by === supMe();
  const s = openSheet({ title: "Attachment", cls: "sup-fsheet",
    body: `<div class="sup-fv">${f.src ? `<img src="${f.src}" alt="${esc(f.name)}">` : `<span class="sup-fbig">${fileIcon(f.name)}</span>`}<h3>${esc(f.name)}</h3>
      <div class="ok-rows"><div><span>Size</span><b>${esc(f.size)}</b></div><div><span>Added by</span><b>${esc(mine ? "You" : f.by)}</b></div><div><span>When</span><b>${supDT(f.at)}</b></div>${f.from ? `<div><span>Where</span><b>${esc(f.from)}</b></div>` : ""}</div></div>`,
    foot: `<div class="row-btns">${mine ? `<button class="btn outline" style="flex:1" data-s="rm">${I("trash")}Remove</button>` : ""}<button class="btn primary" style="flex:1" data-s="dl">${I(f.src ? "download" : "send")}${f.src ? "Download" : "Open in KEBS"}</button></div>`,
    onMount(el) { onS(el, {
      dl() { if (f.src) { const a = document.createElement("a"); a.href = f.src; a.download = f.name; a.click(); toast(`${f.name} downloaded`); } else toast("This file is stored in KEBS — open the ticket on the web to download it", "info"); closeSheet(s); },
      rm() { const key = supFileKey(f); t.files = (t.files || []).filter((x) => supFileKey(x) !== key); supMsgs(t.id).forEach((m) => { if (m.files) m.files = m.files.filter((x) => supFileKey(x) !== key); });
        supMsgs(t.id).push({ kind: "event", who: supMe(), text: `removed ${f.name}`, at: Date.now() }); save(); closeSheet(s); rerender(); toast("Attachment removed"); },
    }); } });
});

// ── change status (any status → any status, with a reason) ──
function supSetStatus(t, to, { reason = "", notes = "", pv = true, resType = null } = {}) {
  const from = t.status, prev = { status: t.status, resolvedAt: t.resolvedAt, updated: t.updated, resType: t.resType }, ms = supMsgs(t.id), n0 = ms.length, me = supMe();
  t.status = to; t.updated = Date.now(); t.resolvedAt = ["Resolved", "Closed"].includes(to) ? t.resolvedAt || Date.now() : null; if (resType) t.resType = resType;
  ms.push({ kind: "event", who: me, text: `moved this to ${to}${reason ? ` · ${reason}` : ""}${resType ? ` · ${resType}` : ""}`, at: Date.now() });
  if (reason || notes) ms.push({ kind: "msg", team: "kebs", who: me, internal: pv, text: `Status changed: ${from} → ${to}${reason ? `\nReason: ${reason}` : ""}${notes ? `\n${notes}` : ""}`, at: Date.now() + 1 });
  save(); rerender();
  toastUndo(`${t.id}: moved to ${to}`, () => { Object.assign(t, prev); ms.length = n0; save(); rerender(); });
}
function supStatusSheet(t, preset = null) {
  let to = preset, reason = "", resType = null, pv = true;
  const s = openSheet({ title: `Change status of ${t.id}`, cls: "sup-sheet",
    body: `<div data-ft></div><div class="sup-stl">${SUP_ST.filter((x) => x !== t.status).map((x) => `<button class="sup-sto" data-s="to" data-v="${x}" style="--c:${SUP_STC[x]}">${I(SUP_ST_IC[x])}<span>${x}</span></button>`).join("")}</div>
      <div data-more hidden><div data-rs></div>
        <div class="field"><label class="lbl" for="sup-n">Notes <span class="muted">· optional</span></label><textarea id="sup-n" class="inp" rows="3" placeholder="What was done, what's next, who to follow up with…"></textarea></div>
        <div class="field"><span class="lbl">Post as</span><div class="sup-pa"><button class="on" data-s="pa" data-v="1">${I("lock")}Private · KEBS only</button><button data-s="pa" data-v="0">${I("globe")}Public</button></div></div></div>`,
    foot: `<div class="row-btns"><button class="btn outline" style="flex:1" data-s="cancel">Cancel</button><button class="btn primary" style="flex:1.4" data-s="go" disabled>Pick a status</button></div>`,
    onMount(el) {
      const draw = () => {
        el.querySelector("[data-ft]").innerHTML = `<div class="sup-ft"><span style="--c:${SUP_STC[t.status]}"><i></i>${t.status}</span>${I("chevR")}<span style="--c:${to ? SUP_STC[to] : "var(--ink-3)"}"><i></i>${to || "New status"}</span></div>`;
        el.querySelectorAll(".sup-sto").forEach((b) => b.classList.toggle("on", b.dataset.v === to));
        el.querySelector("[data-more]").hidden = !to;
        if (to) el.querySelector("[data-rs]").innerHTML = `<div class="field"><span class="lbl">Reason</span><div class="choices">${SUP_REASONS[to].map((r) => `<button class="choice ${r === reason ? "on" : ""}" data-s="rs" data-v="${esc(r)}">${esc(r)}</button>`).join("")}</div></div>
          ${to === "Resolved" ? `<div class="field"><span class="lbl">Resolution type</span><div class="choices">${SUP_RES_TYPES.map((r) => `<button class="choice ${r === resType ? "on" : ""}" data-s="rt" data-v="${r}">${r}</button>`).join("")}</div></div>` : ""}`;
        const go = el.querySelector('[data-s="go"]'); go.disabled = !to; go.textContent = to ? `Move to ${to}` : "Pick a status";
      };
      draw();
      onS(el, {
        to(b) { to = b.dataset.v; reason = ""; resType = null; draw(); },
        rs(b) { reason = reason === b.dataset.v ? "" : b.dataset.v; draw(); },
        rt(b) { resType = resType === b.dataset.v ? null : b.dataset.v; draw(); },
        pa(b) { pv = b.dataset.v === "1"; el.querySelectorAll(".sup-pa button").forEach((x) => x.classList.toggle("on", x === b)); },
        cancel() { closeSheet(s); },
        go() { if (!to) return; const notes = el.querySelector("#sup-n").value.trim(); closeSheet(s); supSetStatus(t, to, { reason, notes, pv, resType }); },
      });
    } });
}
act("supStatus", (b) => supStatusSheet(supT(b.dataset.id)));

// ── email (requester or assignee), from templates ──
const supDetails = (t) => {
  const ms = supMsgs(t.id).filter((m) => m.kind === "msg"), last = ms[ms.length - 1], sla = supSla(t);
  return ["Ticket details", `• Customer: ${SUP_CUST[t.cust].name}`, `• Ticket ID: ${t.id}`, `• Description: ${t.title}`, `• Type: ${t.type}`, `• Priority: ${t.pri}${t.type === "Issue" ? ` (${SUP_SLA[t.pri]} working hours SLA)` : ""}`,
    `• Status: ${t.status}`, `• Module: ${t.module}`, `• Reported by: ${t.req}`, `• Assigned to: ${t.owner || "Unassigned"}`, `• Created on: ${supDT(t.created)}`, `• SLA due: ${t.due ? supDT(t.due) : "No SLA"}`, `• SLA status: ${sla.label}`,
    ...(t.resolvedAt ? [`• Resolved on: ${supDT(t.resolvedAt)}`, `• Resolution type: ${t.resType || "—"}`, `• Root cause: ${t.rootCause || "—"}`] : []), ...(last ? [`• Latest comment: ${last.text.replace(/\s+/g, " ").slice(0, 160)}`] : [])].join("\n");
};
const SUP_MANAGER = { name: "Sukumaran", mail: "esukumaran@kaartech.com" };
function supTemplates(t) {
  const hi = (n) => `Hi ${supFirst(n)},\n\n`, sign = `\n\nThanks and Regards,\n${supMe()}`, due = t.due ? supDT(t.due) : "—", left = t.due ? supDur(Math.abs(t.due - Date.now())) : "", owner = t.owner || "Support lead", d = supDetails(t);
  const rca = "\n\nPlease share the root cause analysis once fixed. Also kindly provide us with the Resolution Type of this issue raised for Client communication.";
  const team = (k, l, body) => ({ k, l, grp: "To the KEBS team", to: t.owner ? supMail(t.owner) : "", body: hi(owner) + body + sign });
  const cust = (k) => { const c = SUP_CANNED.find((x) => x[0] === k); return { k, l: c[1], grp: "To the requester", to: supReqMail(t), body: supFill(c[2], t).replace(/\n\nRegards,\n.*$/s, "") + `\n\nRegards,\n${supMe()}\nKEBS Support` }; };
  return [cust("ack"), cust("moreinfo"), cust("fixed"), cust("followup"), cust("close"),
    team("open", "New ticket: action required", `I am writing to bring your attention to a support issue that requires your immediate attention and resolution. The current SLA for this ticket is [ ${due} ]. We kindly request your urgent assistance in resolving this within the SLA.\n\n${d}${rca}`),
    team("breach", "Going to breach: status request", `Ticket ${t.id} for ${SUP_CUST[t.cust].name} is going to breach its resolution SLA on [ ${due} ] (${left} left). Could you please share:\n• The current status and what has been done so far\n• The expected resolution date and time\n• Anything blocking you\n\n${d}\n\nPlease reply before the SLA deadline so we can keep the customer informed.`),
    team("sla", "SLA breached: reminder", `Ticket ${t.id} for ${SUP_CUST[t.cust].name} has breached its resolution SLA [ ${due} ]. Could you please share an update and the expected resolution time today?\n\n${d}${rca}`),
    team("status", "Status update request", `Could you please share the latest status on this ticket?\n\n${d}`),
    { k: "manager", l: "Manager escalation", grp: "To the KEBS team", to: SUP_MANAGER.mail, body: `Hi ${SUP_MANAGER.name},\n\nEscalating ${t.id} for ${SUP_CUST[t.cust].name}: ${supSla(t).label.toLowerCase()}. ${t.owner ? `${t.owner} is working on it.` : "It is not assigned yet."} Please help us prioritise.\n\n${d}${sign}` },
    { k: "blank", l: "Blank", grp: "Other", to: "", body: sign.trim() }];
}
// Outlook-style composer: a full screen with From, To (recipient chips + suggestions), Cc/Bcc, Subject and the body;
// a toolbar for attachments, templates and a Kais draft. Drafts are kept per ticket until sent or discarded.
const SUP_MAIL = {}; let SUP_OL_FOCUS = null;
const supDefaultTpl = (t, mode) => { const sla = supSla(t).tone;
  return mode === "team" ? (!SUP_OPEN.includes(t.status) ? "status" : sla === "breached" ? "sla" : sla === "soon" ? "breach" : "open")
    : ({ "On Hold": "moreinfo", Resolved: "fixed", Closed: "close", Reopened: "ack" }[t.status] || (supMsgs(t.id).some((m) => m.kind === "msg" && m.team === "kebs" && !m.internal) ? "followup" : "ack")); };
function supMailInit(t, mode, ai) {
  const key = ai ? null : supDefaultTpl(t, mode), x = ai ? { to: supReqMail(t), body: supAssist(t).reply, l: "Kais suggested reply" } : supTemplates(t).find((y) => y.k === key);
  return (SUP_MAIL[t.id] = { mode, key, tl: x.l, to: x.to ? [x.to] : [], cc: [], bcc: [], showCc: false, subj: `${t.id} - ${SUP_CUST[t.cust].name} - ${t.pri}`, body: x.body, files: [] });
}
const supOkMail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
function supContacts(t) {
  const list = [[t.req, supReqMail(t)], ...SUP_AGENTS.map((a) => [a, supMail(a)]), [SUP_MANAGER.name, SUP_MANAGER.mail], [supMe(), supMail(supMe())]];
  return list.filter((c, i) => list.findIndex((d) => d[1] === c[1]) === i);
}
const supNameOf = (t, e) => (supContacts(t).find((c) => c[1] === e) || [e.split("@")[0].split(/[._-]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")])[0];
function supEmail(t, mode, opts = {}) {
  const M = SUP_MAIL[t.id];
  if (!M || M.mode !== mode || opts.ai) supMailInit(t, mode, !!opts.ai);
  go(`#/support/t/${t.id}/mail`);
}
act("supEmail", (b) => supEmail(supT(b.dataset.id), b.dataset.m || "req", { ai: !!b.dataset.ai }));

route("support/t/:id/mail", ({ id }) => {
  const t = supT(id);
  if (!t) return `<div class="screen">${topbar("New message")}${emptyState(["mail"], "Ticket not found", "This ticket may have been removed.")}</div>`;
  const M = SUP_MAIL[id] || supMailInit(t, "req", false), me = supMe();
  const chips = (k) => M[k].map((e, i) => `<span class="ol-chip ${supOkMail(e) ? "" : "bad"}" title="${esc(e)}">${supAv(supNameOf(t, e), "xs")}<span class="ell">${esc(supNameOf(t, e))}</span><button type="button" data-act="olRm" data-k="${k}" data-i="${i}" aria-label="Remove ${esc(e)}">${I("x")}</button></span>`).join("");
  const field = (k, label) => `<div class="ol-f" data-f="${k}"><span class="ol-l">${label}</span><div class="ol-chips">${chips(k)}<input data-in="${k}" type="email" inputmode="email" autocomplete="off" enterkeyhint="next" aria-label="${label}" placeholder="${M[k].length ? "" : k === "to" ? "Add people" : ""}"></div>${k === "to" ? `<button type="button" class="ib sm ol-cc ${M.showCc ? "on" : ""}" data-act="olCc" aria-label="${M.showCc ? "Hide" : "Show"} Cc and Bcc">${I("chevD")}</button>` : ""}</div><div class="ol-sug" data-sug="${k}" hidden></div>`;
  return `<div class="screen ol">${topbar(M.mode === "team" ? "Email the assignee" : "New message", { sub: `${t.id} · ${SUP_CUST[t.cust].name}`, left: `<button class="ib" data-act="olClose" aria-label="Close and keep draft">${I("x")}</button>`,
      right: `<button class="ol-send" data-act="olSend" data-id="${id}" aria-label="Send" ${M.to.length ? "" : "disabled"}>${I("send")}</button>` })}
    <div class="scroll ol-body">
      <div class="ol-f"><span class="ol-l">From</span><div class="ol-from">${supAv(me, "xs")}<span class="ell"><b>${esc(me)}</b> ${esc(supMail(me))}</span></div></div>
      ${field("to", "To")}${M.showCc ? field("cc", "Cc") + field("bcc", "Bcc") : ""}
      <div class="ol-f"><input class="ol-subj" data-subj value="${esc(M.subj)}" placeholder="Subject" aria-label="Subject"></div>
      <div class="ol-tplrow"><button type="button" data-act="olTpl">${I("file")}<span class="ell">${esc(M.tl || "Template")}</span>${I("chevD")}</button></div>
      <textarea class="ol-text" data-body aria-label="Message body" placeholder="Write your message">${esc(M.body)}</textarea>
      ${M.files.length ? `<div class="ol-files">${M.files.map((f, i) => `<span class="ol-file">${fileIcon(f.name)}<span class="grow" style="min-width:0"><b class="ell">${esc(f.name)}</b><small>${esc(f.size)}</small></span><button type="button" class="ib sm" data-act="olUnfile" data-i="${i}" aria-label="Remove ${esc(f.name)}">${I("x")}</button></span>`).join("")}</div>` : ""}
    </div>
    <div class="ol-tools">
      <button type="button" data-act="olAttach" aria-label="Attach files">${I("clip")}</button>
      <button type="button" data-act="olTpl" aria-label="Templates">${I("file")}</button>
      <button type="button" class="ol-kais" data-act="olKais" aria-label="Draft with Kais">${I("sparkles")}<span>Draft with Kais</span></button>
      <button type="button" data-act="olMore" aria-label="More options">${I("dots")}</button>
      <input type="file" data-file multiple hidden>
    </div></div>`;
}, {
  parent: ({ id }) => `#/support/t/${id}`,
  mount({ id }) {
    const t = supT(id), M = SUP_MAIL[id]; if (!t || !M) return;
    const send = $(".ol-send"), sync = () => { if (send) send.disabled = !M.to.length && !$$("[data-in]").some((i) => i.dataset.in === "to" && i.value.trim()); };
    $("[data-subj]")?.addEventListener("input", (e) => { M.subj = e.target.value; });
    const ta = $("[data-body]"); if (ta) ta.addEventListener("input", () => { M.body = ta.value; });
    $$("[data-in]").forEach((inp) => {
      const k = inp.dataset.in, sug = $(`[data-sug="${k}"]`);
      const add = (v) => { const e = v.trim().replace(/[,;]$/, ""); if (!e) return; if (!M[k].includes(e)) M[k].push(e); SUP_OL_FOCUS = k; rerender(); };
      const showSug = () => {
        const q = inp.value.trim().toLowerCase(); sync();
        const hits = q ? supContacts(t).filter(([n, e]) => !M[k].includes(e) && (n.toLowerCase().includes(q) || e.includes(q))).slice(0, 5) : [];
        sug.hidden = !hits.length;
        sug.innerHTML = hits.map(([n, e]) => `<button type="button" data-e="${esc(e)}">${supAv(n, "xs")}<span class="grow" style="min-width:0"><b class="ell">${esc(n)}</b><small class="ell">${esc(e)}</small></span></button>`).join("");
      };
      inp.addEventListener("input", () => { if (/[,;\s]$/.test(inp.value) && inp.value.trim()) add(inp.value); else showSug(); });
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); add(inp.value); }
        else if (e.key === "Backspace" && !inp.value && M[k].length) { M[k].pop(); SUP_OL_FOCUS = k; rerender(); }
      });
      inp.addEventListener("blur", () => setTimeout(() => { if (inp.isConnected && inp.value.trim() && document.activeElement !== inp) add(inp.value); }, 160));
      sug.addEventListener("mousedown", (e) => e.preventDefault());
      sug.addEventListener("click", (e) => { const b = e.target.closest("[data-e]"); if (b) { inp.value = ""; add(b.dataset.e); } });
      if (SUP_OL_FOCUS === k) { inp.focus(); SUP_OL_FOCUS = null; }
    });
    const fi = $("[data-file]"); if (fi) fi.addEventListener("change", () => { [...fi.files].forEach((f) => M.files.push({ name: f.name, size: fmtSize(f.size) })); rerender(); });
  },
});
const olId = () => location.hash.match(/support\/t\/([^/?]+)\/mail/)?.[1];
act("olClose", () => { const id = olId(), M = SUP_MAIL[id]; if (M && (M.body.trim() || M.to.length)) toast("Draft saved", "info"); go(`#/support/t/${id}`); });
act("olCc", () => { const M = SUP_MAIL[olId()]; M.showCc = !M.showCc; if (M.showCc) SUP_OL_FOCUS = "cc"; rerender(); });
act("olRm", (b) => { const M = SUP_MAIL[olId()]; M[b.dataset.k].splice(Number(b.dataset.i), 1); rerender(); });
act("olUnfile", (b) => { SUP_MAIL[olId()].files.splice(Number(b.dataset.i), 1); rerender(); });
act("olAttach", () => {
  const id = olId(), t = supT(id), M = SUP_MAIL[id], tf = (t.files || []).filter((f) => !M.files.some((x) => x.name === f.name));
  const device = () => supPickFiles((fs) => { M.files.push(...fs.map((f) => ({ name: f.name, size: f.size }))); rerender(); });
  if (!tf.length) return device();
  pickOption({ title: "Attach", options: [{ v: "device", label: "From this device", icon: "upload" }, { v: "ticket", label: "From this ticket", icon: "clip", sub: plural(tf.length, "file") }],
    onPick: (v) => v === "device" ? device() : setTimeout(() => pickOption({ title: "Ticket files", options: tf.map((f, i) => ({ v: String(i), label: f.name, icon: "file", sub: `${f.size} · ${f.by === supMe() ? "You" : f.by}` })),
      onPick: (i) => { const f = tf[Number(i)]; M.files.push({ name: f.name, size: f.size }); rerender(); } }), 260) });
});
act("olTpl", () => {
  const id = olId(), t = supT(id), M = SUP_MAIL[id], tpls = supTemplates(t);
  pickOption({ title: "Templates", value: M.key, options: tpls.map((x) => ({ v: x.k, label: x.l, icon: x.grp.startsWith("To the req") ? "user" : x.grp === "Other" ? "edit" : "users", sub: x.grp })),
    onPick: (k) => { const x = tpls.find((y) => y.k === k); M.key = k; M.tl = x.l; M.body = x.body; if (x.to) M.to = [x.to]; else if (k === "blank") M.to = []; rerender(); } });
});
act("olKais", () => {
  const id = olId(), M = SUP_MAIL[id], prev = { body: M.body, tl: M.tl, key: M.key };
  M.body = supAssist(supT(id)).reply; M.tl = "Kais suggested reply"; M.key = null; rerender();
  toastUndo("Kais drafted a reply", () => { Object.assign(M, prev); rerender(); });
});
act("olMore", () => {
  const id = olId(), M = SUP_MAIL[id];
  pickOption({ title: "More", options: [{ v: "outlook", label: "Open in Outlook", icon: "send", sub: "Continue in your mail app" }, { v: "discard", label: "Discard draft", icon: "trash" }],
    onPick: (v) => {
      if (v === "discard") { delete SUP_MAIL[id]; toast("Draft discarded", "info"); go(`#/support/t/${id}`); return; }
      const a = document.createElement("a"); a.href = `mailto:${M.to.join(",")}?${M.cc.length ? `cc=${encodeURIComponent(M.cc.join(","))}&` : ""}${M.bcc.length ? `bcc=${encodeURIComponent(M.bcc.join(","))}&` : ""}subject=${encodeURIComponent(M.subj)}&body=${encodeURIComponent(M.body)}`; a.click();
    } });
});
act("olSend", (b) => {
  const id = b.dataset.id, t = supT(id), M = SUP_MAIL[id];
  $$("[data-in]").forEach((i) => { const v = i.value.trim(); if (v && !M[i.dataset.in].includes(v)) M[i.dataset.in].push(v); });
  if (!M.to.length) return toast("Enter at least one email address.", "bad");
  const bad = [...M.to, ...M.cc, ...M.bcc].find((e) => !supOkMail(e)); if (bad) { rerender(); return toast(`"${bad}" isn't a valid email.`, "bad"); }
  if (!M.subj.trim()) return toast("Add a subject.", "bad");
  supMsgs(id).push({ kind: "event", who: supMe(), text: `emailed ${M.to.join(", ")} · “${M.subj}”${M.files.length ? ` · ${plural(M.files.length, "attachment")}` : ""}`, at: Date.now() }); t.updated = Date.now(); save();
  const sent = { ...M }; delete SUP_MAIL[id];
  swap(`#/support/t/${id}?tab=chat`);
  setTimeout(() => successSheet({ title: "Email sent", sub: `About ${esc(id)} to ${esc(sent.to.map((e) => supNameOf(t, e)).join(", "))}`, rows: [["Subject", esc(sent.subj)], ...(sent.cc.length ? [["Cc", esc(sent.cc.join(", "))]] : []), ...(sent.files.length ? [["Attachments", String(sent.files.length)]] : []), ["Logged", "In the ticket history"]] }), 220);
});

// ── requester ──
route("support/c/:ck/:name", ({ ck, name }, q) => {
  if (typeof can === "function" && !can("support")) return roleLocked("Support desk");
  const c = SUP_CUST[ck], who = decodeURIComponent(name);
  if (!c) return `<div class="screen">${topbar("Requester")}${emptyState(["user"], "Not found", "This requester isn’t in the support desk.")}</div>`;
  const tab = q.tab || "contact", mine = supData().tickets.filter((t) => t.req === who && t.cust === ck), open = mine.filter((t) => SUP_OPEN.includes(t.status));
  const cust = supData().tickets.filter((t) => t.cust === ck), cOpen = cust.filter((t) => SUP_OPEN.includes(t.status)), issues = cust.filter((t) => t.type === "Issue" && t.resolvedAt);
  const met = issues.length ? Math.round((issues.filter((t) => t.resolvedAt <= t.due).length / issues.length) * 100) : 100;
  const avgRes = issues.length ? (issues.reduce((a, t) => a + (t.resolvedAt - t.created), 0) / issues.length / 864e5).toFixed(1) : "—";
  const apps = Object.entries(cOpen.reduce((a, t) => ((a[t.module] = (a[t.module] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);
  const happy = mine.length ? Math.round(mine.reduce((a, t) => a + t.happy, 0) / mine.length) : 0;
  const [first, ...rest] = who.split(" "), mail = supMail(who, c.dom), phone = `+91 9${String(Math.floor(supR(who + "ph") * 1e9)).padStart(9, "0")}`;
  const kv = (k, v) => `<div class="sup-kv"><span>${k}</span><b>${v}</b></div>`;
  const stat = (icon, label, n, color) => `<div class="sup-cs" style="--c:${color}"><span>${label}</span><b class="num">${I(icon)}${n}</b></div>`;
  return `<div class="screen">${topbar("Details", { right: `<button class="ib" data-act="supReqMail" data-ck="${ck}" data-n="${esc(who)}" aria-label="Email ${esc(who)}">${I("mail")}</button>` })}
    <div class="scroll"><div class="stack" style="padding-top:4px">
      <div class="sup-prof">${supAv(who, "xl")}<h2>${esc(who)}</h2><p class="muted">${esc(mail)}</p>
        <div class="sup-prof-a"><a class="ib" href="mailto:${esc(mail)}" aria-label="Email">${I("mail")}</a><a class="ib" href="tel:${phone.replace(/\s/g, "")}" aria-label="Call">${I("phone")}</a></div></div>
      <div class="card rp-card"><div class="rp-ch"><h3>${I("ticket")}Ticket summary</h3></div>
        <div class="sup-csg">${stat("inbox", "Open", open.length, "#3b82f6")}${stat("clock", "On hold", open.filter((t) => t.status === "On Hold").length, "#f59e0b")}${stat("alert", "Overdue", open.filter(supBreached).length, "#ef4444")}
          ${stat("ticket", "All tickets", mine.length, "var(--ink-2)")}<div class="sup-cs wide" style="--c:var(--ok)"><span>Happiness rating</span><span class="sup-hap">${I("sparkles")}<span class="sup-bar"><i style="width:${happy}%"></i></span><b class="num">${happy}%</b></span></div></div></div>
      ${seg([["contact", "Contact info"], ["crm", "Customer info"]], tab, "supReqTab")}
      <div class="card sup-kvs">${tab === "contact" ? kv("First name", esc(first)) + kv("Last name", esc(rest.join(" ") || "—")) + kv("Phone", `<a href="tel:${phone.replace(/\s/g, "")}">${phone}</a>`) + kv("Email", `<a href="mailto:${esc(mail)}">${esc(mail)}</a>`) + kv("Mobile", "—") + kv("Secondary email", esc(supMail(who, c.dom.replace(/^[^.]+/, (x) => x + "corp")))) + kv("Department", supPick(["Finance", "Delivery", "IT", "Operations", "HR"], who))
        : kv("Company", c.name) + kv("Domain", c.dom) + kv("Open tickets", cOpen.length) + kv("SLA breached", cOpen.filter(supBreached).length) + kv("SLA met", `${met}%`) + kv("Avg resolution", `${avgRes} days`) + kv("Top app", apps[0] ? `${esc(apps[0][0])} · ${apps[0][1]} open` : "—")}</div>
      <div class="sec"><h2>${esc(first)}’s tickets</h2><span class="tiny muted">${open.length} open of ${mine.length}</span></div>
      ${mine.length ? `<div class="card sup-list">${supList("all").filter((t) => mine.includes(t)).map(supRow).join("")}</div>` : emptyMini("ticket", "No tickets from this requester.")}
    </div></div></div>`;
}, { parent: () => "#/support" });
act("supReqTab", (b) => { const m = location.hash.match(/support\/c\/([^/]+)\/([^?]+)/); if (m) swap(`#/support/c/${m[1]}/${m[2]}${b.dataset.v === "crm" ? "?tab=crm" : ""}`); });
act("supReqMail", (b) => { const t = supData().tickets.find((x) => x.req === b.dataset.n && x.cust === b.dataset.ck && SUP_OPEN.includes(x.status)) || supData().tickets.find((x) => x.req === b.dataset.n); if (t) supEmail(t, "req"); });

// ── Home widget for the Support agent persona ──
function supWidget() {
  const me = supMe(), open = supData().tickets.filter((t) => SUP_OPEN.includes(t.status)), mine = open.filter((t) => t.owner === me);
  return rwCard("ticket", "Your support queue", ["Support desk", "#/support?v=mine"], [
    rwStat("inbox", "#3b82f6", "My open", mine.length, "#/support?v=mine"),
    rwStat("alert", "var(--danger)", "Breached", open.filter(supBreached).length, "#/support?v=breached", open.some(supBreached)),
    rwStat("users", "#8b5cf6", "Unassigned", open.filter((t) => !t.owner).length, "#/support?v=unassigned"),
  ], supList("mine").slice(0, 3).map((t) => { const sla = supSla(t); return rwRow(`<i class="sup-pbar sm" style="--c:${SUP_PRC[t.pri]}"></i>`, esc(t.title), `${t.id} · ${SUP_CUST[t.cust].name} · ${t.status}`, `<span class="sup-sla ${sla.tone}">${sla.label}</span>`, `#/support/t/${t.id}`); }));
}
// entry card in Apps → Helpdesk for people with the support desk
const supEntry = () => (typeof can === "function" && !can("support") ? "" : `<button class="card hrow sup-entry" data-go="#/support"><span class="tico ms">${msIcon("support")}</span><span class="grow"><b style="display:block">Support desk</b><span class="small muted">${supData().tickets.filter((t) => SUP_OPEN.includes(t.status)).length} open customer tickets · ${supData().tickets.filter((t) => SUP_OPEN.includes(t.status) && supBreached(t)).length} breached</span></span>${I("chevR")}</button>`);
