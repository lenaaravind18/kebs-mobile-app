// Projects · project detail (overview, tasks, team) · My tasks · task detail (status, log time, comments)
// Data: S.pj = { [pid]: project }. Projects that exist in PROJECTS (the timesheet list) keep task positions in
// sync with PROJECTS[pid].tasks via task.ti, so "Log time" writes a real timesheet entry.

const TK_STATUS = { todo: ["To do", "t-slate"], doing: ["In progress", "t-blue"], review: ["In review", "t-violet"], done: ["Done", "t-green"] };
const TK_PRI = { high: ["High", "var(--danger)"], med: ["Medium", "#f5a524"], low: ["Low", "var(--ok)"] };
const PJ_STATUS = { active: "Active", hold: "On hold", done: "Completed" };

function seedProjects() {
  const t = D.today(), add = (n) => D.add(t, n);
  const T = (title, o = {}) => ({ id: uid(), title, assignee: "me", status: "todo", priority: "med", due: add(5), est: 4, desc: "", comments: [], created: Date.now() - 6 * 864e5, ...o });
  const P = {
    p1: { id: "p1", code: "PRJ-1042", client: "Zifo Technologies", status: "active", tint: "t-blue", start: add(-62), end: add(45), budget: 600, base: 312 * 60, manager: "jh", team: ["me", "jh", "rb", "al", "pb"],
      desc: "Native-feel iOS app for Zifo’s field teams: attendance, approvals and offline sync.",
      milestones: [{ name: "Design sign-off", date: add(-40), done: true }, { name: "Beta to Zifo pilot", date: add(-3), done: false }, { name: "App Store release", date: add(45), done: false }],
      tasks: [T("Home screen API integration", { ti: 0, assignee: "al", status: "doing", due: add(2), est: 16, priority: "high" }), T("Design user accessibility testing", { ti: 1, status: "doing", due: add(-1), priority: "high", est: 10, desc: "Run VoiceOver and Dynamic Type checks on the five core screens and log issues in Jira." }),
        T("Push notification setup", { ti: 2, assignee: "pb", due: add(6), est: 8 }), T("Release build QA", { ti: 3, assignee: "jh", due: add(30), est: 24, priority: "low" }), T("App Store screenshots", { assignee: "me", due: add(9), est: 6, priority: "low", desc: "6.7\" and 5.5\" sets in light and dark mode." })] },
    p2: { id: "p2", code: "PRJ-1051", client: "KEBS (internal)", status: "active", tint: "t-violet", start: add(-90), end: add(21), budget: 320, base: 180 * 60, manager: "me", team: ["me", "sl", "vi", "as"],
      desc: "KEBS Lite 2.0 design system: tokens, components and documentation for web and mobile.",
      milestones: [{ name: "Tokens v2", date: add(-30), done: true }, { name: "Component audit", date: add(4), done: false }, { name: "Docs site launch", date: add(21), done: false }],
      tasks: [T("Design system development", { ti: 0, status: "doing", due: add(0), est: 40, priority: "high" }), T("Scrum sheet update – Components", { ti: 1, due: add(1), est: 2 }), T("Scrum sheet update – Colors", { ti: 2, status: "done", due: add(-4), est: 2 }),
        T("Icon library audit", { ti: 3, assignee: "sl", status: "review", due: add(3), est: 12 }), T("Dark-mode contrast review", { due: add(12), est: 6, priority: "med" })] },
    p3: { id: "p3", code: "PRJ-0998", client: "Prima Technologies", status: "active", tint: "t-green", start: add(-120), end: add(10), budget: 500, base: 509 * 60, manager: "rb", team: ["rb", "me", "dr", "ww"],
      desc: "Android companion app for Prima’s sales team. Final stabilisation sprint before handover.",
      milestones: [{ name: "Feature complete", date: add(-14), done: true }, { name: "Handover", date: add(10), done: false }],
      tasks: [T("My team – android development", { ti: 0, assignee: "dr", status: "doing", due: add(4), est: 30 }), T("Code refactoring – Android & iOS", { ti: 1, status: "review", due: add(2), est: 12 }), T("Task_2124 – MobMod", { ti: 2, due: add(-3), priority: "high", est: 5, desc: "Crash on login for Android 9 devices — reproduce and patch." })] },
    p4: { id: "p4", code: "PRJ-1060", client: "KEBS (internal)", status: "hold", tint: "t-amber", start: add(-20), end: add(60), budget: 240, base: 38 * 60, manager: "jh", team: ["jh", "me", "vj"],
      desc: "Receipt OCR and expense flows for KEBS. Paused until the finance API is ready.",
      milestones: [{ name: "OCR spike", date: add(-8), done: true }, { name: "Finance API ready", date: add(14), done: false }],
      tasks: [T("Design user accessibility testing", { ti: 0, due: add(20), est: 8 }), T("Receipt OCR flows", { ti: 1, status: "doing", due: add(25), est: 16 })] },
    p5: { id: "p5", code: "INT-001", client: "KEBS (internal)", status: "active", tint: "t-slate", start: add(-300), end: null, budget: 0, base: 64 * 60, manager: "sj", team: ["me", "sj", "vj", "pr"], internal: true,
      desc: "Non-billable internal time: meetings, learning and team activities.", milestones: [],
      tasks: [T("Team meeting", { ti: 0, due: add(1), est: 1, priority: "low" }), T("Learning & development", { ti: 1, due: add(14), est: 8, priority: "low" })] },
    p6: { id: "p6", code: "PRJ-0911", client: "NextGen Corp", status: "done", tint: "t-pink", start: add(-200), end: add(-30), budget: 280, base: 266 * 60, manager: "vj", team: ["vj", "me", "sl"],
      desc: "Marketing website revamp for NextGen Corp — shipped and handed over.",
      milestones: [{ name: "Design", date: add(-150), done: true }, { name: "Launch", date: add(-30), done: true }],
      tasks: [T("Landing page redesign", { status: "done", due: add(-60), est: 20 }), T("CMS handover", { status: "done", due: add(-32), est: 6 })] },
  };
  return P;
}
if (!S.pj) { S.pj = seedProjects(); save(); }
// keep the timesheet's task list in step with project tasks (added tasks get a timesheet slot)
(function syncPJ() {
  Object.values(S.pj).forEach((p) => {
    const tp = PROJECTS.find((x) => x.id === p.id); if (!tp) return;
    p.tasks.forEach((t) => { if (t.ti == null) return; tp.tasks[t.ti] = t.title; });
  });
})();
{ const base = resetDemo; resetDemo = function () { base(); S.pj = seedProjects(); save(); }; }

const pjOf = (id) => S.pj[id];
const pjList = () => Object.values(S.pj);
const tkOf = (p, tid) => p?.tasks.find((t) => t.id === tid);
const inTimesheet = (p) => PROJECTS.some((x) => x.id === p.id);
function tkMins(p, t) {
  if (t.ti == null) return 0;
  return Object.values(S.ts.entries).flat().filter((e) => e.pid === p.id && e.ti === t.ti).reduce((a, e) => a + (e.mins || 0), 0);
}
const pjMins = (p) => p.base + p.tasks.reduce((a, t) => a + tkMins(p, t), 0);
const pjDone = (p) => p.tasks.filter((t) => t.status === "done").length;
const pjProg = (p) => (p.status === "done" ? 1 : p.tasks.length ? pjDone(p) / p.tasks.length : 0);
const myTasks = () => pjList().flatMap((p) => p.tasks.filter((t) => t.assignee === "me").map((t) => ({ p, t })));
const myOpen = (p) => p.tasks.filter((t) => t.assignee === "me" && t.status !== "done").length;
function dueInfo(d, done) {
  if (!d) return { txt: "No due date", tone: "" };
  const n = D.diff(D.today(), d);
  if (done) return { txt: `Due ${D.short(d)}`, tone: "" };
  if (n < 0) return { txt: `Overdue by ${plural(-n, "day")}`, tone: "bad" };
  if (n === 0) return { txt: "Due today", tone: "warn" };
  if (n === 1) return { txt: "Due tomorrow", tone: "warn" };
  return { txt: n <= 6 ? `Due ${D.f(d, { weekday: "short" })}` : `Due ${D.short(d)}`, tone: "" };
}
const daysLeft = (p) => (p.end ? D.diff(D.today(), p.end) : null);
const pjBadge = (p) => `<span class="pj-badge s-${p.status}">${PJ_STATUS[p.status]}</span>`;
const prDot = (pr) => `<i class="pr-dot" style="background:${TK_PRI[pr][1]}" title="${TK_PRI[pr][0]} priority"></i>`;
const pjLocked = (p) => p.status !== "active";
const pjIcon = (p) => p.icon || { p1: "phone", p2: "palette", p3: "phone", p4: "wallet", p5: "users", p6: "globe" }[p.id] || "folder";

// ── shared bits ──
function undoToast(msg, undo) {
  const t = document.createElement("div");
  t.className = "toast ok"; t.innerHTML = `${I("checkCircle")}<span>${esc(msg)}</span><button type="button" class="tk-undo">Undo</button>`;
  t.querySelector("button").onclick = () => { undo(); t.remove(); };
  $("#toasts").append(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 260); }, 4200);
}
function tkRow(p, t, showProject = true) {
  const done = t.status === "done", due = dueInfo(t.due, done);
  return `<div class="tk-row ${done ? "done" : ""}">
    <button class="tk-check" data-act="tkToggle" data-p="${p.id}" data-t="${t.id}" aria-label="${done ? "Mark as not done" : "Mark as done"}" aria-pressed="${done}">${I("check")}</button>
    <button class="tk-body" data-go="#/projects/${p.id}/task/${t.id}">
      <b class="ell">${esc(t.title)}</b>
      <span class="tk-meta">${prDot(t.priority)}${showProject ? `<span class="ell">${esc(PROJECTS.find((x) => x.id === p.id)?.name || p.code)}</span><span class="dotsep"></span>` : ""}<span class="${due.tone}">${due.txt}</span>${t.assignee !== "me" ? `<span class="dotsep"></span>${avatar(t.assignee, "xs")}` : ""}</span>
    </button>
  </div>`;
}
const pjName = (p) => PROJECTS.find((x) => x.id === p.id)?.name || p.name || { p6: "NextGen website revamp" }[p.id] || p.code;

// ── Projects (list) and My tasks ──
route("projects", (_, q) => {
  const tab = q.tab === "tasks" ? "tasks" : "projects", qq = (q.q || "").toLowerCase();
  const mine = myTasks(), open = mine.filter((x) => x.t.status !== "done");
  const overdue = open.filter((x) => x.t.due && x.t.due < D.today()).length, today = open.filter((x) => x.t.due === D.today()).length;
  let body = "";
  if (tab === "projects") {
    const st = q.st || "active";
    let list = pjList().filter((p) => p.team.includes("me"));
    if (st !== "all") list = list.filter((p) => p.status === st);
    if (qq) list = list.filter((p) => [pjName(p), p.client, p.code].join(" ").toLowerCase().includes(qq));
    body = `<div class="pj-sum">
        <div><i class="pj-sum-ic tint t-blue">${I("briefcase")}</i><b class="num">${pjList().filter((p) => p.status === "active" && p.team.includes("me")).length}</b><small>Active</small></div>
        <div><i class="pj-sum-ic tint t-violet">${I("checkCircle")}</i><b class="num">${open.length}</b><small>Open tasks</small></div>
        <div class="${overdue ? "bad" : ""}"><i class="pj-sum-ic tint ${overdue ? "t-red" : "t-green"}">${I(overdue ? "alert" : "check")}</i><b class="num">${overdue}</b><small>Overdue</small></div>
      </div>
      <label class="searchbox" style="margin-top:12px">${I("search")}<input data-pq placeholder="Search projects" value="${esc(q.q || "")}" enterkeyhint="search"></label>
      ${filterHead(`${list.length} ${st === "all" ? "" : PJ_ST_LABEL[st].toLowerCase() + " "}${list.length === 1 ? "project" : "projects"}`, "pjSt", st, ["active", "hold", "done", "all"].map((v) => { const n = pjList().filter((p) => p.team.includes("me") && (v === "all" || p.status === v)).length; return [v, PJ_ST_LABEL[v], { active: "briefcase", hold: "pause", done: "checkCircle", all: "list" }[v], `${n} ${n === 1 ? "project" : "projects"}`]; }), "Show projects")}
      ${list.length ? `<div class="stack" data-lazy="6" style="margin-top:10px">${list.map(pjCard).join("")}</div>`
        : emptyState(qq ? ["search", "briefcase"] : ["briefcase", "clipboard"], qq ? "No projects match" : `No ${st === "all" ? "" : PJ_STATUS[st].toLowerCase() + " "}projects`, qq ? "Try a different name, client or code." : "Projects you’re added to show up here.")}`;
  } else {
    const f = q.f || "open";
    let rows = mine;
    if (f === "open") rows = rows.filter((x) => x.t.status !== "done");
    if (f === "done") rows = rows.filter((x) => x.t.status === "done");
    if (qq) rows = rows.filter((x) => [x.t.title, pjName(x.p)].join(" ").toLowerCase().includes(qq));
    const td = D.today(), wk = D.add(td, 6);
    const groups = f === "done" ? [["Done", rows]] : [
      ["Overdue", rows.filter((x) => x.t.status !== "done" && x.t.due && x.t.due < td)],
      ["Today", rows.filter((x) => x.t.status !== "done" && x.t.due === td)],
      ["This week", rows.filter((x) => x.t.status !== "done" && x.t.due > td && x.t.due <= wk)],
      ["Later", rows.filter((x) => x.t.status !== "done" && (!x.t.due || x.t.due > wk))],
      ...(f === "all" ? [["Done", rows.filter((x) => x.t.status === "done")]] : []),
    ];
    body = `${overdue ? `<div class="banner bad" style="margin-top:4px">${I("alert")}${plural(overdue, "task")} overdue${today ? ` · ${today} due today` : ""}</div>` : today ? `<div class="banner warn" style="margin-top:4px">${I("clock")}${plural(today, "task")} due today</div>` : ""}
      <label class="searchbox" style="margin-top:12px">${I("search")}<input data-pq placeholder="Search my tasks" value="${esc(q.q || "")}" enterkeyhint="search"></label>
      ${filterHead(`${rows.length} ${f === "all" ? "" : f + " "}${rows.length === 1 ? "task" : "tasks"}`, "tkF", f, [["open", "Open", "clock", mine.filter((x) => x.t.status !== "done").length], ["done", "Done", "checkCircle", mine.filter((x) => x.t.status === "done").length], ["all", "All", "list", mine.length]].map(([v, l, ic, n]) => [v, l, ic, `${n} ${n === 1 ? "task" : "tasks"}`]), "Show tasks")}
      ${rows.length ? groups.filter(([, g]) => g.length).map(([h, g]) => `<div class="sec"><h2 class="sec-ic tk-grp ${h === "Overdue" ? "tk-h-bad" : ""}" data-g="${h}">${I({ Overdue: "alert", Today: "sun", "This week": "calendar", Later: "clock", Done: "checkCircle" }[h] || "list")}${h} <span class="muted" style="font-weight:600">(${g.length})</span></h2></div><div class="tk-list" data-lazy="8">${g.sort((a, b) => (a.t.due || "9") < (b.t.due || "9") ? -1 : 1).map((x) => tkRow(x.p, x.t)).join("")}</div>`).join("")
        : emptyState(qq ? ["search"] : ["checkCircle", "clipboard"], qq ? "No tasks match" : f === "done" ? "Nothing done yet" : "You’re all caught up", qq ? "Try a different word." : f === "done" ? "Tasks you finish show up here." : "No open tasks assigned to you.")}`;
  }
  return `<div class="screen">${topbar("Projects")}${seg([["projects", "Projects"], ["tasks", `My tasks${open.length ? ` (${open.length})` : ""}`]], tab, "pjTab")}<div class="scroll">${body}</div></div>`;
}, {
  mount(_, q) {
    const inp = $("[data-pq]"); let tm;
    inp?.addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(() => swap(`#/projects?tab=${q.tab || "projects"}${q.st ? `&st=${q.st}` : ""}${q.f ? `&f=${q.f}` : ""}${inp.value ? `&q=${encodeURIComponent(inp.value)}` : ""}`), 300); });
    if (q.q && inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  },
});
function pjCard(p) {
  const prog = pjProg(p), dl = daysLeft(p), hrs = Math.round(pjMins(p) / 60), over = p.budget && hrs > p.budget, mo = myOpen(p);
  return `<button class="card pj-card" data-go="#/projects/${p.id}">
    <span class="hrow"><span class="pj-ic tint ${p.tint}">${I(pjIcon(p))}</span><span class="grow" style="min-width:0"><b class="ell" style="display:block">${esc(pjName(p))}</b><span class="tiny muted ell" style="display:block">${esc(p.client)} · ${esc(p.code)}</span></span>${pjBadge(p)}</span>
    <span class="pj-prog"><i style="width:${Math.round(prog * 100)}%;background:${p.status === "done" ? "var(--ok)" : rangeColor(prog)}"></i></span>
    <span class="pj-foot"><span>${Math.round(prog * 100)}% · ${pjDone(p)}/${p.tasks.length} tasks</span>
      <span class="${over ? "bad" : ""}">${p.budget ? `${hrs}/${p.budget}h` : `${hrs}h logged`}</span>
      <span class="${dl != null && dl < 0 && p.status !== "done" ? "bad" : dl != null && dl <= 7 && p.status === "active" ? "warn" : ""}">${p.status === "done" ? `Closed ${D.short(p.end)}` : dl == null ? "Ongoing" : dl < 0 ? `${-dl}d late` : `${dl}d left`}</span></span>
    <span class="hrow" style="margin-top:2px"><span class="av-stack">${p.team.slice(0, 4).map((id) => avatar(id, "sm")).join("")}${p.team.length > 4 ? `<span class="av sm more">+${p.team.length - 4}</span>` : ""}</span><span class="grow"></span>${mo ? `<span class="small" style="color:var(--accent);font-weight:600">${plural(mo, "task")} for you</span>` : ""}</span>
  </button>`;
}
act("pjTab", (b) => swap(`#/projects?tab=${b.dataset.v}`));
act("pjSt", (b) => { const q = parseHash().q; swap(`#/projects?tab=projects&st=${b.dataset.v}${q.q ? `&q=${encodeURIComponent(q.q)}` : ""}`); });
const PJ_ST_LABEL = { active: "Active", hold: "On hold", done: "Completed", all: "All" };
act("tkF", (b) => { const q = parseHash().q; swap(`#/projects?tab=tasks&f=${b.dataset.v}${q.q ? `&q=${encodeURIComponent(q.q)}` : ""}`); });
act("tkToggle", (b) => {
  const p = pjOf(b.dataset.p), t = tkOf(p, b.dataset.t); if (!t) return;
  if (pjLocked(p)) return toast(p.status === "hold" ? "This project is on hold — tasks can’t be changed" : "This project is completed — tasks are read-only", "bad");
  if (t.assignee !== "me" && p.manager !== "me") return toast(`Only ${person(t.assignee).name.split(" ")[0]} or the project manager can change this task`, "bad");
  const prev = t.status; t.status = prev === "done" ? "todo" : "done"; save();
  b.closest(".tk-row")?.classList.add(t.status === "done" ? "just-done" : "just-open");
  setTimeout(rerender, t.status === "done" ? 380 : 0);
  if (t.status === "done") { try { navigator.vibrate?.(12); } catch {} undoToast(`“${t.title}” done`, () => { t.status = prev; save(); rerender(); }); }
});

// ── Project detail ──
route("projects/:id", ({ id }, q) => {
  const p = pjOf(id);
  if (!p) return `<div class="screen">${topbar("Project")}${emptyState(["briefcase"], "Project not found", "It may have been removed or you’re no longer on the team.", `<button class="btn primary" data-go="#/projects">All projects</button>`)}</div>`;
  const tab = q.tab || "overview", prog = pjProg(p), mins = pjMins(p), hrs = Math.round(mins / 60), dl = daysLeft(p);
  const usage = p.budget ? hrs / p.budget : 0;
  const hero = `<div class="pj-hero">
    <div class="hrow" style="align-items:flex-start"><span class="grow" style="min-width:0"><span class="tiny muted">${esc(p.client)} · ${esc(p.code)}</span><h1>${esc(pjName(p))}</h1></span>${pjBadge(p)}</div>
    <button class="pj-team" data-act="pjTabD" data-v="team" aria-label="See the team"><span class="av-stack">${p.team.slice(0, 5).map((id) => avatar(id, "sm")).join("")}</span><span class="small muted">${esc(person(p.manager).name.split(" ")[0])} + ${plural(p.team.length - 1, "teammate")}</span>${I("chevR")}</button>
    <div class="pj-hero-row"><span class="ring" style="--p:${Math.round(prog * 100)};--t:${p.status === "done" ? "var(--ok)" : rangeColor(prog)}"><b>${Math.round(prog * 100)}%</b></span>
      <div class="pj-stats">
        <span class="pj-st"><i class="pj-st-ic tint t-green">${I("checkCircle")}</i><span><small>Tasks</small><b>${pjDone(p)}/${p.tasks.length}</b></span></span>
        <span class="pj-st"><i class="pj-st-ic tint ${usage > 1 ? "t-red" : "t-amber"}">${I("clock")}</i><span><small>${p.budget ? "Budget used" : "Hours"}</small><b class="${usage > 1 ? "bad" : usage > 0.9 ? "warn" : ""}">${p.budget ? `${hrs}/${p.budget}h` : `${hrs}h`}</b></span></span>
        <span class="pj-st"><i class="pj-st-ic tint t-blue">${I("calendar")}</i><span><small>${p.status === "done" ? "Closed" : "Due"}</small><b class="${dl != null && dl < 0 && p.status !== "done" ? "bad" : ""}">${p.end ? D.short(p.end) : "Ongoing"}</b></span></span>
        <span class="pj-st"><i class="pj-st-ic tint t-slate">${I("user")}</i><span><small>Manager</small><b class="pj-mgr">${avatar(p.manager, "sm")}<span class="ell">${esc(person(p.manager).name.split(" ")[0])}</span></b></span></span>
      </div></div>
  </div>`;
  const alerts = [
    p.status === "hold" && `<div class="banner warn">${I("pause")}On hold — tasks are frozen until the project resumes.</div>`,
    p.status === "done" && `<div class="banner ok">${I("checkCircle")}Completed ${D.short(p.end)} — this project is read-only.</div>`,
    p.status === "active" && usage > 1 && `<div class="banner bad">${I("alert")}Over budget by ${hrs - p.budget}h — talk to ${esc(person(p.manager).name.split(" ")[0])} before logging more.</div>`,
    p.status === "active" && usage > 0.9 && usage <= 1 && `<div class="banner warn">${I("alert")}${Math.round(usage * 100)}% of the budget used — ${p.budget - hrs}h left.</div>`,
    p.status === "active" && dl != null && dl < 0 && `<div class="banner bad">${I("clock")}Past the end date by ${plural(-dl, "day")}.</div>`,
  ].filter(Boolean).join("");
  let body = "";
  if (tab === "overview") {
    const mine = p.tasks.filter((t) => t.assignee === "me" && t.status !== "done").slice(0, 3);
    body = `${p.desc ? `<div class="sec" style="margin-top:14px"><h2 class="sec-ic">${I("info")}About</h2></div><p class="pj-desc" style="margin-top:0">${esc(p.desc)}</p>` : ""}
      ${pjDetailsCard(p)}
      <div class="sec"><h2 class="sec-ic">${I("checkCircle")}Your open tasks</h2>${myOpen(p) > 3 ? `<button class="link" data-act="pjTabD" data-v="tasks">See all</button>` : ""}</div>
      ${mine.length ? `<div class="tk-list">${mine.map((t) => tkRow(p, t, false)).join("")}</div>` : emptyMini("checkCircle", "Nothing open for you here.")}
      ${typeof pcCard === "function" ? pcCard(p) : ""}
      ${pjWeekChart(p)}
      ${p.budget ? `<div class="sec"><h2 class="sec-ic">${I("wallet")}Budget</h2><span class="tiny muted">${hrs}h of ${p.budget}h</span></div>
        <div class="card pj-budget"><span class="pj-prog lg"><i style="width:${Math.min(100, usage * 100)}%;background:${rangeColor(usage, "low")}"></i></span>
          <div class="pj-foot"><span>${Math.round(usage * 100)}% used</span><span class="${usage > 1 ? "bad" : ""}">${usage > 1 ? `${hrs - p.budget}h over` : `${p.budget - hrs}h left`}</span><span>${Math.round(mins / 60 / Math.max(1, D.diff(p.start, D.today())) * 7)}h / week</span></div></div>` : ""}
      ${p.milestones.length ? `<div class="sec"><h2 class="sec-ic">${I("milestone")}Milestones</h2></div><div class="card"><div class="pjm-tl">${p.milestones.map((m) => { const late = !m.done && m.date < D.today(); return `<div class="pjm ${m.done ? "done" : late ? "late" : ""}"><i>${m.done ? I("check") : ""}</i><span class="grow"><b>${esc(m.name)}</b><small>${m.done ? "Done · " : late ? "Late · " : ""}${D.long(m.date)}</small></span></div>`; }).join("")}</div></div>` : ""}`;
  } else if (tab === "tasks") {
    const f = q.f || "mine";
    let list = p.tasks;
    if (f === "mine") list = list.filter((t) => t.assignee === "me");
    if (f === "open") list = list.filter((t) => t.status !== "done");
    const order = ["doing", "review", "todo", "done"];
    body = `${filterHead(`${list.length} ${{ mine: "of your ", open: "open ", all: "" }[f]}${list.length === 1 ? "task" : "tasks"}`, "pjTF", f, [["mine", "Assigned to me", "user", p.tasks.filter((t) => t.assignee === "me").length], ["open", "Open", "clock", p.tasks.filter((t) => t.status !== "done").length], ["all", "All tasks", "list", p.tasks.length]].map(([v, l, ic, n]) => [v, l, ic, `${n} ${n === 1 ? "task" : "tasks"}`]), "Show tasks")}
      ${list.length ? order.map((s) => { const g = list.filter((t) => t.status === s); return g.length ? `<div class="sec"><h2>${TK_STATUS[s][0]} <span class="muted" style="font-weight:600">(${g.length})</span></h2></div><div class="tk-list" data-lazy="8">${g.map((t) => tkRow(p, t, false)).join("")}</div>` : ""; }).join("")
        : emptyState(["clipboard", "checkCircle"], f === "mine" ? "Nothing assigned to you" : "No tasks yet", f === "mine" ? "Tasks assigned to you on this project show up here." : "Add the first task to get started.")}`;
  } else {
    body = `<div class="list card" style="padding-top:4px;padding-bottom:4px">${p.team.map((id) => { const pp = person(id), open = p.tasks.filter((t) => t.assignee === id && t.status !== "done").length, h = Math.round((p.base / 60) * ((id.charCodeAt(0) % 5) + 2) / 14) + Math.round(p.tasks.filter((t) => t.assignee === id).reduce((a, t) => a + tkMins(p, t), 0) / 60);
      return `<button class="li" data-go="#/people/${id === "me" ? "me" : id}">${avatar(id)}<span class="grow" style="min-width:0"><span class="t ell" style="display:block">${esc(id === "me" ? `${pp.name} (you)` : pp.name)}</span><span class="s">${id === p.manager ? "Project manager" : esc(pp.role || "Team member")}</span></span><span class="pj-team-n"><b>${h}h</b><small>${open ? `${open} open` : "—"}</small></span></button>`; }).join("")}</div>`;
  }
  const canAdd = p.status === "active" && inTimesheet(p);
  const nChat = typeof pcUnread === "function" ? pcUnread(p.id) : 0;
  return `<div class="screen ${tab === "tasks" && canAdd ? "has-foot" : ""}">${topbar("Project", { sub: p.code, right: `<button class="ib pc-hbtn" data-go="#/projects/${p.id}/chat" aria-label="Team chat${nChat ? ` · ${nChat} unread` : ""}">${I("msg")}${nChat ? `<span class="pc-dot"></span>` : ""}</button>` })}
    <div class="scroll"><div class="stack">${hero}${alerts}</div>
    ${seg([["overview", "Overview"], ["tasks", `Tasks (${p.tasks.length})`], ["team", `Team (${p.team.length})`]], tab, "pjTabD")}
    <div class="stack">${body}</div></div>
    ${tab === "tasks" && canAdd ? `<div class="foot"><button class="btn primary block" data-act="tkAdd" data-p="${p.id}">${I("plus")}Add task</button></div>` : ""}</div>`;
}, { parent: "#/projects" });
act("pjTabD", (b) => { const { path } = parseHash(); swap(`#/${path}?tab=${b.dataset.v}`); });
act("pjTF", (b) => { const { path } = parseHash(); swap(`#/${path}?tab=tasks&f=${b.dataset.v}`); });
act("tkAdd", (b) => {
  const p = pjOf(b.dataset.p);
  if (pjLocked(p)) return toast("Tasks can’t be added to a project that isn’t active", "bad");
  const F = { title: "", assignee: "me", due: D.add(D.today(), 3), priority: "med", est: 4 };
  const s = openSheet({ title: "New task", body: `<div data-f></div>`, foot: `<button class="btn primary block" data-s="ok">Add task</button>`,
    onMount(el) {
      const draw = (err = "") => {
        el.querySelector("[data-f]").innerHTML = `<div class="stack s16">
          <div class="field"><label for="tk-n">Task</label><input id="tk-n" class="inp ${err ? "bad" : ""}" data-n maxlength="80" placeholder="Ex: Fix login crash on Android 9" value="${esc(F.title)}">${err ? `<span class="fld-err">${I("alert")}${esc(err)}</span>` : ""}</div>
          <div class="field"><span class="lbl">Assign to</span><div class="choices">${p.team.map((id) => `<button class="choice ${F.assignee === id ? "on" : ""}" data-s="as" data-v="${id}">${id === "me" ? "Me" : esc(person(id).name.split(" ")[0])}</button>`).join("")}</div></div>
          <div class="field"><span class="lbl">Due</span><div class="choices">${[["Today", 0], ["Tomorrow", 1], ["In 3 days", 3], ["Next week", 7]].map(([l, n]) => `<button class="choice ${F.due === D.add(D.today(), n) ? "on" : ""}" data-s="due" data-v="${n}">${l}</button>`).join("")}</div></div>
          <div class="field"><span class="lbl">Priority</span><div class="choices">${Object.entries(TK_PRI).map(([k, [l]]) => `<button class="choice ${F.priority === k ? "on" : ""}" data-s="pr" data-v="${k}">${l}</button>`).join("")}</div></div>
          <div class="field"><span class="lbl">Estimate</span><div class="choices">${[1, 2, 4, 8, 16].map((h) => `<button class="choice ${F.est === h ? "on" : ""}" data-s="est" data-v="${h}">${h}h</button>`).join("")}</div></div>
        </div>`;
      };
      el.addEventListener("input", (e) => { if (e.target.matches("[data-n]")) F.title = e.target.value; });
      onS(el, {
        as(b2) { F.assignee = b2.dataset.v; draw(); }, due(b2) { F.due = D.add(D.today(), Number(b2.dataset.v)); draw(); },
        pr(b2) { F.priority = b2.dataset.v; draw(); }, est(b2) { F.est = Number(b2.dataset.v); draw(); },
        ok() {
          const title = F.title.trim();
          if (title.length < 3) return draw("Give the task a short name (at least 3 characters).");
          if (p.tasks.some((t) => t.title.toLowerCase() === title.toLowerCase())) return draw("A task with this name already exists on this project.");
          const tp = PROJECTS.find((x) => x.id === p.id), ti = tp ? tp.tasks.push(title) - 1 : null;
          p.tasks.push({ id: uid(), ti, title, assignee: F.assignee, status: "todo", priority: F.priority, due: F.due, est: F.est, desc: "", comments: [], created: Date.now() });
          save(); closeSheet(s); rerender(); toast(F.assignee === "me" ? "Task added for you" : `Task added for ${person(F.assignee).name.split(" ")[0]}`);
        },
      });
      draw();
    } });
});

// ── Task detail ──
route("projects/:id/task/:tid", ({ id, tid }) => {
  const p = pjOf(id), t = tkOf(p, tid);
  if (!t) return `<div class="screen">${topbar("Task")}${emptyState(["clipboard"], "Task not found", "It may have been deleted.", `<button class="btn primary" data-go="#/projects?tab=tasks">My tasks</button>`)}</div>`;
  const locked = pjLocked(p), canEdit = !locked && (t.assignee === "me" || p.manager === "me");
  const mins = tkMins(p, t), r = t.est ? mins / (t.est * 60) : 0, due = dueInfo(t.due, t.status === "done");
  return `<div class="screen has-foot">${topbar("Task", { sub: pjName(p) })}
  <div class="scroll"><div class="stack s16" style="padding-top:6px">
    ${locked ? `<div class="banner ${p.status === "done" ? "ok" : "warn"}">${I(p.status === "done" ? "checkCircle" : "pause")}${p.status === "done" ? "This project is completed — the task is read-only." : "This project is on hold — the task can’t be changed."}</div>`
      : !canEdit ? `<div class="banner info">${I("info")}Assigned to ${esc(person(t.assignee).name)} — only they or the project manager can change it.</div>` : ""}
    <div class="tk-head"><h1>${esc(t.title)}</h1>${canEdit ? `<button class="ib sm" data-act="tkRename" data-p="${p.id}" data-t="${t.id}" aria-label="Rename task">${I("edit")}</button>` : ""}</div>
    <div class="field"><span class="lbl">Status</span><div class="tk-status">${Object.entries(TK_STATUS).map(([k, [l, tint]]) => `<button class="tint ${tint} ${t.status === k ? "on" : ""}" data-act="tkSet" data-k="status" data-v="${k}" data-p="${p.id}" data-t="${t.id}" ${canEdit ? "" : "disabled"}>${l}</button>`).join("")}</div></div>
    <div class="card tk-kv">
      <button class="kv" data-act="tkPick" data-k="priority" data-p="${p.id}" data-t="${t.id}" ${canEdit ? "" : "disabled"}><span class="kv-ic"><i class="tint t-red">${I("flame")}</i>Priority</span><span class="hrow" style="gap:6px">${prDot(t.priority)}${TK_PRI[t.priority][0]}${canEdit ? I("chevR") : ""}</span></button>
      <button class="kv" data-act="tkDue" data-p="${p.id}" data-t="${t.id}" ${canEdit ? "" : "disabled"}><span class="kv-ic"><i class="tint t-blue">${I("calendar")}</i>Due</span><span class="hrow ${due.tone}" style="gap:6px">${t.due ? D.long(t.due) : "None"}${due.tone ? ` · ${due.txt}` : ""}${canEdit ? I("chevR") : ""}</span></button>
      <button class="kv" data-act="tkPick" data-k="assignee" data-p="${p.id}" data-t="${t.id}" ${!locked && p.manager === "me" ? "" : "disabled"}><span class="kv-ic"><i class="tint t-violet">${I("user")}</i>Assignee</span><span class="hrow" style="gap:6px">${avatar(t.assignee, "xs")}${esc(t.assignee === "me" ? "You" : person(t.assignee).name)}${!locked && p.manager === "me" ? I("chevR") : ""}</span></button>
      <div class="kv"><span class="kv-ic"><i class="tint t-amber">${I("clock")}</i>Time</span><span>${fmtH(mins)} of ${t.est}h</span></div>
      <span class="pj-prog"><i style="width:${Math.min(100, r * 100)}%;background:${r > 1 ? "var(--danger)" : rangeColor(Math.min(1, r) * 0.6 + 0.4)}"></i></span>
      ${r > 1 ? `<span class="small" style="color:var(--danger);font-weight:600;margin-top:6px;display:block">${fmtH(mins - t.est * 60)} over the estimate</span>` : ""}
    </div>
    ${t.desc ? `<div class="cd-sec" style="border-top:0;padding-top:0;margin-top:0"><h2 class="sec-ic">${I("list")}Description</h2><p>${esc(t.desc)}</p></div>` : ""}
    <div class="cd-sec"><div class="hrow"><h2 class="grow sec-ic">${I("msg")}Comments</h2>${!locked ? `<button class="link" data-act="tkComment" data-p="${p.id}" data-t="${t.id}">+ Add comment</button>` : ""}</div>
      ${t.comments.length ? t.comments.map((m) => `<div class="cd-cm">${avatar(m.who, "sm")}<div class="grow"><div class="hrow"><b class="grow">${esc(m.who === "me" ? "You" : person(m.who).name)}</b><span class="tiny faint">${D.ago(m.ts)}</span></div><p>${esc(m.text)}</p></div></div>`).join("") : `<p class="small muted">No comments yet.</p>`}</div>
  </div></div>
  <div class="foot"><div class="row-btns">
    ${t.status !== "done" && canEdit ? `<button class="btn outline" data-act="tkSet" data-k="status" data-v="done" data-p="${p.id}" data-t="${t.id}">${I("check")}Mark done</button>` : ""}
    <button class="btn primary" style="flex:1" data-act="tkLog" data-p="${p.id}" data-t="${t.id}" ${locked || t.ti == null ? "disabled" : ""}>${I("clock")}Log time</button>
  </div></div></div>`;
}, { parent: ({ id }) => `#/projects/${id}?tab=tasks` });
const tkFrom = (b) => { const p = pjOf(b.dataset.p); return [p, tkOf(p, b.dataset.t)]; };
act("tkSet", (b) => {
  const [p, t] = tkFrom(b); if (!t || b.disabled) return;
  const prev = t[b.dataset.k]; if (prev === b.dataset.v) return;
  t[b.dataset.k] = b.dataset.v; save(); rerender();
  if (b.dataset.v === "done") { try { navigator.vibrate?.([12, 30, 18]); } catch {} undoToast("Task marked done", () => { t.status = prev; save(); rerender(); }); }
  else toast(`Moved to ${TK_STATUS[b.dataset.v][0]}`);
});
act("tkPick", (b) => {
  const [p, t] = tkFrom(b); if (b.disabled) return;
  if (b.dataset.k === "priority") pickOption({ title: "Priority", value: t.priority, options: Object.entries(TK_PRI).map(([k, [l]]) => ({ v: k, label: l })), onPick(v) { t.priority = v; save(); rerender(); } });
  else pickOption({ title: "Assign to", value: t.assignee, options: p.team.map((id) => ({ v: id, label: id === "me" ? "Me" : person(id).name, sub: id === p.manager ? "Project manager" : person(id).role, icon: "user" })), onPick(v) { t.assignee = v; save(); rerender(); toast(v === "me" ? "Assigned to you" : `Assigned to ${person(v).name.split(" ")[0]}`); } });
});
act("tkDue", (b) => {
  const [, t] = tkFrom(b); if (b.disabled) return;
  pickDates({ title: "Due date", mode: "single", start: t.due || D.today(), onDone({ start }) { if (start < D.today() && t.status !== "done") return toast("Pick today or a later date", "bad"); t.due = start; save(); rerender(); } });
});
act("tkRename", (b) => {
  const [p, t] = tkFrom(b);
  const s = openSheet({ title: "Rename task", body: `<input class="inp" data-n maxlength="80" value="${esc(t.title)}"><span class="fld-err" data-e hidden></span>`, foot: `<button class="btn primary block" data-s="ok">Save</button>`,
    onMount(el) { onS(el, { ok() { const v = el.querySelector("[data-n]").value.trim(), e = el.querySelector("[data-e]");
      if (v.length < 3) { e.hidden = false; e.innerHTML = `${I("alert")}At least 3 characters`; return; }
      if (p.tasks.some((x) => x !== t && x.title.toLowerCase() === v.toLowerCase())) { e.hidden = false; e.innerHTML = `${I("alert")}Another task already has this name`; return; }
      t.title = v; const tp = PROJECTS.find((x) => x.id === p.id); if (tp && t.ti != null) tp.tasks[t.ti] = v; save(); closeSheet(s); rerender(); } }); } });
});
act("tkComment", (b) => {
  const [, t] = tkFrom(b);
  const s = openSheet({ title: "Add comment", body: `<textarea class="inp" data-c rows="3" maxlength="400" placeholder="Share an update or ask a question"></textarea>`, foot: `<button class="btn primary block" data-s="ok">Add comment</button>`,
    onMount(el) { onS(el, { ok() { const v = el.querySelector("[data-c]").value.trim(); if (v.length < 2) return toast("Write a short comment first", "bad"); t.comments.push({ who: "me", text: v, ts: Date.now() }); save(); closeSheet(s); rerender(); toast("Comment added"); } }); } });
});
act("tkLog", (b) => {
  const [p, t] = tkFrom(b); if (b.disabled) return;
  const L = { mins: 60, day: D.today(), note: `Worked on ${t.title}` };
  const s = openSheet({ title: "Log time", body: `<div data-l></div>`, foot: `<button class="btn primary block" data-s="ok"></button>`,
    onMount(el) {
      const draw = (err = "") => {
        const dayTotal = (S.ts.entries[L.day] || []).reduce((a, e) => a + (e.mins || 0), 0);
        el.querySelector("[data-l]").innerHTML = `<div class="stack s16">
          <div class="tk-log-t"><b>${esc(t.title)}</b><span class="small muted">${esc(pjName(p))}</span></div>
          <div class="field"><span class="lbl">How long?</span><div class="choices">${[30, 60, 120, 240, 480].map((m) => `<button class="choice ${L.mins === m ? "on" : ""}" data-s="m" data-v="${m}">${m < 60 ? "30m" : m / 60 + "h"}</button>`).join("")}</div></div>
          <div class="field"><span class="lbl">Day</span><div class="choices">${[["Today", 0], ["Yesterday", -1], ["2 days ago", -2]].map(([l, n]) => `<button class="choice ${L.day === D.add(D.today(), n) ? "on" : ""}" data-s="d" data-v="${n}">${l}</button>`).join("")}</div>
            <span class="tiny muted">${D.nice(L.day)} · ${fmtH(dayTotal)} already logged</span></div>
          <div class="field"><label for="tk-c">What did you do?</label><input id="tk-c" class="inp" data-c maxlength="140" value="${esc(L.note)}"></div>
          ${err ? `<div class="x-err"><span class="x-err-ic">${I("alert")}</span><span class="grow"><b>Can’t log this</b><span>${err}</span></span></div>` : ""}
        </div>`;
        el.querySelector("[data-s=ok]").textContent = `Log ${L.mins < 60 ? "30m" : L.mins / 60 + "h"}`;
      };
      el.addEventListener("input", (e) => { if (e.target.matches("[data-c]")) L.note = e.target.value; });
      onS(el, {
        m(b2) { L.mins = Number(b2.dataset.v); draw(); }, d(b2) { L.day = D.add(D.today(), Number(b2.dataset.v)); draw(); },
        ok() {
          const list = (S.ts.entries[L.day] ||= []), dayTotal = list.reduce((a, e) => a + (e.mins || 0), 0);
          if (isLocked(L.day)) return draw("That week’s timesheet is already submitted. Ask your manager to reopen it, or log it on another day.");
          if (dayTotal + L.mins > 16 * 60) return draw(`That would make ${fmtH(dayTotal + L.mins)} on ${D.short(L.day)} — more than 16 hours in a day.`);
          if (L.note.trim().length < 3) return draw("Add a short note — your timesheet needs one for every entry.");
          const ex = list.find((e) => e.pid === p.id && e.ti === t.ti);
          if (ex) { ex.mins += L.mins; ex.comment = ex.comment || L.note.trim(); } else list.push({ id: uid(), pid: p.id, ti: t.ti, mins: L.mins, billable: !p.internal, comment: L.note.trim() });
          ensureWeek(D.monday(L.day));
          if (t.status === "todo") t.status = "doing";
          save(); closeSheet(s); rerender(); toast(`Logged ${L.mins < 60 ? "30m" : L.mins / 60 + "h"} on ${D.short(L.day)}`);
        },
      });
      draw();
    } });
});

// ── Kais: "my tasks", "what's due", "project status" ──
{ const base = kaisAnswer; kaisAnswer = function (q) {
  const t = q.toLowerCase();
  if (/\b(my tasks|tasks? (due|today|this week|overdue|pending)|what.?s due|to-?dos?)\b/.test(t)) {
    const open = myTasks().filter((x) => x.t.status !== "done"), od = open.filter((x) => x.t.due && x.t.due < D.today()), td = open.filter((x) => x.t.due === D.today());
    return { text: open.length ? `You have **${open.length}** open task(s)${od.length ? ` — **${od.length} overdue**` : ""}${td.length ? `, **${td.length}** due today` : ""}:\n${open.sort((a, b) => (a.t.due || "9") < (b.t.due || "9") ? -1 : 1).slice(0, 4).map((x) => `- **${x.t.title}** — ${dueInfo(x.t.due).txt.toLowerCase()} (${pjName(x.p)})`).join("\n")}` : "No open tasks — you’re all caught up.",
      card: { type: "link", label: "Open my tasks", go: "#/projects?tab=tasks", icon: "checkCircle" }, follow: ["Show my projects", "Log 2h on design system development"] };
  }
  if (/\b(my projects|projects?( status| overview)?|show (my )?projects)\b/.test(t) && !/expense/.test(t)) {
    const act = pjList().filter((p) => p.status === "active" && p.team.includes("me"));
    const risk = act.filter((p) => (p.budget && pjMins(p) / 60 > p.budget) || (daysLeft(p) != null && daysLeft(p) < 0));
    return { text: `You’re on **${act.length}** active project(s):\n${act.map((p) => `- **${pjName(p)}** — ${Math.round(pjProg(p) * 100)}% done${p.end ? `, ${daysLeft(p) < 0 ? `${-daysLeft(p)}d late` : `${daysLeft(p)}d left`}` : ""}`).join("\n")}${risk.length ? `\n\nNeeds attention: **${risk.map(pjName).join(", ")}** (over budget or past the end date).` : ""}`,
      card: { type: "link", label: "Open projects", go: "#/projects", icon: "briefcase" }, follow: ["What’s due this week?"] };
  }
  return base(q);
}; }

// ── Home widget: My tasks ──
function tasksWidget() {
  const td = D.today(), wk = D.add(td, 6);
  const open = myTasks().filter((x) => x.t.status !== "done" && !pjLocked(x.p));
  const od = open.filter((x) => x.t.due && x.t.due < td), today = open.filter((x) => x.t.due === td), week = open.filter((x) => x.t.due > td && x.t.due <= wk);
  const next = open.slice().sort((a, b) => ((a.t.due || "9") < (b.t.due || "9") ? -1 : 1)).slice(0, 3);
  const stat = (n, label, tone, f) => `<button class="w-tk-stat ${n && tone ? tone : ""}" data-go="#/projects?tab=tasks${f ? "&f=" + f : ""}"><span class="w-tk-h">${I({ Overdue: "alert", Today: "sun", "This week": "calendar" }[label] || "list")}<small>${label}</small></span><b class="num">${n}</b></button>`;
  return `<div class="sec"><h2>My tasks</h2><button class="link" data-go="#/projects?tab=tasks">See all</button></div>
    <div class="card w-tasks">
      <div class="w-tk-stats">${stat(od.length, "Overdue", "bad")}${stat(today.length, "Today", "warn")}${stat(week.length, "This week", "")}</div>
      ${next.length ? `<div class="w-tk-list">${next.map((x) => tkRow(x.p, x.t)).join("")}</div>` : emptyMini("checkCircle", "You’re all caught up — no open tasks.")}
    </div>`;
}

// team hours this week (demo base rate from the project's history + anything you logged), coloured by range
function pjWeekChart(p) {
  if (p.status !== "active") return "";
  const mon = D.monday(D.today()), days = [0, 1, 2, 3, 4].map((i) => D.add(mon, i));
  const weeks = Math.max(1, D.diff(p.start, D.today()) / 7), daily = p.base / 60 / weeks / 5;
  let h = 0; for (const ch of p.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const vals = days.map((d, i) => {
    if (d > D.today()) return 0;
    const mine = Object.entries(S.ts.entries).filter(([k]) => k === d).flatMap(([, l]) => l).filter((e) => e.pid === p.id).reduce((a, e) => a + (e.mins || 0), 0) / 60;
    return Math.round((daily * (0.6 + ((h >> (i * 3)) % 7) / 10) + mine) * 10) / 10;
  });
  const fut = days.map((d, i) => (d > D.today() ? i : -1)).filter((i) => i >= 0), total = vals.reduce((a, v) => a + v, 0);
  const today = days.indexOf(D.today());
  return `<div class="sec"><h2 class="sec-ic">${I("chart")}This week</h2><span class="tiny muted">${Math.round(total)}h logged by the team</span></div>
    <div class="card ch-card">${capsuleBars({ values: vals, labels: ["Mon", "Tue", "Wed", "Thu", "Fri"], goal: Math.max(1, Math.round(daily)), goalLabel: `${Math.round(daily)}h`, active: today >= 0 ? today : 4, future: fut, fmt: (v) => `${v}h`, height: 110 })}</div>`;
}


// ── project details: key facts on the overview, everything (by category) on its own page ──
const PJ_META = {
  p1: { model: "Time & material", po: "PO-ZF-2026-114", dept: "Mobile", region: "Chennai, India", priority: "High", rate: 2400 },
  p2: { model: "Internal", dept: "Design", region: "Chennai, India", priority: "Medium" },
  p3: { model: "Fixed price", po: "PO-PR-0991", dept: "Mobile", region: "Bengaluru, India", priority: "High", value: 1850000 },
  p4: { model: "Internal", dept: "Finance tech", region: "Chennai, India", priority: "Low" },
  p5: { model: "Internal", dept: "Company-wide", region: "All offices", priority: "Low" },
  p6: { model: "Fixed price", po: "PO-NG-552", dept: "Web", region: "Remote", priority: "Medium", value: 940000 },
};
const pjMeta = (p) => PJ_META[p.id] || { model: p.internal ? "Internal" : "Time & material", dept: "—", region: "—", priority: "Medium" };
const pjBillable = (p) => !p.internal && !/internal/i.test(p.client);
const pjContact = (p) => S.crm?.contacts.find((c) => c.company === p.client);
const pjRow = (icon, tint, label, val, attr = "") => `${attr ? `<button class="crm-kv" ${attr}>` : "<div>"}<span class="kv-ic"><i class="tint ${tint}">${I(icon)}</i>${label}</span><b class="pj-kv-v">${val}</b>${attr ? "</button>" : "</div>"}`;

function pjDetailsCard(p) {
  const m = pjMeta(p);
  return `<div class="sec"><h2 class="sec-ic">${I("list")}Details</h2><button class="link" data-go="#/projects/${p.id}/info">View more</button></div>
    <div class="card"><div class="cd-kv">
      ${pjRow("building", "t-blue", "Client", esc(p.client))}
      ${pjRow("user", "t-green", "Project manager", `<span class="hrow" style="gap:6px">${avatar(p.manager, "xs")}${esc(p.manager === "me" ? "You" : person(p.manager).name)}</span>`, `data-go="#/people/${p.manager}"`)}
      ${pjRow("calendar", "t-violet", "Timeline", `${D.short(p.start)} – ${p.end ? D.short(p.end) : "Ongoing"}`)}
      ${pjRow("receipt", "t-amber", "Billing", `${pjBillable(p) ? "Billable" : "Non-billable"} · ${esc(m.model)}`)}
    </div></div>`;
}

route("projects/:id/info", ({ id }) => {
  const p = pjOf(id);
  if (!p) return `<div class="screen">${topbar("Project details")}${emptyState(["briefcase"], "Project not found", "It may have been removed.", `<button class="btn primary" data-go="#/projects">All projects</button>`)}</div>`;
  const m = pjMeta(p), hrs = Math.round(pjMins(p) / 60), dl = daysLeft(p), weeks = Math.max(1, D.diff(p.start, D.today()) / 7);
  const open = p.tasks.filter((t) => t.status !== "done"), overdue = open.filter((t) => t.due && t.due < D.today()).length;
  const next = p.milestones.find((x) => !x.done), c = pjContact(p);
  const dur = p.end ? D.diff(p.start, p.end) : null;
  const sec = (icon, title, rows) => `<div class="sec"><h2 class="sec-ic">${I(icon)}${title}</h2></div><div class="card"><div class="cd-kv">${rows.filter(Boolean).join("")}</div></div>`;
  return `<div class="screen">${topbar("Project details", { sub: p.code })}
    <div class="scroll"><div class="stack">
      <div class="pj-info-hd"><span class="pj-ic tint ${p.tint}">${I(pjIcon(p))}</span><span class="grow" style="min-width:0"><b>${esc(pjName(p))}</b><span class="small muted">${esc(p.client)}</span></span>${pjBadge(p)}</div>
      ${sec("info", "General", [
        pjRow("tag", "t-slate", "Project code", esc(p.code)),
        pjRow("briefcase", "t-blue", "Type", p.internal || !pjBillable(p) ? "Internal project" : "Client project"),
        pjRow("users", "t-violet", "Department", esc(m.dept)),
        pjRow("flame", m.priority === "High" ? "t-red" : m.priority === "Low" ? "t-green" : "t-amber", "Priority", esc(m.priority)),
        pjRow("pin", "t-teal", "Location", esc(m.region)),
      ])}
      ${p.desc ? `<p class="pj-desc pj-info-desc">${esc(p.desc)}</p>` : ""}
      ${sec("building", "Client & billing", [
        pjRow("building", "t-blue", "Client", esc(p.client)),
        c ? pjRow("user", "t-green", "Client contact", `<span class="hrow" style="gap:6px">${crmAv(c, "xs")}${esc(c.name)}</span>`, `data-go="#/crm/contact/${c.id}"`) : "",
        pjRow("receipt", "t-amber", "Billing", pjBillable(p) ? "Billable" : "Non-billable"),
        pjRow("wallet", "t-violet", "Engagement", esc(m.model)),
        m.value ? pjRow("dollar", "t-green", "Contract value", money(m.value)) : "",
        m.rate ? pjRow("dollar", "t-green", "Hourly rate", `${money(m.rate)} / h`) : "",
        m.po ? pjRow("file", "t-slate", "PO number", esc(m.po)) : "",
      ])}
      ${sec("calendar", "Schedule", [
        pjRow("calendar", "t-blue", "Start date", D.long(p.start)),
        pjRow("calendar", "t-violet", p.status === "done" ? "Closed on" : "End date", p.end ? D.long(p.end) : "Ongoing"),
        dur != null ? pjRow("clock", "t-slate", "Duration", `${plural(Math.round(dur / 7), "week")}`) : "",
        p.status === "active" && dl != null ? pjRow("clock", dl < 0 ? "t-red" : dl <= 7 ? "t-amber" : "t-green", dl < 0 ? "Overdue by" : "Time left", `<span class="${dl < 0 ? "bad" : ""}">${plural(Math.abs(dl), "day")}</span>`) : "",
        next ? pjRow("milestone", "t-amber", "Next milestone", `${esc(next.name)} · ${D.short(next.date)}`) : "",
      ])}
      ${sec("clock", "Effort & budget", [
        pjRow("clock", "t-blue", "Hours logged", `${hrs}h`),
        p.budget ? pjRow("wallet", "t-violet", "Budget", `${p.budget}h`) : "",
        p.budget ? pjRow("chart", hrs > p.budget ? "t-red" : "t-green", hrs > p.budget ? "Over budget" : "Remaining", `<span class="${hrs > p.budget ? "bad" : ""}">${Math.abs(p.budget - hrs)}h</span>`) : "",
        p.budget ? pjRow("chart", "t-amber", "Budget used", `${Math.round(hrs / p.budget * 100)}%`) : "",
        pjRow("history", "t-slate", "Average burn", `${Math.round(hrs / weeks)}h / week`),
      ])}
      ${sec("checkCircle", "Tasks", [
        pjRow("list", "t-slate", "Total", String(p.tasks.length)),
        pjRow("clock", "t-blue", "Open", String(open.length)),
        pjRow("checkCircle", "t-green", "Done", String(pjDone(p))),
        pjRow("alert", overdue ? "t-red" : "t-slate", "Overdue", `<span class="${overdue ? "bad" : ""}">${overdue}</span>`),
        pjRow("user", "t-violet", "Assigned to you", String(p.tasks.filter((t) => t.assignee === "me").length), `data-go="#/projects/${p.id}?tab=tasks"`),
      ])}
      <div class="sec"><h2 class="sec-ic">${I("users")}Team</h2><span class="tiny muted">${plural(p.team.length, "member")}</span></div>
      <div class="card crm-list">${p.team.map((x) => `<button class="crm-row" data-go="#/people/${x}">${avatar(x, "sm")}<span class="grow" style="min-width:0"><b class="ell">${esc(x === "me" ? `${person("me").name} (you)` : person(x).name)}</b><span class="small muted ell">${x === p.manager ? "Project manager" : esc(person(x).role || "Team member")}</span></span>${I("chevR")}</button>`).join("")}</div>
      ${p.milestones.length ? `<div class="sec"><h2 class="sec-ic">${I("milestone")}Milestones</h2><span class="tiny muted">${p.milestones.filter((x) => x.done).length} of ${p.milestones.length} done</span></div>
      <div class="card"><div class="cd-kv">${p.milestones.map((x) => { const late = !x.done && x.date < D.today(); return pjRow(x.done ? "checkCircle" : late ? "alert" : "milestone", x.done ? "t-green" : late ? "t-red" : "t-slate", esc(x.name), `<span class="${late ? "bad" : ""}">${x.done ? "Done · " : late ? "Late · " : ""}${D.short(x.date)}</span>`); }).join("")}</div></div>` : ""}
    </div></div></div>`;
}, { parent: ({ id }) => `#/projects/${id}` });
