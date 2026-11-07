// State: seeded demo data persisted to localStorage
const STORE_KEY = "kebs.app.v1";

const SHIFT = { name: "General", start: "09:30", end: "18:30" };
const OFFICE = { name: "India HO – Chennai", addr: "KEBS, Ambattur Estate, Chennai 600096", lat: 13.0982, lng: 80.1618, radius: 150 };

const LEAVE_TYPES = [
  { id: "casual", name: "Casual Leave", total: 12, tint: "t-blue" },
  { id: "sick", name: "Sick Leave", total: 8, tint: "t-red" },
  { id: "earned", name: "Earned Leave", total: 15, tint: "t-green" },
  { id: "floater", name: "Floater Holiday", total: 2, tint: "t-violet" },
  { id: "compoff", name: "Comp Off", total: null, tint: "t-amber" },
];

// one icon per leave type (balances, the leave-type picker, request cards)
const LEAVE_ICON = { casual: "coffee", sick: "heartPulse", earned: "plane", floater: "sparkles", compoff: "history" };
const leaveIcon = (id) => LEAVE_ICON[id] || "calendar";

const REQ_TYPES = {
  wfh: { name: "Work From Home", short: "WFH", icon: "home", tint: "t-orange" },
  partial: { name: "Partial Day", short: "Partial day", icon: "clock", tint: "t-violet" },
  onduty: { name: "On Duty", short: "On duty", icon: "briefcase", tint: "t-teal" },
  regularize: { name: "Attendance Regularization", short: "Regularization", icon: "calendar", tint: "t-blue" },
  leave: { name: "Leave", short: "Leave", icon: "calendar", tint: "t-red" },
  compoff: { name: "Comp-off credit", short: "Comp-off", icon: "coffee", tint: "t-amber" },
};

const PROJECTS = [
  { id: "p1", name: "Mobile app development – iOS", owner: "Jim H", tasks: ["Home screen API integration", "Design user accessibility testing", "Push notification setup", "Release build QA"] },
  { id: "p2", name: "Design system – KEBS Lite 2.0", owner: "Aravind S", tasks: ["Design system development", "Scrum sheet update – Components", "Scrum sheet update – Colors", "Icon library audit"] },
  { id: "p3", name: "Android application", owner: "Reesa B", tasks: ["My team – android development", "Code refactoring – Android & iOS", "Task_2124 – MobMod"] },
  { id: "p4", name: "KEBS Expense", owner: "Jim H", tasks: ["Design user accessibility testing", "Receipt OCR flows"] },
  { id: "p5", name: "Internal", owner: "HR", tasks: ["Team meeting", "Learning & development"], nonbill: true },
];

function holidaysFor(year) {
  const list = [
    ["01-01", "New Year's Day"], ["01-14", "Makara Sankranti"], ["01-26", "Republic Day"], ["02-15", "Maha Shivaratri"], ["03-04", "Holi"],
    ["03-19", "Ugadi", 1], ["03-20", "Eid al-Fitr"], ["04-03", "Good Friday", 1], ["05-01", "May Day"], ["08-15", "Independence Day"],
    ["09-14", "Ganesh Chaturthi"], ["10-02", "Gandhi Jayanti"], ["10-20", "Dussehra"], ["11-09", "Diwali"], ["12-25", "Christmas", 1],
  ];
  return list.map(([md, name, floater]) => ({ date: `${year}-${md}`, name, floater: !!floater }));
}

const QUICK_ACTIONS = [
  { id: "scan", label: "Scan bill", cat: "Expense", icon: "scan", tint: "t-blue", go: "#/expenses/new?mode=single" },
  { id: "leave", label: "Book leave", cat: "Leave Management", icon: "calendar", tint: "t-red", go: "#/leave/apply" },
  { id: "wfh", label: "Apply WFH", cat: "Raise Request", icon: "home", tint: "t-orange", go: "#/req/wfh" },
  { id: "clock", label: "Clock in", cat: "Attendance", icon: "fingerprint", tint: "t-green", act: "clockToggle" },
  { id: "insights", label: "Expense insights", cat: "Expense", icon: "chart", tint: "t-violet", go: "#/expenses?tab=insights" },
  { id: "bills", label: "Saved receipts", cat: "Expense", icon: "receipt", tint: "t-pink", go: "#/expenses?tab=saved" },
  { id: "track", label: "Track expense", cat: "Expense", icon: "wallet", tint: "t-amber", go: "#/expenses" },
  { id: "timesheet", label: "Timesheet", cat: "Timesheet", icon: "clipboard", tint: "t-teal", go: "#/ts" },
  { id: "holidays", label: "Holidays", cat: "Leave Management", icon: "calendar", tint: "t-orange", go: "#/holidays" },
  { id: "compoff", label: "Comp off", cat: "Leave Management", icon: "coffee", tint: "t-amber", go: "#/compoff" },
  { id: "logs", label: "Time logs", cat: "Attendance", icon: "history", tint: "t-slate", go: "#/logs" },
  { id: "partial", label: "Partial day", cat: "Raise Request", icon: "clock", tint: "t-violet", go: "#/req/partial" },
  { id: "onduty", label: "On duty", cat: "Raise Request", icon: "briefcase", tint: "t-teal", go: "#/req/onduty" },
  { id: "balances", label: "Leave balances", cat: "Leave Management", icon: "list", tint: "t-blue", go: "#/leave/balances" },
  { id: "helpdesk", label: "Helpdesk", cat: "Helpdesk", icon: "ticket", tint: "t-slate", go: "#/apps?tab=helpdesk" },
  { id: "payslip", label: "Salary slips", cat: "Payroll", icon: "rupee", tint: "t-green", go: "#/pay" },
  { id: "tax", label: "Tax & declarations", cat: "Payroll", icon: "percent", tint: "t-blue", go: "#/tax" },
];
const QUICK_MAX = 7;
const QUICK_SUGGESTED = ["scan", "leave", "wfh", "clock", "insights", "bills", "track"];

// deterministic pseudo-random so seeded logs look stable
function prng(seed) { let x = seed % 2147483647; if (x <= 0) x += 2147483646; return () => (x = (x * 16807) % 2147483647) / 2147483647; }

function seed() {
  const today = D.today();
  const r = prng(Number(today.replace(/-/g, "")));
  const now = Date.now();
  const H = 3600e3;
  const people = [
    { id: "jr", name: "Jack Ryan", role: "Product Specialist", dept: "Customer Success", loc: "Hyderabad", tint: "t-violet" },
    { id: "jre", name: "Jack Reacher", role: "Product Specialist", dept: "Customer Success", loc: "Chennai", tint: "t-teal" },
    { id: "sj", name: "Surya Jayaraman", role: "HR Business Partner", dept: "People", loc: "Chennai", tint: "t-orange" },
    { id: "vi", name: "Vineeth K", role: "Frontend Engineer", dept: "Engineering", loc: "Chennai", tint: "t-blue" },
    { id: "vj", name: "Vijay Kumar", role: "Head of People", dept: "People", loc: "Chennai", tint: "t-slate" },
    { id: "as", name: "Anushka Sharma", role: "Project Manager", dept: "Delivery", loc: "Bengaluru", tint: "t-amber" },
    { id: "al", name: "Alex Morgan", role: "Scrum Master", dept: "Delivery", loc: "Remote", tint: "t-green" },
    { id: "pb", name: "Pam Beesly", role: "Account Manager", dept: "Sales", loc: "Mumbai", tint: "t-pink" },
    { id: "sl", name: "Sarah Lee", role: "UX Researcher", dept: "Design", loc: "Chennai", tint: "t-red" },
    { id: "pr", name: "Prasanna R", role: "Design Manager", dept: "Design", loc: "Chennai", tint: "t-blue" },
    { id: "dr", name: "Darlene Robertson", role: "Sales Lead", dept: "Sales", loc: "Delhi", tint: "t-violet" },
    { id: "ww", name: "Wade Warren", role: "Solutions Consultant", dept: "Sales", loc: "Pune", tint: "t-amber" },
    { id: "rb", name: "Reesa B", role: "Android Lead", dept: "Engineering", loc: "Chennai", tint: "t-teal" },
    { id: "jh", name: "Jim H", role: "Engineering Manager", dept: "Engineering", loc: "Chennai", tint: "t-green" },
  ];
  // who's off this week (for the home strip + "also on leave")
  const mon = D.monday(today);
  const offThisWeek = [{ id: "jr", date: D.add(mon, 0) }, { id: "jre", date: D.add(mon, 1) }, { id: "sl", date: D.add(mon, 3) }, { id: "vi", date: D.add(mon, 4) }];

  // attendance logs for the past ~5 weeks
  const logs = {};
  for (let d = D.add(today, -38); d < today; d = D.add(d, 1)) {
    if (D.isWeekend(d)) continue;
    const late = r() < .15;
    const inM = 9 * 60 + (late ? 38 + Math.floor(r() * 20) : 14 + Math.floor(r() * 16));
    const outM = 18 * 60 + 30 + Math.floor(r() * 45);
    const missingOut = r() < .05;
    logs[d] = { in: `${String(Math.floor(inM / 60)).padStart(2, "0")}:${String(inM % 60).padStart(2, "0")}`, out: missingOut ? null : `${String(Math.floor(outM / 60)).padStart(2, "0")}:${String(outM % 60).padStart(2, "0")}`, wfh: r() < .18 };
  }

  // timesheets: entries for last week + this week (before today); summaries for older weeks
  const entries = {};
  const NOTES = ["Wrapped up review comments", "Paired with the dev team", "Pushed changes for QA", "Sync + follow-ups", "Iterated on feedback"];
  const mk = (pid, ti, mins, billable = true) => ({ id: uid(), pid, ti, mins, billable, comment: NOTES[(ti + mins) % NOTES.length] });
  const dayPlan = [
    [["p3", 0, 480, true], ["p3", 1, 46, false], ["p3", 2, 60, true]],
    [["p2", 0, 300, true], ["p2", 1, 211, true]],
    [["p1", 0, 420, true], ["p5", 0, 60, false]],
    [["p2", 2, 240, true], ["p1", 1, 281, true]],
    [["p4", 1, 360, true], ["p5", 1, 161, false]],
  ];
  const lastMon = D.add(mon, -7);
  for (let i = 0; i < 5; i++) entries[D.add(lastMon, i)] = dayPlan[i].map((p) => mk(...p));
  for (let d = mon; d < today; d = D.add(d, 1)) if (!D.isWeekend(d)) entries[d] = dayPlan[D.wd(d)].map((p) => mk(...p));
  const weeks = { [mon]: { status: "draft", attachments: [] }, [lastMon]: { status: "pending", attachments: [{ name: "Sprint-review-notes.pdf", size: "200 KB" }], submittedAt: now - 3 * 24 * H } };
  for (let w = 2; w <= 11; w++) weeks[D.add(mon, -7 * w)] = { status: w === 3 ? "rejected" : "approved", mins: 2430 - (w % 3) * 30, tasks: 35 - (w % 4), rejected: w === 3 ? 2 : 0, attachments: [] };

  const req = (o) => ({ id: uid(), attachments: [], notify: [], comments: [], status: "pending", created: now, ...o, activity: o.activity || [{ text: "Request raised by you", ts: o.created || now, kind: "on" }] });
  const requests = [
    req({ type: "wfh", from: D.add(today, 5), to: D.add(today, 6), dayType: "full", reason: "Home internet upgrade visit – working remotely", created: now - 26 * H }),
    req({ type: "compoff", from: D.add(today, -18), to: D.add(today, -18), reason: "Supported weekend release", status: "approved", created: now - 15 * 24 * H, activity: [{ text: "Request raised by you", ts: now - 15 * 24 * H, kind: "on" }, { text: "Approved by Prasanna R", ts: now - 14 * 24 * H, kind: "ok" }] }),
    req({ type: "leave", leaveType: "casual", from: D.add(today, -24), to: D.add(today, -24), dayType: "full", reason: "Family function", status: "approved", created: now - 30 * 24 * H, activity: [{ text: "Request raised by you", ts: now - 30 * 24 * H, kind: "on" }, { text: "Approved by Prasanna R", ts: now - 29 * 24 * H, kind: "ok" }] }),
    req({ type: "regularize", from: D.add(today, -9), to: D.add(today, -9), inTime: "09:00", outTime: "18:00", reason: "Biometric did not work", status: "approved", created: now - 8 * 24 * H, activity: [{ text: "Request raised by you", ts: now - 8 * 24 * H, kind: "on" }, { text: "Approved by Prasanna R", ts: now - 7 * 24 * H, kind: "ok" }] }),
  ];

  const notifs = [
    { id: uid(), kind: "task", who: "as", html: "<b>Anushka Sharma</b> invited you to the task <b>Design – Projects My tasks</b>.", ts: now - 2 * 60e3, read: false, actionable: true },
    { id: uid(), kind: "mention", who: "al", html: "<b>Alex</b> mentioned you in <b>“Sprint Planning – Week 4”</b>", quote: "They need your input – take a look.", ts: now - 2 * H, read: false },
    { id: uid(), kind: "comment", who: "pb", html: "<b>Pam Beesly</b> added a comment on <b>Maverick Billing Plan</b>.", quote: "Looks perfect, send it for technical review tomorrow!", ts: now - 2 * H - 9e5, read: true },
    { id: uid(), kind: "mention", who: "sl", html: "<b>Sarah</b> mentioned you in a comment on <b>“Design Review”</b>", quote: "Can you share the latest flows here?", ts: now - 5 * H, read: true },
    { id: uid(), kind: "assign", html: "New task assigned: <b>‘Design UX for client onboarding’</b> – due by Friday. Let’s do this!", ts: now - 8 * H, read: true, go: "#/ts" },
    { id: uid(), kind: "reject", html: "Oops! Your timesheet for <b>week of " + D.short(D.add(mon, -21)) + "</b> was <b>rejected</b> by Prasanna.", ts: now - 9 * H, read: false, go: "#/ts/history" },
  ];

  const inbox = [
    { kind: "expense", who: "dr", amount: 20000, cat: "Food & Beverages", icon: "utensils", flag: "Doesn’t match policy standards" },
    { kind: "expense", who: "ww", amount: 20000, cat: "Travel", icon: "plane", flag: "Doesn’t match travel policy regulation" },
    { kind: "expense", who: "dr", amount: 235000, cat: "Zifo · Milestone", icon: "milestone", flag: "Doesn’t match policy standards" },
    { kind: "expense", who: "pb", amount: 1250, cat: "Local conveyance", icon: "wallet", routine: true },
    { kind: "expense", who: "al", amount: 3400, cat: "Internet reimbursement", icon: "globe", routine: true },
    { kind: "timesheet", who: "dr", hours: 56, week: -1, proj: "CKTKEBS", flag: "Doesn’t match policy standards" },
    { kind: "timesheet", who: "ww", hours: 56, week: -1, proj: "CKTKEBS", flag: "Exceeds weekly hour cap" },
    { kind: "timesheet", who: "vi", hours: 40, week: -1, proj: "KEBS Lite", routine: true },
    { kind: "timesheet", who: "rb", hours: 40, week: -1, proj: "Android", routine: true },
    { kind: "timesheet", who: "jh", hours: 42, week: -1, proj: "Mobile iOS" },
    { kind: "timesheet", who: "sl", hours: 38, week: -2, proj: "Research", flag: "Below expected hours" },
    { kind: "timesheet", who: "jre", hours: 44, week: -1, proj: "CS Ops" },
    { kind: "timesheet", who: "jr", hours: 40, week: -1, proj: "CS Ops" },
    { kind: "leave", who: "dr", days: 1, ltype: "Flexi Holiday", off: 14, flag: "Overlaps with team release" },
    { kind: "leave", who: "ww", days: 1, ltype: "Flexi Holiday", off: 15 },
  ].map((x, i) => ({ id: uid(), date: D.add(today, -(i % 4) - 1), ...x }));

  const posts = [
    { id: "p1", by: "sj", title: "Diwali Celebrations at HO", body: "Hello folks! We’re going to conduct a special event ahead of Diwali. There are dance competitions, ramp walks and much more. Please ensure your presence for the much anticipated event. Register yourself by EoD.\n\nAll the best 😊", ts: now - 30 * H, reactions: 48, reacted: false, ack: null,
      comments: [{ who: "vi", text: "I’m excited to meet everyone. Kudos to the HR team for making these happen @SuryaJayaraman", ts: now - 20 * H }] },
    { id: "p2", by: "vj", title: "Open enrolment for health cover top-ups", body: "Our annual health insurance top-up window is open until the end of this month. Add parents or increase your sum insured from the Benefits portal.", ts: now - 4 * 24 * H, reactions: 21, reacted: false, ack: null, comments: [] },
    { id: "p3", by: "vj", title: "New hybrid-work guidelines", body: "From next month, teams can choose two anchor days per week in office. Please align with your manager and update your WFH requests accordingly.", ts: now - 9 * 24 * H, reactions: 63, reacted: true, ack: now - 8 * 24 * H, comments: [] },
  ];

  const expenses = [
    { id: uid(), title: "Client lunch – Zifo", cat: "Food & Beverages", amount: 2450, date: D.add(today, -3), status: "pending", bill: "receipt_0423.jpg" },
    { id: uid(), title: "Cab to airport", cat: "Travel", amount: 860, date: D.add(today, -8), status: "approved", bill: "uber_trip.pdf" },
    { id: uid(), title: "Figma seat (monthly)", cat: "Software", amount: 1260, date: D.add(today, -12), status: "approved", bill: "invoice_fig.pdf" },
    { id: uid(), title: "Team offsite snacks", cat: "Food & Beverages", amount: 1780, date: D.add(today, -20), status: "rejected", bill: "bill_7782.jpg", note: "Missing GST number" },
    { id: uid(), title: "Broadband – Oct", cat: "Internet", amount: 999, date: D.add(today, -27), status: "approved", bill: "act_oct.pdf" },
  ];
  const bills = [{ id: uid(), name: "Hotel_Grand_Chennai.pdf", amount: 6400, date: D.add(today, -2) }, { id: uid(), name: "Parking_receipt.jpg", amount: 120, date: D.add(today, -6) }];

  return {
    v: 1, authed: false, email: "",
    settings: { theme: "dark", lang: "en", secure: false },
    me: { id: "me", first: "Lena", middle: "Aravind", last: "S", display: "Aravind", role: "Product Designer", dept: "Design", loc: "Chennai", company: "Prima Technologies Pvt Ltd", domain: "csdemo.prima.com",
      empId: "KB-2041", manager: "pr", joined: D.add(today, -880), dob: "2002-02-19", marital: "Single", gender: "Male", phone: "+91 98400 12345", tint: "t-blue", intro: "" },
    quick: [...QUICK_SUGGESTED],
    people, offThisWeek: { week: mon, list: offThisWeek },
    att: { logs, today: { date: today, inTs: null, outTs: null } },
    requests, leaveUsed: { casual: 2, sick: 1, earned: 3, floater: 0 },
    ts: { entries, weeks, running: null },
    notifs, inbox, posts, expenses, bills,
    praises: { me: [{ from: "jre", badge: "Being Consistent", text: "Understanding clients’ perspective and delivering the best service possible to them. Keep going!", date: D.add(today, -12) }], others: {} },
    goals: [{ id: uid(), title: "Ship KEBS design system v2", p: 70 }, { id: uid(), title: "Complete accessibility audit", p: 40 }, { id: uid(), title: "Mentor two junior designers", p: 50 }],
    tickets: [{ id: "HD-1042", cat: "IT Support", subject: "VPN access for new laptop", body: "", status: "open", ts: now - 2 * 24 * H }],
    feedback: [],
  };
}

let S;
try { S = JSON.parse(localStorage.getItem(STORE_KEY)); } catch { S = null; }
if (!S || S.v !== 1) S = seed();
// dark is the default look: move anyone still on the old automatic default (who never picked a theme) to dark, once
if (!S.settings.darkDefault) { if (S.settings.theme === "auto" && !S.settings.themeSet) S.settings.theme = "dark"; S.settings.darkDefault = true; }
if (!S.mig1) { // older saves: sample timesheet entries had no comments, which blocked weekly submit
  Object.values(S.ts.entries).flat().forEach((e) => { if (e.mins && !e.comment) e.comment = "Progress update"; });
  S.mig1 = true;
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch {} }
function resetDemo() { try { localStorage.removeItem(STORE_KEY); } catch {} S = seed(); }

// ── derived data ──
const person = (id) => (id === "me" ? { ...S.me, name: fullName() } : S.people.find((p) => p.id === id)) || { id, name: "Unknown", tint: "t-slate" };
const fullName = () => [S.me.first, S.me.middle].filter(Boolean).join(" ");
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
// photo avatars (assets/avatars/<id>.jpg); anyone without one falls back to coloured initials
const AV_PHOTOS = new Set(["me", "jr", "jre", "sj", "vi", "vj", "pr", "ww", "jh", "as", "al", "pb", "sl", "dr", "rb"]);
const avatar = (id, cls = "") => { const p = person(id); return AV_PHOTOS.has(id)
  ? `<span class="av photo ${cls}" style="--av:url(assets/avatars/${id}.jpg?v=3)" title="${esc(p.name)}" role="img" aria-label="${esc(p.name)}"></span>`
  : `<span class="av ${cls} tint-dot ${p.tint || "t-blue"}" style="background:var(--t)" title="${esc(p.name)}">${esc(initials(p.name))}</span>`; };

function ensureToday() {
  const t = S.att.today, today = D.today();
  if (t.date !== today) {
    if (t.inTs) S.att.logs[t.date] = { in: hhmm(t.inTs), out: t.outTs ? hhmm(t.outTs) : null, wfh: false };
    S.att.today = { date: today, inTs: null, outTs: null };
    save();
  }
}
const hhmm = (ts) => { const d = new Date(ts); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const clockedIn = () => !!S.att.today.inTs && !S.att.today.outTs;
const workedSec = () => { const t = S.att.today; if (!t.inTs) return 0; return Math.floor(((t.outTs || Date.now()) - t.inTs) / 1000); };

function reqDays(r) { return r.dayType === "half" ? 0.5 : D.workdays(r.from, r.to) || 1; }
function leaveBalances() {
  const accrued = S.requests.filter((r) => r.type === "compoff" && r.status === "approved").reduce((a, r) => a + D.days(r.from, r.to), 0);
  return LEAVE_TYPES.map((t) => {
    const taken = S.requests.filter((r) => r.type === "leave" && r.leaveType === t.id && (r.status === "approved" || r.status === "pending")).reduce((a, r) => a + reqDays(r), 0);
    const total = t.id === "compoff" ? accrued : t.total;
    const used = (t.id === "compoff" ? 0 : S.leaveUsed[t.id] || 0) + taken;
    return { ...t, total, used, available: Math.max(0, total - used) };
  });
}
const pendingRequests = () => S.requests.filter((r) => r.status === "pending");
const unreadCount = () => S.notifs.filter((n) => !n.read).length;
const holidays = () => holidaysFor(new Date().getFullYear());
const nextHoliday = () => holidays().find((h) => h.date >= D.today());
