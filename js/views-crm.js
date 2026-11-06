// CRM: leads, contacts, deals (pipeline + stage moves), activities (calls, meetings, emails, notes, tasks)
// and a deal room per deal (the project team chat, reused). Data: S.crm = { leads, contacts, deals, acts }.

const CRM_STAGES = [["qualify", "Qualify", 10], ["discovery", "Discovery", 25], ["proposal", "Proposal", 50], ["negotiation", "Negotiation", 75], ["won", "Won", 100], ["lost", "Lost", 0]];
const CRM_OPEN = ["qualify", "discovery", "proposal", "negotiation"];
const STAGE_C = { qualify: "#64748b", discovery: "#3b82f6", proposal: "#8b5cf6", negotiation: "#d97706", won: "#16a34a", lost: "#e5484d" };
const stageName = (s) => CRM_STAGES.find((x) => x[0] === s)?.[1] || s;
const stageProb = (s) => CRM_STAGES.find((x) => x[0] === s)?.[2] ?? 0;
const LEAD_ST = { new: ["New", "#3b82f6"], contacted: ["Contacted", "#8b5cf6"], qualified: ["Qualified", "#16a34a"], unqualified: ["Unqualified", "#64748b"], converted: ["Converted", "#0d9488"] };
const LEAD_SRC = ["Website", "Referral", "LinkedIn", "Event", "Cold call", "Partner"];
const ACT_T = { call: ["Call", "phone", "#16a34a"], meeting: ["Meeting", "calendar", "#3b82f6"], email: ["Email", "mail", "#8b5cf6"], note: ["Note", "edit", "#d97706"], task: ["Task", "clipboard", "#0d9488"] };
const CALL_OUT = ["Connected", "Left voicemail", "No answer", "Wrong number"];
const LOST_REASONS = ["Price too high", "Went with a competitor", "No budget", "Went quiet", "Timing — not now", "Missing feature"];
// what has to be true before a deal leaves each stage
const CRM_CHECK = {
  qualify: [["Budget confirmed", "They have money set aside for this"], ["Decision maker identified", "We know who signs off"], ["Pain point is clear", "We can say why they need us, in one line"], ["Timeline known", "They told us when they want to go live"]],
  discovery: [["Requirements documented", "Scope written down and shared"], ["Demo done", "Key users have seen the product"], ["Stakeholders mapped", "Champion, buyer and blockers known"], ["Success criteria agreed", "We know what “working” means for them"]],
  proposal: [["Proposal sent", "Pricing and scope are with the customer"], ["Proposal walked through", "We presented it, not just emailed it"], ["Procurement contact known", "Legal / purchase team identified"], ["Verbal yes from champion", "Our champion supports the proposal"]],
  negotiation: [["Commercial terms agreed", "Price, payment terms and discounts final"], ["Contract signed or PO received", "We have it in writing"], ["Handover to delivery planned", "Kick-off date and team set"]],
};
const crmChecks = (d) => { const list = CRM_CHECK[d.stage] || []; const got = d.checks?.[d.stage] || []; return list.map((_, i) => got.includes(i)); };
const crmNextStage = (d) => (d.stage === "negotiation" ? "won" : CRM_OPEN[CRM_OPEN.indexOf(d.stage) + 1] || "won");
const CRM_TINTS =["t-blue", "t-violet", "t-green", "t-teal", "t-amber", "t-pink", "t-orange"];

function seedCrm() {
  const t = D.today(), add = (n) => D.add(t, n), now = Date.now(), dayMs = 864e5;
  const C = (id, name, company, title, tint, o = {}) => ({ id, name, company, title, tint, email: name.toLowerCase().split(" ")[0] + "@" + company.toLowerCase().replace(/[^a-z]/g, "").slice(0, 12) + ".com", phone: "+91 98" + String(40000000 + id.charCodeAt(1) * 731337).slice(0, 8), owner: "me", created: now - 40 * dayMs, ...o });
  const contacts = [C("c1", "Meera Iyer", "Northwind Retail", "Head of IT", "t-blue"), C("c2", "Rahul Menon", "Bluepeak Logistics", "Operations Director", "t-green"),
    C("c3", "Ananya Rao", "Helio Pharma", "Procurement Lead", "t-violet"), C("c4", "Karthik Subramanian", "Crescent Foods", "CFO", "t-amber"),
    C("c5", "Divya Nair", "Orbit Fintech", "VP Engineering", "t-teal"), C("c6", "Arjun Mehta", "Lumen Healthcare", "CIO", "t-pink"),
    C("c7", "Sneha Kapoor", "Zifo Technologies", "Program Manager", "t-orange"), C("c8", "Vikram Shah", "Prima Technologies", "Founder & CEO", "t-blue")];
  const H = (...st) => st.map(([s, ago]) => ({ stage: s, ts: now - ago * dayMs }));
  const Dl = (id, name, cid, value, stage, close, team, hist, o = {}) => ({ id, name, contact: cid, company: contacts.find((c) => c.id === cid).company, value, stage, prob: stageProb(stage), close, owner: "me", team: ["me", ...team], created: hist[0].ts, history: hist, ...o });
  const deals = [
    Dl("dl1", "HRMS rollout — 1,200 seats", "c1", 1850000, "negotiation", add(9), ["as", "pb"], H(["qualify", 45], ["discovery", 32], ["proposal", 18], ["negotiation", 4])),
    Dl("dl2", "Fleet attendance app", "c2", 640000, "proposal", add(21), ["al"], H(["qualify", 30], ["discovery", 20], ["proposal", 6])),
    Dl("dl3", "Expense automation pilot", "c3", 320000, "discovery", add(35), ["pb"], H(["qualify", 12], ["discovery", 3])),
    Dl("dl4", "Payroll migration", "c4", 980000, "qualify", add(60), ["as"], H(["qualify", 2])),
    Dl("dl5", "Engineering timesheets", "c5", 450000, "proposal", add(-2), ["vi"], H(["qualify", 50], ["discovery", 35], ["proposal", 15])),
    Dl("dl6", "Hospital shift rostering", "c6", 2400000, "discovery", add(40), ["as", "al"], H(["qualify", 20], ["discovery", 9])),
    Dl("dl7", "Field force app — phase 2", "c7", 760000, "won", add(-6), ["pb"], H(["qualify", 70], ["discovery", 55], ["proposal", 30], ["negotiation", 14], ["won", 6])),
    Dl("dl8", "Sales CRM add-on", "c8", 280000, "lost", add(-12), [], H(["qualify", 40], ["discovery", 28], ["proposal", 15], ["lost", 12]), { lostReason: "Went with a competitor" }),
  ];
  const L = (id, name, company, title, source, status, score, ago, tint, o = {}) => ({ id, name, company, title, source, status, score, tint, email: name.toLowerCase().split(" ")[0] + "@" + company.toLowerCase().replace(/[^a-z]/g, "").slice(0, 12) + ".in", phone: "+91 90" + String(10000000 + score * 98765).slice(0, 8), owner: "me", created: now - ago * dayMs, ...o });
  const leads = [L("l1", "Priya Raman", "Sunrise Hotels", "HR Manager", "Website", "new", 72, 0.2, "t-pink"), L("l2", "Nikhil Joshi", "Apex Builders", "Admin Head", "Referral", "contacted", 64, 2, "t-blue"),
    L("l3", "Fatima Sheikh", "Greenleaf Schools", "Principal", "Event", "qualified", 85, 5, "t-green"), L("l4", "Rohan Das", "Metro Clinics", "Operations Manager", "LinkedIn", "new", 48, 1, "t-violet"),
    L("l5", "Kavya Reddy", "Blue Ocean Travels", "Founder", "Cold call", "contacted", 55, 7, "t-teal"), L("l6", "Sameer Khan", "Tiny Bytes Studio", "Director", "Website", "unqualified", 22, 14, "t-amber"),
    L("l7", "Lakshmi Pillai", "Coastal Textiles", "GM — People", "Partner", "new", 78, 0.5, "t-orange")];
  const A = (type, title, ref, o = {}) => ({ id: uid(), type, title, ref, who: "me", ts: now, done: true, notes: "", ...o });
  const acts = [
    A("call", "Pricing walkthrough", { k: "deal", id: "dl1" }, { outcome: "Connected", dur: 25, ts: now - 4 * dayMs, notes: "Meera wants a 3-year price lock. Sending revised quote." }),
    A("email", "Sent revised quote v3", { k: "deal", id: "dl1" }, { ts: now - 3 * dayMs }),
    A("meeting", "Negotiation call with procurement", { k: "deal", id: "dl1" }, { done: false, due: add(0), time: "16:00", dur: 45, ts: now - dayMs }),
    A("task", "Share security questionnaire", { k: "deal", id: "dl2" }, { done: false, due: add(-1), ts: now - 3 * dayMs }),
    A("meeting", "Demo for ops team", { k: "deal", id: "dl2" }, { ts: now - 6 * dayMs, dur: 60, notes: "Loved the geo-fenced check-in. Asked about offline mode." }),
    A("call", "Discovery call", { k: "deal", id: "dl3" }, { outcome: "Connected", dur: 30, ts: now - 3 * dayMs }),
    A("task", "Send proposal draft", { k: "deal", id: "dl3" }, { done: false, due: add(2), ts: now - 2 * dayMs }),
    A("task", "Follow up on contract redlines", { k: "deal", id: "dl5" }, { done: false, due: add(-3), ts: now - 5 * dayMs }),
    A("meeting", "Clinical ops walkthrough", { k: "deal", id: "dl6" }, { done: false, due: add(3), time: "11:30", dur: 60, ts: now - dayMs }),
    A("call", "Intro call", { k: "lead", id: "l2" }, { outcome: "Left voicemail", ts: now - 2 * dayMs }),
    A("task", "Call back Priya", { k: "lead", id: "l1" }, { done: false, due: add(0), ts: now - 0.2 * dayMs }),
    A("note", "Budget approved for next quarter", { k: "lead", id: "l3" }, { ts: now - 4 * dayMs, notes: "Wants a demo for 3 campuses." }),
  ];
  return { contacts, deals, leads, acts };
}
if (!S.crm) { S.crm = seedCrm(); save(); }
// demo: some checklist items already ticked on the sample deals
{ const pre = { dl1: { negotiation: [0] }, dl2: { proposal: [0, 1] }, dl3: { discovery: [0] }, dl6: { discovery: [0, 1, 2] } };
  let ch = false; S.crm.deals.forEach((d) => { if (!d.checks && pre[d.id]) { d.checks = pre[d.id]; ch = true; } }); if (ch) save(); }
// deal-room chats live with the project chats
function seedDealChats() {
  const now = Date.now(), h = 36e5, me = (S.me.display || "you").split(" ")[0];
  S.pjChat ||= {};
  S.pjChat.dl1 ||= { msgs: [
    { id: uid(), who: "as", ts: now - 26 * h, text: "Meera’s team pushed back on the implementation fee. Can we bundle onboarding into year 1?" },
    { id: uid(), who: "pb", ts: now - 25 * h, text: "Finance is OK with a 40% discount on onboarding if they sign by month end.", react: { "👍": ["as"] } },
    { id: uid(), who: "as", ts: now - 2 * h, text: `@${me} I’ve put the revised commercials here — please review before the 4 PM call`, files: [{ name: "Northwind_commercials_v3.xlsx", size: "64 KB" }] }], read: now - 3 * h };
  S.pjChat.dl6 ||= { msgs: [{ id: uid(), who: "al", ts: now - 30 * h, text: "Lumen wants rostering for 4 hospitals. Let’s scope nurses first, then doctors." }], read: now };
}
seedDealChats(); save();
{ const base = resetDemo; resetDemo = function () { base(); S.crm = seedCrm(); seedDealChats(); save(); }; }

const crmDeal = (id) => S.crm.deals.find((d) => d.id === id);
const crmLead = (id) => S.crm.leads.find((l) => l.id === id);
const crmContact = (id) => S.crm.contacts.find((c) => c.id === id);
const crmAmt = (n) => (n >= 1e7 ? `₹${+(n / 1e7).toFixed(2)}Cr` : n >= 1e5 ? `₹${+(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `₹${Math.round(n / 1e3)}K` : `₹${n}`);
const crmAv = (x, cls = "sm") => `<span class="av ${cls} crm-av ${x.tint || "t-blue"}" aria-hidden="true">${esc(initials(x.name))}</span>`;
const crmActsFor = (k, id) => S.crm.acts.filter((a) => a.ref.k === k && a.ref.id === id);
const crmDaysIn = (d) => Math.max(0, Math.floor((Date.now() - (d.history.at(-1)?.ts || d.created)) / 864e5));
const crmOpenDeals = () => S.crm.deals.filter((d) => CRM_OPEN.includes(d.stage));
const crmDueTasks = () => S.crm.acts.filter((a) => !a.done && a.due);
function crmRefName(ref) {
  const x = ref.k === "deal" ? crmDeal(ref.id) : ref.k === "lead" ? crmLead(ref.id) : crmContact(ref.id);
  return x ? (ref.k === "deal" ? x.name : `${x.name} · ${x.company}`) : "Removed record";
}
// "Today" / "Tomorrow" / "Thursday, 12 Nov"
const crmDayTxt = (d) => { const n = D.diff(D.today(), d); return n === 0 ? "Today" : n === 1 ? "Tomorrow" : n === -1 ? "Yesterday" : D.nice(d); };
const crmRefHref =(ref) => `#/crm/${ref.k}/${ref.id}`;
const stageDot = (s) => `<i class="crm-sdot" style="background:${STAGE_C[s]}"></i>`;
function crmWhen(a) {
  if (a.done || !a.due) return `${D.ago(a.ts) === "now" ? "Just now" : D.ago(a.ts) + " ago"}`;
  const n = D.diff(D.today(), a.due);
  return `${n < 0 ? `Overdue by ${plural(-n, "day")}` : n === 0 ? "Today" : n === 1 ? "Tomorrow" : D.short(a.due)}${a.time ? ` · ${D.hm(a.time)}` : ""}`;
}

// ── CRM home ──
route("crm", (_, q) => {
  const tab = q.tab || "pipeline", qq = (q.q || "").toLowerCase();
  const open = crmOpenDeals(), pipe = open.reduce((a, d) => a + d.value, 0), weighted = open.reduce((a, d) => a + d.value * d.prob / 100, 0);
  const month = D.today().slice(0, 7), won = S.crm.deals.filter((d) => d.stage === "won" && D.iso(d.history.at(-1).ts).startsWith(month));
  const closed = S.crm.deals.filter((d) => d.stage === "won" || d.stage === "lost"), winRate = closed.length ? Math.round(closed.filter((d) => d.stage === "won").length / closed.length * 100) : 0;
  const due = crmDueTasks().filter((a) => a.due <= D.today()).length;
  const hero = `<div class="crm-hero">
      <div class="crm-hero-top"><span><small>Open pipeline</small><b class="num">${crmAmt(pipe)}</b><span class="tiny muted">${plural(open.length, "deal")} · ${crmAmt(weighted)} weighted</span></span></div>
      <div class="crm-stack" role="group" aria-label="Pipeline by stage">${CRM_OPEN.map((s) => { const v = open.filter((d) => d.stage === s).reduce((a, d) => a + d.value, 0); return v ? `<button class="crm-seg" data-act="crmStage" data-v="${s}" style="flex:${v};background:${STAGE_C[s]}" aria-label="${stageName(s)}: ${crmAmt(v)}" title="${stageName(s)} · ${crmAmt(v)}"></button>` : ""; }).join("")}</div>
      <div class="crm-legend">${CRM_OPEN.filter((s) => open.some((d) => d.stage === s)).map((s) => `<span>${stageDot(s)}${stageName(s)}</span>`).join("")}</div>
      <div class="crm-kpis"><span><i style="color:var(--ok)">${I("award")}</i><span><small>Won this month</small><b>${crmAmt(won.reduce((a, d) => a + d.value, 0))}</b></span></span><span><i style="color:#3b82f6">${I("target")}</i><span><small>Win rate</small><b>${winRate}%</b></span></span><span><i style="color:${due ? "var(--danger)" : "#d97706"}">${I("clock")}</i><span><small>Due today</small><b class="${due ? "bad" : ""}">${due}</b></span></span></div>
    </div>`;
  let body = "";
  if (tab === "pipeline") body = crmBoard(q.stage);
  else if (tab === "leads") {
    const f = q.f || "open";
    let list = S.crm.leads.filter((l) => (f === "all" ? true : f === "open" ? ["new", "contacted", "qualified"].includes(l.status) : l.status === f));
    if (qq) list = list.filter((l) => [l.name, l.company, l.title, l.source].join(" ").toLowerCase().includes(qq));
    list.sort((a, b) => b.created - a.created);
    const cnt = (v) => S.crm.leads.filter((l) => (v === "all" ? true : v === "open" ? ["new", "contacted", "qualified"].includes(l.status) : l.status === v)).length;
    body = `<label class="searchbox" style="margin-top:12px">${I("search")}<input data-cq placeholder="Search leads" value="${esc(q.q || "")}" enterkeyhint="search"></label>
      ${filterHead(`${list.length} ${f === "all" ? "" : f === "open" ? "open " : LEAD_ST[f][0].toLowerCase() + " "}${list.length === 1 ? "lead" : "leads"}`, "crmLF", f, [["open", "Open", "target"], ["new", "New", "sparkles"], ["contacted", "Contacted", "phone"], ["qualified", "Qualified", "checkCircle"], ["unqualified", "Unqualified", "x"], ["converted", "Converted", "award"], ["all", "All", "list"]].map(([v, l, ic]) => [v, l, ic, `${cnt(v)} ${cnt(v) === 1 ? "lead" : "leads"}`]), "Show leads")}
      ${list.length ? `<div class="card crm-list" data-lazy="8">${list.map(crmLeadRow).join("")}</div>` : emptyState(qq ? ["search"] : ["user", "target"], qq ? "No leads match" : "No leads here", qq ? "Try a different name or company." : "New enquiries show up here. Tap + to add one.")}`;
  } else if (tab === "contacts") {
    let list = [...S.crm.contacts].sort((a, b) => a.name.localeCompare(b.name));
    if (qq) list = list.filter((c) => [c.name, c.company, c.title, c.email].join(" ").toLowerCase().includes(qq));
    const groups = []; list.forEach((c) => { const k = c.name[0].toUpperCase(); const g = groups.find((x) => x.k === k); g ? g.items.push(c) : groups.push({ k, items: [c] }); });
    body = `<label class="searchbox" style="margin-top:12px">${I("search")}<input data-cq placeholder="Search contacts" value="${esc(q.q || "")}" enterkeyhint="search"></label>
      <div class="pj-fh"><h2>${plural(list.length, "contact")}</h2></div>
      ${groups.length ? groups.map((g) => `<div class="crm-az">${g.k}</div><div class="card crm-list">${g.items.map((c) => `<button class="crm-row" data-go="#/crm/contact/${c.id}">${crmAv(c)}<span class="grow" style="min-width:0"><b class="ell">${esc(c.name)}</b><span class="small muted ell">${esc(c.title)} · ${esc(c.company)}</span></span>${(() => { const n = S.crm.deals.filter((d) => d.contact === c.id && CRM_OPEN.includes(d.stage)).length; return n ? `<span class="tiny muted">${plural(n, "deal")}</span>` : ""; })()}${I("chevR")}</button>`).join("")}</div>`).join("")
        : emptyState(["search"], "No contacts match", "Try a different name, company or email.")}`;
  } else {
    const f = q.f || "todo";
    const todo = S.crm.acts.filter((a) => !a.done && a.due).sort((a, b) => (a.due + (a.time || "")).localeCompare(b.due + (b.time || "")));
    const done = S.crm.acts.filter((a) => a.done).sort((a, b) => b.ts - a.ts);
    const td = D.today();
    const grp = f === "todo" ? [["Overdue", todo.filter((a) => a.due < td)], ["Today", todo.filter((a) => a.due === td)], ["Upcoming", todo.filter((a) => a.due > td)]] : [["Logged", done]];
    body = `${filterHead(f === "todo" ? `${todo.length} to do` : `${done.length} logged`, "crmAF", f, [["todo", "To do", "clock", `${todo.length} open`], ["done", "Logged", "history", `${done.length} done`]], "Show activities")}
      ${grp.some(([, g]) => g.length) ? grp.filter(([, g]) => g.length).map(([h, g]) => `<div class="sec"><h2 class="sec-ic tk-grp" data-g="${h === "Upcoming" ? "This week" : h}">${I({ Overdue: "alert", Today: "sun", Upcoming: "calendar", Logged: "history" }[h])}${h} <span class="muted" style="font-weight:600">(${g.length})</span></h2></div><div class="card crm-list" data-lazy="8">${g.map((a) => crmActRow(a, true)).join("")}</div>`).join("")
        : emptyState(["checkCircle", "calendar"], f === "todo" ? "Nothing to do" : "Nothing logged yet", f === "todo" ? "Follow-ups and meetings you plan show up here." : "Calls, meetings and notes you log show up here.")}`;
  }
  return `<div class="screen">${topbar("CRM", { right: `<button class="ib" data-act="crmNew" aria-label="Add to CRM">${I("plus")}</button>` })}
    ${seg([["pipeline", "Pipeline"], ["leads", "Leads"], ["contacts", "Contacts"], ["activities", `Activities${due ? ` (${due})` : ""}`]], tab, "crmTab")}
    <div class="scroll">${tab === "pipeline" ? hero : ""}${body}</div></div>`;
}, { mount: crmMount });
act("crmTab", (b) => swap(`#/crm?tab=${b.dataset.v}`));
let CRM_KEEP = null; // keep the scroll position when switching pipeline stages
const crmGoStage = (v) => { CRM_KEEP = $(".screen .scroll")?.scrollTop ?? null; swap(`#/crm?tab=pipeline&stage=${v}`); };
act("crmStage", (b) => crmGoStage(b.dataset.v));
act("crmLF", (b) => { const q = parseHash().q; swap(`#/crm?tab=leads&f=${b.dataset.v}${q.q ? `&q=${encodeURIComponent(q.q)}` : ""}`); });
act("crmAF", (b) => swap(`#/crm?tab=activities&f=${b.dataset.v}`));
function crmMount() {
  const inp = $("[data-cq]");
  if (inp) { let t; inp.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { const { q } = parseHash(); const pos = inp.selectionStart; q.q = inp.value; if (!inp.value) delete q.q; swap(`#/crm?${new URLSearchParams(q)}`); requestAnimationFrame(() => { const n = $("[data-cq]"); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }); }, 250); }); }
  const list = $(".crm-plist"); if (list) { crmBoardHold(list); crmSwipeStages(list); }
  const strip = $(".crm-strip"); if (strip) { const on = strip.querySelector(".on"); if (on) strip.scrollLeft = on.offsetLeft - strip.clientWidth / 2 + on.offsetWidth / 2; }
  if (CRM_KEEP != null) { const sc = $(".screen .scroll"); if (sc) sc.scrollTop = CRM_KEEP; CRM_KEEP = null; }
}

// pipeline: a stage strip (sticks while you scroll) and one full-width list per stage; swipe to change stage
const CRM_STRIP = ["all", ...CRM_OPEN, "won", "lost"];
function crmBoard(sel) {
  const stage = CRM_STRIP.includes(sel) ? sel : "all", open = crmOpenDeals();
  const chip = (s) => { const ds = s === "all" ? open : S.crm.deals.filter((d) => d.stage === s), v = ds.reduce((a, d) => a + d.value, 0);
    return `<button class="crm-sc ${s === stage ? "on" : ""}" data-act="crmStage" data-v="${s}" style="--c:${s === "all" ? "var(--accent)" : STAGE_C[s]}" aria-pressed="${s === stage}"><span class="crm-sc-t">${s === "all" ? "" : stageDot(s)}${s === "all" ? "All open" : stageName(s)}</span><span class="crm-sc-v">${ds.length} · ${crmAmt(v)}</span></button>`; };
  let ds = stage === "all" ? open : S.crm.deals.filter((d) => d.stage === stage);
  ds = [...ds].sort((a, b) => (CRM_OPEN.includes(a.stage) ? a.close.localeCompare(b.close) : (b.history.at(-1)?.ts || 0) - (a.history.at(-1)?.ts || 0)));
  const td = D.today(), wk = D.add(td, 7), mo = D.add(td, 30);
  const groups = stage === "all" || CRM_OPEN.includes(stage)
    ? [["Past close date", ds.filter((d) => d.close < td)], ["Closing this week", ds.filter((d) => d.close >= td && d.close <= wk)], ["This month", ds.filter((d) => d.close > wk && d.close <= mo)], ["Later", ds.filter((d) => d.close > mo)]].filter(([, g]) => g.length)
    : [["", ds]];
  const empty = { all: ["No open deals", "Create a deal or convert a lead to fill your pipeline."], won: ["No wins yet", "Deals you close as won land here."], lost: ["Nothing lost", "Deals marked lost show up here with the reason."] }[stage] || [`No deals in ${stageName(stage)}`, "Move a deal here when it reaches this stage."];
  return `<div class="crm-strip" role="tablist" aria-label="Pipeline stages">${CRM_STRIP.map(chip).join("")}</div>
    <div class="crm-plist" data-stage="${stage}">
      ${ds.length ? groups.map(([h, g]) => `${h ? `<div class="crm-pg ${h === "Past close date" ? "bad" : ""}">${h}<span>${g.length} · ${crmAmt(g.reduce((a, d) => a + d.value, 0))}</span></div>` : ""}<div class="stack s8">${g.map((d) => crmCard(d, stage === "all")).join("")}</div>`).join("")
        : emptyState(["target"], empty[0], empty[1], stage === "all" ? `<button class="btn primary" data-act="crmNewDeal">${I("plus")}New deal</button>` : "")}
      ${ds.length ? `<p class="crm-hint">Hold a deal to move it · swipe sideways to change stage</p>` : ""}
    </div>`;
}
// swipe left / right on the list to go to the next / previous stage
function crmSwipeStages(list) {
  let st = null;
  list.addEventListener("pointerdown", (e) => { st = { x: e.clientX, y: e.clientY }; });
  list.addEventListener("pointerup", (e) => {
    if (!st) return; const dx = e.clientX - st.x, dy = e.clientY - st.y; st = null;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    const i = CRM_STRIP.indexOf(list.dataset.stage), j = i + (dx < 0 ? 1 : -1);
    if (j < 0 || j >= CRM_STRIP.length) return;
    list.dataset.swiped = "1"; list.classList.add(dx < 0 ? "out-l" : "out-r");
    setTimeout(() => crmGoStage(CRM_STRIP[j]), 140);
  });
  list.addEventListener("pointercancel", () => { st = null; });
  list.addEventListener("click", (e) => { if (list.dataset.swiped) { e.preventDefault(); e.stopPropagation(); } }, true);
}
function crmCard(d, showStage) {
  const late = CRM_OPEN.includes(d.stage) && d.close < D.today(), tasks = crmActsFor("deal", d.id).filter((a) => !a.done).length, unread = typeof pcUnread === "function" ? pcUnread(d.id) : 0;
  return `<button class="crm-card" data-go="#/crm/deal/${d.id}" data-d="${d.id}">
    <span class="crm-card-t"><b class="ell">${esc(d.name)}</b>${unread ? `<i class="pc-dot crm-udot"></i>` : ""}</span>
    <span class="small muted ell">${esc(d.company)}${showStage ? ` · <span class="crm-card-st" style="color:${STAGE_C[d.stage]}">${stageName(d.stage)}</span>` : ""}</span>
    <span class="crm-card-f"><b>${crmAmt(d.value)}</b><span class="${late ? "bad" : ""}">${d.stage === "won" ? "Won" : d.stage === "lost" ? "Lost" : late ? `${D.diff(d.close, D.today())}d late` : `Close ${D.short(d.close)}`}</span></span>
    <span class="crm-card-m"><span class="av-stack">${d.team.slice(0, 3).map((x) => avatar(x, "xs")).join("")}</span><span class="grow"></span>${tasks ? `<span class="tiny muted">${I("checkCircle")}${tasks}</span>` : ""}${CRM_OPEN.includes(d.stage) ? `<span class="tiny muted">${crmDaysIn(d)}d in stage</span>` : ""}</span>
  </button>`;
}
function crmBoardHold(board) {
  let st = null;
  board.addEventListener("pointerdown", (e) => {
    const c = e.target.closest(".crm-card"); if (!c) return;
    st = { x: e.clientX, y: e.clientY, c, t: setTimeout(() => { st.held = true; try { navigator.vibrate?.(14); } catch {} c.classList.add("held"); crmMoveSheet(crmDeal(c.dataset.d)); setTimeout(() => c.classList.remove("held"), 300); }, 450) };
  });
  board.addEventListener("pointermove", (e) => { if (st && Math.hypot(e.clientX - st.x, e.clientY - st.y) > 8) { clearTimeout(st.t); if (!st.held) st = null; } });
  const end = () => { if (st) clearTimeout(st.t); };
  board.addEventListener("pointerup", end); board.addEventListener("pointercancel", () => { end(); st = null; });
  board.addEventListener("click", (e) => { if (st?.held) { e.preventDefault(); e.stopPropagation(); } st = null; }, true);
  board.addEventListener("contextmenu", (e) => { if (e.target.closest(".crm-card")) e.preventDefault(); });
}

function crmLeadRow(l) {
  return `<button class="crm-row" data-go="#/crm/lead/${l.id}">${crmAv(l)}<span class="grow" style="min-width:0"><b class="ell">${esc(l.name)}</b><span class="small muted ell">${esc(l.company)} · ${esc(l.source)}</span></span>
    <span class="crm-row-r"><span class="crm-st" style="--c:${LEAD_ST[l.status][1]}">${LEAD_ST[l.status][0]}</span><span class="tiny muted">${crmScoreTxt(l.score)}</span></span></button>`;
}
const crmScoreTxt = (s) => `${s >= 70 ? `<span class="crm-hot">${I("flame")}Hot</span> · ` : ""}Score ${s}`;
// timeline entries in the app's activity-feed style: person avatar + small type badge
const ACT_TINT = { call: "t-green", meeting: "t-blue", email: "t-violet", note: "t-amber", task: "t-teal" };
function crmFd({ who = "me", ic, tint, title, sub, open, check }) {
  return `<div class="fd crm-fd">
    <div class="fd-av">${avatar(who)}<span class="fd-badge ${tint}">${I(ic)}</span></div>
    ${open ? `<button class="grow crm-fd-b" data-act="crmActOpen" data-id="${open}">` : `<div class="grow crm-fd-b">`}<b class="fd-t">${title}</b><span class="small muted" style="display:block">${sub}</span>${open ? "</button>" : "</div>"}
    ${check ? `<button class="tk-check crm-act-ck" data-act="crmDone" data-id="${check}" aria-label="Mark done">${I("check")}</button>` : ""}
  </div>`;
}
function crmActFd(a, showRef) {
  const [label, ic] = ACT_T[a.type], overdue = !a.done && a.due && a.due < D.today();
  const sub = `${a.who && a.who !== "me" ? esc(person(a.who).name) : "You"} · ${label}${a.outcome ? ` · ${esc(a.outcome)}` : ""}${a.dur ? ` · ${a.dur} min` : ""}${showRef ? ` · ${esc(crmRefName(a.ref).split(" · ")[0])}` : ""} · <span class="${overdue ? "bad" : ""}">${crmWhen(a)}</span>`;
  return crmFd({ who: a.who || "me", ic, tint: ACT_TINT[a.type], title: esc(a.title), sub, open: a.id, check: !a.done && a.due ? a.id : null });
}
function crmActRow(a, showRef) {
  const [label, ic, c] = ACT_T[a.type], overdue = !a.done && a.due && a.due < D.today();
  return `<div class="crm-act ${a.done ? "logged" : ""}">
    <span class="crm-act-ic" style="--c:${c}" aria-hidden="true">${I(ic)}</span>
    <button class="grow crm-act-b" data-act="crmActOpen" data-id="${a.id}">
      <b class="ell">${esc(a.title)}</b>
      <span class="small muted ell">${label}${a.outcome ? ` · ${esc(a.outcome)}` : ""}${a.dur ? ` · ${a.dur} min` : ""}${showRef ? ` · ${esc(crmRefName(a.ref))}` : ""}</span>
      <span class="tiny ${overdue ? "bad" : "muted"}">${crmWhen(a)}</span>
    </button>
    ${!a.done && a.due ? `<button class="tk-check crm-act-ck" data-act="crmDone" data-id="${a.id}" aria-label="Mark “${esc(a.title)}” done">${I("check")}</button>` : ""}</div>`;
}

// ── deal detail ──
route("crm/deal/:id", ({ id }) => {
  const d = crmDeal(id);
  if (!d) return `<div class="screen">${topbar("Deal")}${emptyState(["target"], "Deal not found", "It may have been deleted.", `<button class="btn primary" data-go="#/crm">Back to CRM</button>`)}</div>`;
  const c = crmContact(d.contact), isOpen = CRM_OPEN.includes(d.stage), late = isOpen && d.close < D.today(), unread = typeof pcUnread === "function" ? pcUnread(d.id) : 0;
  const si = CRM_OPEN.indexOf(d.stage);
  const ago = (ts) => (D.ago(ts) === "now" ? "Just now" : D.ago(ts) + " ago");
  const timeline = [...crmActsFor("deal", d.id).map((a) => ({ ts: a.done ? a.ts : Infinity, html: crmActFd(a) })),
    ...d.history.slice(1).map((h, i) => { const from = d.history[i].stage, back = CRM_OPEN.includes(h.stage) && CRM_OPEN.indexOf(h.stage) < CRM_OPEN.indexOf(from);
      return { ts: h.ts, html: crmFd({ ic: h.stage === "won" ? "award" : h.stage === "lost" ? "x" : back ? "arrowDown" : "arrowUp", tint: h.stage === "won" ? "t-green" : h.stage === "lost" ? "t-red" : back ? "t-slate" : "t-blue",
        title: h.stage === "won" ? "Deal won" : h.stage === "lost" ? `Deal lost${d.lostReason ? ` — ${esc(d.lostReason)}` : ""}` : `${back ? "Moved back" : "Moved"} to ${stageName(h.stage)}`, sub: `You · from ${stageName(from)} · ${ago(h.ts)}` }) }; }),
    { ts: d.created, html: crmFd({ ic: "sparkles", tint: "t-orange", title: "Deal created", sub: `You · ${D.short(D.iso(d.created))}` }) }].sort((a, b) => b.ts - a.ts);
  return `<div class="screen">${topbar("Deal", { sub: d.company, right: `<button class="ib pc-hbtn" data-go="#/crm/deal/${d.id}/chat" aria-label="Deal room${unread ? ` · ${unread} unread` : ""}">${I("msg")}${unread ? `<span class="pc-dot"></span>` : ""}</button>` })}
    <div class="scroll"><div class="stack">
      <div class="crm-dhero">
        <div class="crm-dh-top"><span class="tiny muted ell">${esc(d.company)}</span><span class="crm-st" style="--c:${STAGE_C[d.stage]}">${stageName(d.stage)}</span></div><h1 class="crm-dh-t" title="${esc(d.name)}">${esc(d.name)}</h1>
        <div class="crm-dval"><b class="num">${crmAmt(d.value)}</b><span class="small muted">${d.prob}% likely · ${crmAmt(d.value * d.prob / 100)} weighted</span></div>
        ${isOpen || d.stage === "won" || d.stage === "lost" ? `<div class="crm-steps" role="group" aria-label="Deal stage">${CRM_OPEN.map((s, i) => `<button class="crm-step ${d.stage === "won" || i < si ? "past" : i === si ? "on" : ""}" style="--c:${STAGE_C[s]}" data-act="crmMove" data-id="${d.id}" data-v="${s}" ${!isOpen ? "disabled" : ""} aria-label="Move to ${stageName(s)}"${i === si ? ' aria-current="step"' : ""}><i></i><span>${stageName(s)}</span></button>`).join("")}</div>` : ""}
        ${isOpen ? (() => { const nx = crmNextStage(d), ck = crmChecks(d), n = ck.filter(Boolean).length, tot = (CRM_CHECK[d.stage] || []).length;
          return `<button class="crm-ck-line" data-act="crmNext" data-id="${d.id}"><span class="crm-ck-ring" style="--p:${tot ? Math.round(n / tot * 100) : 0}"></span><span class="grow"><b>${stageName(d.stage)} checklist</b><small>${n} of ${tot} done · next: ${stageName(nx)}</small></span>${I("chevR")}</button>
          <button class="btn primary block crm-next" data-act="crmNext" data-id="${d.id}">${nx === "won" ? `${I("award")}Close as won` : `Move to ${stageName(nx)}${I("chevR")}`}</button>
          <div class="crm-wl"><button class="btn outline" data-act="crmMove" data-id="${d.id}" data-v="lost">${I("x")}Mark lost</button><button class="btn outline" data-act="crmMove" data-id="${d.id}" data-v="won">${I("award")}Mark won</button></div>`; })()
          : `<div class="banner ${d.stage === "won" ? "ok" : "bad"}">${I(d.stage === "won" ? "award" : "info")}${d.stage === "won" ? `Won ${D.short(D.iso(d.history.at(-1).ts))}` : `Lost${d.lostReason ? ` — ${esc(d.lostReason)}` : ""}`}<span class="grow"></span><button class="link" data-act="crmReopen" data-id="${d.id}">Reopen</button></div>`}
      </div>
      ${late ? `<div class="banner bad">${I("clock")}Expected close was ${D.short(d.close)} — update the date or move the deal.</div>` : ""}
      ${crmQuick(c, { k: "deal", id: d.id })}
      <div class="sec"><h2 class="sec-ic">${I("info")}Details</h2><button class="link" data-act="crmEditDeal" data-id="${d.id}">Edit</button></div>
      <div class="card"><div class="cd-kv">
        ${c ? `<button class="crm-kv" data-go="#/crm/contact/${c.id}"><span class="kv-ic"><i class="tint t-blue">${I("user")}</i>Contact</span><b class="hrow" style="gap:6px">${crmAv(c, "xs")}${esc(c.name)}</b></button>` : ""}
        <div><span class="kv-ic"><i class="tint t-violet">${I("calendar")}</i>Expected close</span><b class="${late ? "bad" : ""}">${D.long(d.close)}</b></div>
        <div><span class="kv-ic"><i class="tint t-amber">${I("clock")}</i>In this stage</span><b>${plural(crmDaysIn(d), "day")}</b></div>
        <div><span class="kv-ic"><i class="tint t-green">${I("user")}</i>Owner</span><b class="hrow" style="gap:6px">${avatar(d.owner, "xs")}${esc(d.owner === "me" ? "You" : person(d.owner).name)}</b></div>
      </div></div>
      <div class="sec"><h2 class="sec-ic">${I("users")}Deal team</h2><button class="link" data-go="#/crm/deal/${d.id}/chat">Open deal room</button></div>
      <button class="card pc-card" data-go="#/crm/deal/${d.id}/chat"><span class="av-stack">${d.team.slice(0, 5).map((x) => avatar(x, "sm")).join("")}</span><span class="grow" style="min-width:0"><b style="display:block">${d.team.map((x) => (x === "me" ? "You" : person(x).name.split(" ")[0])).join(", ")}</b><span class="small ${unread ? "" : "muted"} ell" style="display:block">${(() => { const m = pcOf(d.id).msgs.at(-1); return m ? emoText(esc(pcSnippet(m))) : "Chat, share files and @mention the team"; })()}</span></span>${unread ? `<span class="pc-new">${unread} new</span>` : I("chevR")}</button>
      <div class="sec"><h2 class="sec-ic">${I("history")}Activity</h2><button class="link" data-act="crmLog" data-k="deal" data-id="${d.id}">${I("plus")}Log</button></div>
      <div class="feed crm-feed">${timeline.map((x) => x.html).join("")}</div>
    </div></div></div>`;
}, { parent: "#/crm?tab=pipeline" });
route("crm/deal/:id/chat", ({ id }) => pcScreen(id), pcRoute);
PC_CTX.deal = (id) => { const d = crmDeal(id); return d && { id, team: d.team, name: d.name, closed: !CRM_OPEN.includes(d.stage), path: `crm/deal/${id}/chat`, back: `#/crm/deal/${id}`, kind: "deal" }; };

// call / email / WhatsApp / log buttons
function crmQuick(x, ref) {
  if (!x) return "";
  const wa = (x.phone || "").replace(/[^\d]/g, "");
  return `<div class="crm-quick">
    <a href="tel:${esc((x.phone || "").replace(/\s/g, ""))}" data-act="crmTouch" data-k="${ref.k}" data-id="${ref.id}" data-t="call">${I("phone")}<span>Call</span></a>
    <a href="mailto:${esc(x.email || "")}" data-act="crmTouch" data-k="${ref.k}" data-id="${ref.id}" data-t="email">${I("mail")}<span>Email</span></a>
    <a href="https://wa.me/${wa}" target="_blank" rel="noopener" data-act="crmTouch" data-k="${ref.k}" data-id="${ref.id}" data-t="wa">${I("msg")}<span>WhatsApp</span></a>
    <button data-act="crmLog" data-k="${ref.k}" data-id="${ref.id}">${I("edit")}<span>Log</span></button>
  </div>`;
}
// after a call/email from the app, offer to log it (the link itself still opens)
act("crmTouch", (b) => {
  const ref = { k: b.dataset.k, id: b.dataset.id };
  setTimeout(() => actionToast(b.dataset.t === "call" ? "How did the call go?" : b.dataset.t === "email" ? "Log this email?" : "Log this message?", "Log it", () => crmLogSheet(ref, b.dataset.t === "wa" ? "note" : b.dataset.t)), 400);
  return true;
});

// ── lead detail ──
route("crm/lead/:id", ({ id }) => {
  const l = crmLead(id);
  if (!l) return `<div class="screen">${topbar("Lead")}${emptyState(["user"], "Lead not found", "It may have been deleted.", `<button class="btn primary" data-go="#/crm?tab=leads">All leads</button>`)}</div>`;
  const acts = crmActsFor("lead", l.id).sort((a, b) => (a.done === b.done ? b.ts - a.ts : a.done ? 1 : -1));
  const deal = l.deal && crmDeal(l.deal);
  return `<div class="screen ${l.status !== "converted" ? "has-foot" : ""}">${topbar("Lead", { sub: l.source })}
    <div class="scroll"><div class="stack">
      <div class="crm-phero">${crmAv(l, "lg")}<span class="grow" style="min-width:0"><h1>${esc(l.name)}</h1><span class="small muted">${esc(l.title)} · ${esc(l.company)}</span><span class="crm-pmeta"><span class="crm-st" style="--c:${LEAD_ST[l.status][1]}">${LEAD_ST[l.status][0]}</span><span class="small muted">${crmScoreTxt(l.score)}</span></span></span></div>
      ${deal ? `<button class="banner ok" data-go="#/crm/deal/${deal.id}">${I("award")}Converted to “${esc(deal.name)}”<span class="grow"></span>${I("chevR")}</button>` : ""}
      ${crmQuick(l, { k: "lead", id: l.id })}
      ${l.status !== "converted" ? `<div class="sec"><h2 class="sec-ic">${I("target")}Status</h2></div>
      <div class="choices crm-stch">${["new", "contacted", "qualified", "unqualified"].map((s) => `<button class="choice ${l.status === s ? "on" : ""}" data-act="crmLeadSt" data-id="${l.id}" data-v="${s}">${LEAD_ST[s][0]}</button>`).join("")}</div>` : ""}
      <div class="sec"><h2 class="sec-ic">${I("info")}Details</h2><button class="link" data-act="crmEditLead" data-id="${l.id}">Edit</button></div>
      <div class="card"><div class="cd-kv">
        <div><span class="kv-ic"><i class="tint t-violet">${I("mail")}</i>Email</span><b class="ell">${esc(l.email || "—")}</b></div>
        <div><span class="kv-ic"><i class="tint t-green">${I("phone")}</i>Phone</span><b>${esc(l.phone || "—")}</b></div>
        <div><span class="kv-ic"><i class="tint t-amber">${I("globe")}</i>Source</span><b>${esc(l.source)}</b></div>
        <div><span class="kv-ic"><i class="tint t-blue">${I("calendar")}</i>Added</span><b>${D.long(D.iso(l.created))}</b></div>
      </div></div>
      <div class="sec"><h2 class="sec-ic">${I("history")}Activity</h2><button class="link" data-act="crmLog" data-k="lead" data-id="${l.id}">${I("plus")}Log</button></div>
      ${acts.length ? `<div class="feed crm-feed">${acts.map((a) => crmActFd(a)).join("")}</div>` : emptyMini("history", "No calls or notes yet. Log your first touch.")}
    </div></div>
    ${l.status !== "converted" ? `<div class="foot"><button class="btn primary block" data-act="crmConvert" data-id="${l.id}" ${l.status === "unqualified" ? "disabled" : ""}>${I("arrowUp")}Convert to deal</button>${l.status === "unqualified" ? `<p class="tiny muted" style="text-align:center;margin-top:6px">Unqualified leads can’t be converted — change the status first.</p>` : ""}</div>` : ""}</div>`;
}, { parent: "#/crm?tab=leads" });
act("crmLeadSt", (b) => {
  const l = crmLead(b.dataset.id), prev = l.status; if (prev === b.dataset.v) return;
  l.status = b.dataset.v; save(); rerender();
  undoToast(`Marked ${LEAD_ST[l.status][0].toLowerCase()}`, () => { l.status = prev; save(); rerender(); });
});

// ── contact detail ──
route("crm/contact/:id", ({ id }) => {
  const c = crmContact(id);
  if (!c) return `<div class="screen">${topbar("Contact")}${emptyState(["user"], "Contact not found", "It may have been deleted.", `<button class="btn primary" data-go="#/crm?tab=contacts">All contacts</button>`)}</div>`;
  const deals = S.crm.deals.filter((d) => d.contact === c.id), dealIds = deals.map((d) => d.id);
  const acts = S.crm.acts.filter((a) => (a.ref.k === "contact" && a.ref.id === c.id) || (a.ref.k === "deal" && dealIds.includes(a.ref.id))).sort((a, b) => (a.done === b.done ? b.ts - a.ts : a.done ? 1 : -1));
  return `<div class="screen">${topbar("Contact")}
    <div class="scroll"><div class="stack">
      <div class="crm-phero">${crmAv(c, "lg")}<span class="grow" style="min-width:0"><h1>${esc(c.name)}</h1><span class="small muted">${esc(c.title)} · ${esc(c.company)}</span></span></div>
      ${crmQuick(c, { k: "contact", id: c.id })}
      <div class="sec"><h2 class="sec-ic">${I("info")}Details</h2><button class="link" data-act="crmEditContact" data-id="${c.id}">Edit</button></div>
      <div class="card"><div class="cd-kv">
        <div><span class="kv-ic"><i class="tint t-violet">${I("mail")}</i>Email</span><b class="ell">${esc(c.email || "—")}</b></div>
        <div><span class="kv-ic"><i class="tint t-green">${I("phone")}</i>Phone</span><b>${esc(c.phone || "—")}</b></div>
        <div><span class="kv-ic"><i class="tint t-amber">${I("building")}</i>Company</span><b>${esc(c.company)}</b></div>
      </div></div>
      <div class="sec"><h2 class="sec-ic">${I("target")}Deals</h2><button class="link" data-act="crmNewDeal" data-c="${c.id}">${I("plus")}New deal</button></div>
      ${deals.length ? `<div class="card crm-list">${deals.map((d) => `<button class="crm-row" data-go="#/crm/deal/${d.id}">${stageDot(d.stage)}<span class="grow" style="min-width:0"><b class="ell">${esc(d.name)}</b><span class="small muted">${stageName(d.stage)} · ${crmAmt(d.value)}</span></span>${I("chevR")}</button>`).join("")}</div>` : emptyMini("target", "No deals with this contact yet.")}
      <div class="sec"><h2 class="sec-ic">${I("history")}Activity</h2><button class="link" data-act="crmLog" data-k="contact" data-id="${c.id}">${I("plus")}Log</button></div>
      ${acts.length ? `<div class="feed crm-feed">${acts.map((a) => crmActFd(a, a.ref.k !== "contact")).join("")}</div>` : emptyMini("history", "No calls, emails or notes yet.")}
    </div></div></div>`;
}, { parent: "#/crm?tab=contacts" });

// ── stage moves ──
function crmSetStage(d, to, extra = {}) {
  const prev = { stage: d.stage, prob: d.prob, history: [...d.history], lostReason: d.lostReason };
  d.stage = to; d.prob = stageProb(to); d.history.push({ stage: to, ts: Date.now() }); Object.assign(d, extra);
  if (to !== "lost") delete d.lostReason;
  save(); rerender(); try { navigator.vibrate?.(12); } catch {}
  return () => { Object.assign(d, prev); if (!prev.lostReason) delete d.lostReason; save(); rerender(); };
}
function crmMoveTo(d, to, checked) {
  if (!d || d.stage === to) return;
  if (to === "lost") return crmLostSheet(d);
  const fwd = to === "won" ? d.stage === "negotiation" : CRM_OPEN.indexOf(to) > CRM_OPEN.indexOf(d.stage);
  // moving forward goes through the current stage's checklist first
  if (fwd && !checked && !crmChecks(d).every(Boolean)) return crmChecklistSheet(d, to);
  if (to === "won") return crmWonSheet(d);
  const undo = crmSetStage(d, to);
  undoToast(`${fwd ? "Moved" : "Moved back"} to ${stageName(to)}`, undo);
}
act("crmMove", (b) => crmMoveTo(crmDeal(b.dataset.id), b.dataset.v));
function crmMoveSheet(d) {
  if (!d) return;
  pickOption({ title: `Move “${d.name}”`, value: d.stage, options: CRM_STAGES.map(([v, l, p]) => ({ v, label: l, sub: v === "won" ? "Closed — signed" : v === "lost" ? "Closed — not going ahead" : `${p}% likely · ${S.crm.deals.filter((x) => x.stage === v).length} deals here`, icon: v === "won" ? "award" : v === "lost" ? "x" : "arrowUp" })), onPick: (v) => crmMoveTo(d, v) });
}
act("crmNext", (b) => { const d = crmDeal(b.dataset.id); if (!d) return; const ok = crmChecks(d).every(Boolean); ok ? crmMoveTo(d, crmNextStage(d), true) : crmChecklistSheet(d, crmNextStage(d)); });
// bottom drawer: tick the current stage's checklist, then move on (ticks are saved as you go)
function crmChecklistSheet(d, to) {
  const list = CRM_CHECK[d.stage] || [], from = d.stage;
  const skipped = to !== "won" ? CRM_OPEN.slice(CRM_OPEN.indexOf(from) + 1, CRM_OPEN.indexOf(to)) : [];
  const s = openSheet({ title: to === "won" ? "Ready to close?" : `Move to ${stageName(to)}`, body: `<div data-f></div>`, foot: `<button class="btn primary block" data-s="go"></button>`,
    onMount(el) {
      const draw = () => {
        const got = crmChecks(d), n = got.filter(Boolean).length, all = n === list.length;
        el.querySelector("[data-f]").innerHTML = `
          <div class="crm-ck-hd"><span class="crm-ck-from" style="--c:${STAGE_C[from]}">${stageName(from)}</span>${I("chevR")}<span class="crm-ck-from" style="--c:${STAGE_C[to]}">${stageName(to)}</span><span class="grow"></span><b class="${all ? "ok" : ""}">${n}/${list.length}</b></div>
          <span class="crm-ck-bar"><i style="width:${list.length ? n / list.length * 100 : 0}%"></i></span>
          <p class="small muted" style="margin:10px 2px 8px">Tick what’s done in ${stageName(from)} before moving on.${skipped.length ? ` This also skips ${skipped.map(stageName).join(" and ")}.` : ""}</p>
          <div class="crm-ck-list">${list.map(([label, hint], i) => `<button class="crm-ck ${got[i] ? "on" : ""}" data-s="ck" data-i="${i}" role="checkbox" aria-checked="${got[i]}"><span class="crm-ck-box">${I("check")}</span><span class="grow"><b>${esc(label)}</b><small>${esc(hint)}</small></span></button>`).join("")}</div>
          ${!all ? `<button class="link crm-ck-all" data-s="all">Tick all</button>` : ""}`;
        const go = el.querySelector("[data-s=go]");
        go.disabled = !all;
        go.innerHTML = all ? (to === "won" ? `${I("award")}Continue to close as won` : `Move to ${stageName(to)}${I("chevR")}`) : `${list.length - n} left to tick`;
      };
      const setChecks = (arr) => { d.checks ||= {}; d.checks[from] = arr; save(); draw(); };
      onS(el, {
        ck(b) { const i = Number(b.dataset.i), cur = new Set(d.checks?.[from] || []); cur.has(i) ? cur.delete(i) : cur.add(i); try { navigator.vibrate?.(8); } catch {} setChecks([...cur]); },
        all() { setChecks(list.map((_, i) => i)); },
        go() { if (!crmChecks(d).every(Boolean)) return; closeSheet(s); setTimeout(() => crmMoveTo(d, to, true), 180); },
      });
      draw();
    },
    onClose() { rerender(); } });
}
function crmLostSheet(d) {
  let reason = "", err = false;
  const s = openSheet({ title: "Why was it lost?", body: `<div data-f></div>`, foot: `<button class="btn primary block" data-s="ok" style="background:var(--danger)!important">Mark as lost</button>`,
    onMount(el) {
      const draw = () => { el.querySelector("[data-f]").innerHTML = `<p class="small muted" style="margin:-4px 0 12px">This helps the team see patterns. ${esc(d.name)} will move to Lost.</p>
        <div class="choices">${LOST_REASONS.map((r) => `<button class="choice ${reason === r ? "on" : ""}" data-s="r" data-v="${esc(r)}">${esc(r)}</button>`).join("")}</div>${err ? `<span class="fld-err" style="margin-top:8px">${I("alert")}Pick a reason to continue.</span>` : ""}`; };
      onS(el, { r(b) { reason = b.dataset.v; err = false; draw(); }, ok() { if (!reason) { err = true; return draw(); } closeSheet(s); const undo = crmSetStage(d, "lost", { lostReason: reason }); undoToast("Marked as lost", undo); } });
      draw();
    } });
}
function crmWonSheet(d) {
  const s = openSheet({ title: "", body: `<div class="crm-won">${successTick()}<h2>Deal won!</h2><p class="muted">${esc(d.name)} · ${crmAmt(d.value)}</p><p class="small muted">We’ll let the deal team know and close the deal room.</p></div>`,
    foot: `<div class="row-btns"><button class="btn outline" style="flex:1" data-s="no">Not yet</button><button class="btn primary" style="flex:1" data-s="ok">${I("award")}Confirm win</button></div>`,
    onMount(el) { onS(el, { no() { closeSheet(s); }, ok() {
      closeSheet(s); crmSetStage(d, "won");
      const c = pcOf(d.id); c.msgs.push({ id: uid(), who: "me", ts: Date.now(), text: `🎉 We won ${d.name} — ${crmAmt(d.value)}! Thanks everyone.` }); save();
      toast(`Deal won · ${crmAmt(d.value)}`);
    } }); } });
}
act("crmReopen", (b) => { const d = crmDeal(b.dataset.id), back = [...d.history].reverse().find((h) => CRM_OPEN.includes(h.stage))?.stage || "negotiation"; const undo = crmSetStage(d, back); undoToast(`Reopened in ${stageName(back)}`, undo); });

// ── activities ──
act("crmDone", (b) => {
  const a = S.crm.acts.find((x) => x.id === b.dataset.id); if (!a) return;
  a.done = true; a.doneTs = Date.now(); const prevTs = a.ts; a.ts = Date.now(); save();
  b.closest(".crm-act, .fd")?.classList.add("done");
  setTimeout(rerender, 360); try { navigator.vibrate?.(12); } catch {}
  undoToast(`“${a.title}” done`, () => { a.done = false; a.ts = prevTs; save(); rerender(); });
});
act("crmActOpen", (b) => {
  const a = S.crm.acts.find((x) => x.id === b.dataset.id); if (!a) return;
  const [label, ic, c] = ACT_T[a.type], overdue = !a.done && a.due && a.due < D.today(), refIc = a.ref.k === "deal" ? "target" : a.ref.k === "lead" ? "sparkles" : "user";
  const status = a.done ? ["Done", "var(--ok)"] : overdue ? ["Overdue", "var(--danger)"] : ["Planned", "#3b82f6"];
  const row = (icon, tint, k, v, attr = "") => `${attr ? `<button class="crm-kv" ${attr}>` : "<div>"}<span class="kv-ic"><i class="tint ${tint}">${I(icon)}</i>${k}</span><b class="pj-kv-v">${v}</b>${attr ? I("chevR") + "</button>" : "</div>"}`;
  const s = openSheet({ title: "", cls: "crm-as-sheet", body: `<div class="crm-as">
      <div class="crm-as-hd"><span class="crm-act-ic lg" style="--c:${c}">${I(ic)}</span><span class="grow" style="min-width:0"><span class="crm-as-meta">${label}<span class="crm-st" style="--c:${status[1]}">${status[0]}</span></span><h2>${esc(a.title)}</h2></span></div>
      <div class="card"><div class="cd-kv">
        ${row(refIc, "t-blue", "Related to", `<span class="ell">${esc(crmRefName(a.ref).split(" · ")[0])}</span>`, `data-s="ref"`)}
        ${row("calendar", overdue ? "t-red" : "t-violet", a.done ? "Logged" : "Due", `<span class="${overdue ? "bad" : ""}">${a.done ? `${D.short(D.iso(a.ts))} · ${D.time(a.ts)}` : `${crmDayTxt(a.due)}`}</span>`)}
        ${!a.done && a.due ? row("clock", "t-amber", "Time", a.time ? D.hm(a.time) : "Any time") : ""}
        ${a.outcome ? row("phone", "t-green", "Outcome", esc(a.outcome)) : ""}
        ${a.dur ? row("history", "t-slate", "Duration", `${a.dur} min`) : ""}
        ${row("user", "t-teal", "Owner", `<span class="hrow" style="gap:6px">${avatar("me", "xs")}You</span>`)}
      </div></div>
      ${a.notes ? `<div class="sec" style="margin-top:14px"><h2 class="sec-ic">${I("edit")}Notes</h2></div><p class="crm-notes">${esc(a.notes)}</p>` : ""}
      <button class="crm-as-del" data-s="del">${I("trash")}Delete activity</button>
    </div>`,
    foot: a.done ? `<button class="btn primary block" data-s="follow">${I("plus")}Plan a follow-up</button>`
      : `<div class="row-btns"><button class="btn outline" style="flex:1" data-s="resched">${I("calendar")}Reschedule</button><button class="btn primary" style="flex:1" data-s="done">${I("check")}Mark done</button></div>`,
    onMount(el) { onS(el, {
      ref() { closeSheet(s); go(crmRefHref(a.ref)); },
      done() { closeSheet(s); a.done = true; a.ts = Date.now(); save(); rerender(); toast("Marked done"); },
      follow() { closeSheet(s); setTimeout(() => crmLogSheet(a.ref, "task"), 180); },
      resched() {
        pickDates({ title: "Reschedule to", mode: "single", start: a.due < D.today() ? D.today() : a.due, min: D.today(), onDone: ({ start }) => {
          const prev = a.due; a.due = start; save(); closeSheet(s); rerender();
          undoToast(`Moved to ${crmDayTxt(start)}`, () => { a.due = prev; save(); rerender(); });
        } });
      },
      del() { closeSheet(s); const i = S.crm.acts.indexOf(a); S.crm.acts.splice(i, 1); save(); rerender(); undoToast("Activity deleted", () => { S.crm.acts.splice(i, 0, a); save(); rerender(); }); },
    }); } });
});
act("crmLog", (b) => crmLogSheet({ k: b.dataset.k, id: b.dataset.id }));
function crmLogSheet(ref, type = "call") {
  const F = { type, title: "", outcome: "Connected", dur: 15, notes: "", plan: false, due: D.add(D.today(), 1), time: "" };
  if (ref.k === "deal" || ref.k === "lead") { /* keep */ }
  const s = openSheet({ title: ref ? `Log for ${crmRefName(ref).split(" · ")[0]}` : "Log activity", body: `<div data-f></div>`, foot: `<button class="btn primary block" data-s="ok">Save</button>`,
    onMount(el) {
      const draw = (err = {}) => {
        const isTask = F.type === "task", planned = isTask || F.plan;
        el.querySelector("[data-f]").innerHTML = `<div class="stack s16">
          <div class="crm-types">${Object.entries(ACT_T).map(([k, [l, ic, c]]) => `<button class="${F.type === k ? "on" : ""}" style="--c:${c}" data-s="ty" data-v="${k}">${I(ic)}<span>${l}</span></button>`).join("")}</div>
          <div class="field"><label for="ca-t">${isTask ? "What needs doing?" : "Subject"}</label><input id="ca-t" class="inp ${err.title ? "bad" : ""}" data-k="title" maxlength="80" placeholder="${isTask ? "Ex: Send revised quote" : F.type === "call" ? "Ex: Pricing follow-up" : F.type === "meeting" ? "Ex: Demo with ops team" : F.type === "email" ? "Ex: Sent proposal" : "Ex: Budget confirmed"}" value="${esc(F.title)}">${err.title ? `<span class="fld-err">${I("alert")}${err.title}</span>` : ""}</div>
          ${!isTask && F.type !== "note" ? `<label class="crm-plan"><input type="checkbox" class="check" data-plan ${F.plan ? "checked" : ""}><span>Schedule it for later instead of logging it as done</span></label>` : ""}
          ${F.type === "call" && !planned ? `<div class="field"><span class="lbl">Outcome</span><div class="choices">${CALL_OUT.map((o) => `<button class="choice ${F.outcome === o ? "on" : ""}" data-s="out" data-v="${o}">${o}</button>`).join("")}</div></div>` : ""}
          ${(F.type === "call" || F.type === "meeting") ? `<div class="field"><span class="lbl">Duration</span><div class="choices">${[5, 15, 30, 45, 60].map((m) => `<button class="choice ${F.dur === m ? "on" : ""}" data-s="dur" data-v="${m}">${m} min</button>`).join("")}</div></div>` : ""}
          ${planned ? `<div class="field"><span class="lbl">When</span><div class="dt-pick">
              <button type="button" class="dt-btn ${err.due ? "bad" : ""}" data-s="pdue">${I("calendar")}<span><small>Date</small><b>${F.due ? crmDayTxt(F.due) : "Pick a date"}</b></span></button>
              <button type="button" class="dt-btn" data-s="ptime">${I("clock")}<span><small>Time <em>(optional)</em></small><b class="${F.time ? "" : "ph"}">${F.time ? D.hm(F.time) : "Any time"}</b></span></button>
            </div>${err.due ? `<span class="fld-err">${I("alert")}${err.due}</span>` : ""}</div>` : ""}
          <div class="field"><label for="ca-n">Notes <span class="opt">(optional)</span></label><textarea id="ca-n" class="inp" data-k="notes" maxlength="600" placeholder="What was discussed, next steps…">${esc(F.notes)}</textarea></div>
        </div>`;
      };
      el.addEventListener("input", (e) => { const k = e.target.dataset.k; if (k) F[k] = e.target.value; });
      el.addEventListener("change", (e) => { if (e.target.matches("[data-plan]")) { F.plan = e.target.checked; draw(); } });
      onS(el, {
        pdue() { pickDates({ title: "Due date", mode: "single", start: F.due || D.today(), min: D.today(), onDone: ({ start }) => { F.due = start; draw(); } }); },
        ptime() { pickTime({ title: "Time", value: F.time, onDone: (t) => { F.time = t; draw(); } }); },
        ty(b) { F.type = b.dataset.v; draw(); }, out(b) { F.outcome = b.dataset.v; draw(); }, dur(b) { F.dur = Number(b.dataset.v); draw(); },
        ok() {
          const planned = F.type === "task" || F.plan, err = {};
          if (F.title.trim().length < 3) err.title = "Add a short subject (at least 3 characters).";
          if (planned && (!F.due || F.due < D.today())) err.due = "Pick today or a later date.";
          if (Object.keys(err).length) return draw(err);
          const a = { id: uid(), type: F.type, title: F.title.trim(), ref, who: "me", ts: Date.now(), done: !planned, notes: F.notes.trim(),
            ...(F.type === "call" && !planned ? { outcome: F.outcome } : {}), ...((F.type === "call" || F.type === "meeting") ? { dur: F.dur } : {}), ...(planned ? { due: F.due, time: F.time } : {}) };
          S.crm.acts.push(a);
          if (ref.k === "lead") { const l = crmLead(ref.id); if (l && l.status === "new" && !planned) l.status = "contacted"; }
          save(); closeSheet(s); rerender(); toast(planned ? `${ACT_T[F.type][0]} scheduled for ${crmWhen(a)}` : `${ACT_T[F.type][0]} logged`);
        },
      });
      draw();
    } });
}

// ── create / edit forms ──
function crmForm({ title, fields, data, cta, onSave }) {
  const F = { ...data };
  const s = openSheet({ title, body: `<div data-f></div>`, foot: `<button class="btn primary block" data-s="ok">${cta}</button>`,
    onMount(el) {
      const draw = (err = {}) => {
        el.querySelector("[data-f]").innerHTML = `<div class="stack s16">${fields.map((f) => {
          const e = err[f.k] ? `<span class="fld-err">${I("alert")}${err[f.k]}</span>` : "";
          if (f.type === "date") return `<div class="field"><span class="lbl">${f.label}</span><button type="button" class="dt-btn wide ${err[f.k] ? "bad" : ""}" data-s="pdate" data-k="${f.k}">${I("calendar")}<span><small>${F[f.k] ? D.long(F[f.k]) : "Date"}</small><b class="${F[f.k] ? "" : "ph"}">${F[f.k] ? crmDayTxt(F[f.k]) : "Pick a date"}</b></span>${I("chevD")}</button>${e}</div>`;
          if (f.choices) return `<div class="field"><span class="lbl">${f.label}</span><div class="choices">${f.choices.map(([v, l]) => `<button class="choice ${String(F[f.k]) === String(v) ? "on" : ""}" data-s="ch" data-k="${f.k}" data-v="${esc(String(v))}">${esc(l)}</button>`).join("")}</div>${e}</div>`;
          return `<div class="field"><label for="cf-${f.k}">${f.label}${f.req ? "" : ` <span class="opt">(optional)</span>`}</label><input id="cf-${f.k}" class="inp ${err[f.k] ? "bad" : ""}" data-k="${f.k}" type="${f.type || "text"}" ${f.type === "number" ? 'inputmode="numeric" min="0"' : ""} ${f.min ? `min="${f.min}"` : ""} placeholder="${esc(f.ph || "")}" value="${esc(F[f.k] ?? "")}" autocomplete="off">${f.hint ? `<span class="tiny muted">${f.hint}</span>` : ""}${e}</div>`;
        }).join("")}</div>`;
      };
      el.addEventListener("input", (e) => { const k = e.target.dataset.k; if (k) F[k] = e.target.value; });
      onS(el, {
        ch(b) { F[b.dataset.k] = b.dataset.v; draw(); },
        pdate(b) { const f = fields.find((x) => x.k === b.dataset.k); pickDates({ title: f.label, mode: "single", start: F[f.k] || D.today(), min: f.min || null, onDone: ({ start }) => { F[f.k] = start; draw(); } }); },
        ok() {
          const err = {};
          fields.forEach((f) => {
            const v = String(F[f.k] ?? "").trim();
            if (f.req && !v) err[f.k] = `${f.label} is needed.`;
            else if (v && f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) err[f.k] = "That email doesn’t look right.";
            else if (v && f.type === "tel" && v.replace(/[^\d]/g, "").length < 10) err[f.k] = "Enter a 10-digit phone number.";
            else if (f.type === "number" && f.req && !(Number(v) > 0)) err[f.k] = "Enter an amount above zero.";
            else if (f.type === "date" && f.req && f.min && v < f.min) err[f.k] = "Pick today or a later date.";
            else if (f.check) { const m = f.check(v, F); if (m) err[f.k] = m; }
          });
          if (Object.keys(err).length) return draw(err);
          closeSheet(s); onSave(F);
        },
      });
      draw();
    } });
}
const LEAD_FIELDS = [{ k: "name", label: "Name", req: true, ph: "Ex: Priya Raman" }, { k: "company", label: "Company", req: true, ph: "Ex: Sunrise Hotels" }, { k: "title", label: "Job title", ph: "Ex: HR Manager" },
  { k: "email", label: "Email", type: "email", ph: "name@company.com" }, { k: "phone", label: "Phone", type: "tel", ph: "+91 98765 43210" }, { k: "source", label: "Source", choices: LEAD_SRC.map((x) => [x, x]) }];
const CONTACT_FIELDS = [{ k: "name", label: "Name", req: true, ph: "Ex: Meera Iyer" }, { k: "company", label: "Company", req: true, ph: "Ex: Northwind Retail" }, { k: "title", label: "Job title", ph: "Ex: Head of IT" },
  { k: "email", label: "Email", type: "email", ph: "name@company.com" }, { k: "phone", label: "Phone", type: "tel", ph: "+91 98765 43210" }];
const dealFields = () => [{ k: "name", label: "Deal name", req: true, ph: "Ex: HRMS rollout — 500 seats", check: (v) => (v.length < 3 ? "Give the deal a short name." : "") },
  { k: "value", label: "Value (₹)", type: "number", req: true, ph: "Ex: 500000", hint: "Total contract value" },
  { k: "contact", label: "Contact", choices: S.crm.contacts.map((c) => [c.id, `${c.name.split(" ")[0]} · ${c.company}`]) },
  { k: "stage", label: "Stage", choices: CRM_OPEN.map((s) => [s, stageName(s)]) },
  { k: "close", label: "Expected close", type: "date", req: true, min: D.today() }];
const leadEmailDup = (v, F) => (v && S.crm.leads.some((l) => l.email === v && l.id !== F.id) ? "A lead with this email already exists." : "");
LEAD_FIELDS[3].check = leadEmailDup;

act("crmNew", () => {
  const s = openSheet({ title: "Add to CRM", body: `<div class="list">${[["lead", "target", "Lead", "A new enquiry to qualify"], ["deal", "dollar", "Deal", "An opportunity in your pipeline"], ["contact", "user", "Contact", "A person at a customer"], ["act", "edit", "Activity", "Log a call, meeting, email or note"]]
    .map(([v, ic, l, sub]) => `<button class="opt-row" data-s="pick" data-v="${v}"><span class="ic">${I(ic)}</span><span class="grow"><span class="b">${l}</span><span class="small muted" style="display:block">${sub}</span></span>${I("chevR")}</button>`).join("")}</div>`,
    onMount(el) { onS(el, { pick(b) { closeSheet(s); const v = b.dataset.v;
      if (v === "lead") crmNewLead(); else if (v === "contact") crmNewContact(); else if (v === "deal") ACTIONS.crmNewDeal({ dataset: {} });
      else pickOption({ title: "Log for…", options: [...crmOpenDeals().map((d) => ({ v: "deal:" + d.id, label: d.name, sub: `Deal · ${d.company}`, icon: "target" })), ...S.crm.leads.filter((l) => l.status !== "converted").map((l) => ({ v: "lead:" + l.id, label: l.name, sub: `Lead · ${l.company}`, icon: "user" }))], onPick: (x) => { const [k, id] = x.split(":"); crmLogSheet({ k, id }); } });
    } }); } });
});
function crmNewLead() {
  crmForm({ title: "New lead", fields: LEAD_FIELDS, data: { source: "Website" }, cta: "Add lead", onSave(F) {
    const l = { id: "l" + uid(), name: F.name.trim(), company: F.company.trim(), title: (F.title || "").trim(), email: (F.email || "").trim(), phone: (F.phone || "").trim(), source: F.source, status: "new", score: 50 + Math.round(Math.random() * 30), tint: CRM_TINTS[S.crm.leads.length % CRM_TINTS.length], owner: "me", created: Date.now() };
    S.crm.leads.push(l); save(); go(`#/crm/lead/${l.id}`); toast("Lead added");
  } });
}
function crmNewContact(after) {
  crmForm({ title: "New contact", fields: CONTACT_FIELDS, data: {}, cta: "Add contact", onSave(F) {
    if (S.crm.contacts.some((c) => c.name.toLowerCase() === F.name.trim().toLowerCase() && c.company.toLowerCase() === F.company.trim().toLowerCase())) return toast(`${F.name} at ${F.company} is already a contact`, "bad");
    const c = { id: "c" + uid(), name: F.name.trim(), company: F.company.trim(), title: (F.title || "").trim(), email: (F.email || "").trim(), phone: (F.phone || "").trim(), tint: CRM_TINTS[S.crm.contacts.length % CRM_TINTS.length], owner: "me", created: Date.now() };
    S.crm.contacts.push(c); save(); after ? after(c) : go(`#/crm/contact/${c.id}`); toast("Contact added");
  } });
}
act("crmNewDeal", (b) => {
  if (!S.crm.contacts.length) return crmNewContact(() => ACTIONS.crmNewDeal({ dataset: {} }));
  crmForm({ title: "New deal", fields: dealFields(), data: { contact: b.dataset.c || S.crm.contacts[0].id, stage: "qualify", close: D.add(D.today(), 30) }, cta: "Create deal", onSave(F) {
    const c = crmContact(F.contact), d = { id: "d" + uid(), name: F.name.trim(), contact: c.id, company: c.company, value: Math.round(Number(F.value)), stage: F.stage, prob: stageProb(F.stage), close: F.close, owner: "me", team: ["me"], created: Date.now(), history: [{ stage: F.stage, ts: Date.now() }] };
    S.crm.deals.push(d); save(); go(`#/crm/deal/${d.id}`); toast("Deal created");
  } });
});
act("crmEditDeal", (b) => {
  const d = crmDeal(b.dataset.id);
  crmForm({ title: "Edit deal", fields: dealFields().filter((f) => f.k !== "stage").map((f) => (f.k === "close" ? { ...f, min: "" } : f)), data: { ...d }, cta: "Save changes", onSave(F) {
    const c = crmContact(F.contact); Object.assign(d, { name: F.name.trim(), value: Math.round(Number(F.value)), contact: c.id, company: c.company, close: F.close }); save(); rerender(); toast("Deal updated");
  } });
});
act("crmEditLead", (b) => { const l = crmLead(b.dataset.id); crmForm({ title: "Edit lead", fields: LEAD_FIELDS, data: { ...l }, cta: "Save changes", onSave(F) { Object.assign(l, { name: F.name.trim(), company: F.company.trim(), title: (F.title || "").trim(), email: (F.email || "").trim(), phone: (F.phone || "").trim(), source: F.source }); save(); rerender(); toast("Lead updated"); } }); });
act("crmEditContact", (b) => { const c = crmContact(b.dataset.id); crmForm({ title: "Edit contact", fields: CONTACT_FIELDS, data: { ...c }, cta: "Save changes", onSave(F) { Object.assign(c, { name: F.name.trim(), company: F.company.trim(), title: (F.title || "").trim(), email: (F.email || "").trim(), phone: (F.phone || "").trim() }); S.crm.deals.filter((d) => d.contact === c.id).forEach((d) => (d.company = c.company)); save(); rerender(); toast("Contact updated"); } }); });

// lead → contact + deal
act("crmConvert", (b) => {
  const l = crmLead(b.dataset.id);
  if (l.status === "unqualified") return toast("Change the status before converting", "bad");
  crmForm({ title: `Convert ${l.name.split(" ")[0]}`, fields: dealFields().filter((f) => f.k !== "contact"), data: { name: `${l.company} — new deal`, stage: "qualify", close: D.add(D.today(), 30) }, cta: "Create contact & deal", onSave(F) {
    let c = S.crm.contacts.find((x) => x.email && x.email === l.email);
    if (!c) { c = { id: "c" + uid(), name: l.name, company: l.company, title: l.title, email: l.email, phone: l.phone, tint: l.tint, owner: "me", created: Date.now() }; S.crm.contacts.push(c); }
    const d = { id: "d" + uid(), name: F.name.trim(), contact: c.id, company: c.company, value: Math.round(Number(F.value)), stage: F.stage, prob: stageProb(F.stage), close: F.close, owner: "me", team: ["me"], created: Date.now(), history: [{ stage: F.stage, ts: Date.now() }], lead: l.id };
    S.crm.deals.push(d); l.status = "converted"; l.deal = d.id;
    S.crm.acts.filter((a) => a.ref.k === "lead" && a.ref.id === l.id).forEach((a) => (a.ref = { k: "deal", id: d.id }));
    save(); go(`#/crm/deal/${d.id}`); toast(`${l.name} converted — deal created`);
  } });
});

// ── Apps tile + icon ──
MS_STYLE.crm = ["target", "#0EA5E9", "#0369A1", "#B9E6FB", "#6CC8F3"];
MS_STYLE.leads = ["users", "#9061F9", "#5B2BC9", "#D8C7FD", "#AF8BFB"];
TILE_MS.target = "crm"; TILE_MS.users = "leads";
