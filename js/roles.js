// Personas: who you are changes what Home puts first, which apps and approvals you get, and what you can open.
// Super user (default) keeps every feature exactly as before. The role is a demo switch ("View as" in the menu);
// a real backend would enforce it at sign-in.

const ROLES = {
  super: { name: "Super user", icon: "sparkles", sub: "Every feature in KEBS — the full experience", mods: "*", inbox: "*" },
  employee: { name: "Employee", icon: "user", sub: "Attendance, leave, timesheets, claims and your tasks", mods: ["projects"], inbox: [] },
  pm: { name: "Project manager", icon: "briefcase", sub: "Projects you run, team tasks and timesheet approvals", mods: ["projects"], inbox: ["timesheet", "leave"] },
  am: { name: "Account manager", icon: "building", sub: "Client accounts, their deals and project health", mods: ["projects", "crm"], inbox: ["expense"] },
  rep: { name: "Sales rep", icon: "phone", sub: "Your deals, today’s follow-ups and new leads", mods: ["projects", "crm"], inbox: [] },
  sales: { name: "Sales manager", icon: "target", sub: "Team pipeline, deals at risk and approvals", mods: ["projects", "crm"], inbox: ["expense", "leave"] },
  csuite: { name: "C-suite", icon: "chart", sub: "Company at a glance and high-value approvals", mods: ["projects", "crm"], inbox: "*" },
  admin: { name: "Admin", icon: "shield", sub: "Users, roles, policies and announcements", mods: ["projects"], inbox: [] },
};
const ROLE_ORDER = ["super", "employee", "pm", "am", "rep", "sales", "csuite", "admin"];
const role = () => (ROLES[S.settings?.role] ? S.settings.role : "super");
const roleDef = () => ROLES[role()];
const can = (mod) => roleDef().mods === "*" || roleDef().mods.includes(mod);
// approvals that reach this role's inbox
function inboxList() {
  const k = roleDef().inbox;
  return k === "*" ? S.inbox : S.inbox.filter((x) => k.includes(x.kind));
}

// ── "View as" switcher ──
function pickRole() {
  const s = openSheet({ title: "View KEBS as", body: `<p class="small muted" style="margin:-4px 2px 12px">Each role sees its own Home, apps and approvals. Super user has everything.</p>
    <div class="list role-list">${ROLE_ORDER.map((id) => { const r = ROLES[id]; return `<button class="opt-row" data-s="pick" data-v="${id}"><span class="ic">${I(r.icon)}</span><span class="grow"><span class="b">${r.name}</span><span class="small muted" style="display:block">${r.sub}</span></span>${id === role() ? `<span class="tick">${I("check")}</span>` : ""}</button>`; }).join("")}</div>`,
    onMount(el) { onS(el, { pick(b) {
      closeSheet(s); if (b.dataset.v === role()) return;
      S.settings.role = b.dataset.v; save(); if (typeof closeDrawer === "function") closeDrawer();
      location.hash === "#/home" ? rerender() : go("#/home");
      toast(`Now viewing as ${ROLES[b.dataset.v].name}`);
    } }); } });
}
act("pickRole", pickRole);

// small strip on Home when you're not the super user
function roleBanner() {
  if (role() === "super") return "";
  const r = roleDef();
  return `<button class="role-bn" data-act="pickRole">${I(r.icon)}<span class="grow">Viewing as <b>${r.name}</b></span><span class="role-bn-s">Switch</span></button>`;
}

// ── role widgets on Home ──
const rwStat = (icon, color, label, val, go, bad) => `<button class="w-tk-stat ${bad ? "bad" : ""}" ${go ? `data-go="${go}"` : ""}><span class="w-tk-h" style="--ic:${color}">${I(icon)}<small>${label}</small></span><b class="num">${val}</b></button>`;
const rwRow = (lead, title, sub, right, go) => `<button class="li" ${go ? `data-go="${go}"` : ""}>${lead}<span class="grow" style="min-width:0"><b class="ell" style="display:block">${title}</b><span class="tiny muted ell" style="display:block">${sub}</span></span>${right || ""}${I("chevR")}</button>`;
const rwCard = (icon, title, link, stats, rows) => `<div class="sec"><h2 class="sec-ic">${I(icon)}${title}</h2>${link ? `<button class="link" data-go="${link[1]}">${link[0]}</button>` : ""}</div>
  <div class="card rw-card"><div class="w-tk-stats">${stats.join("")}</div>${rows.length ? `<div class="list rw-list">${rows.join("")}</div>` : ""}</div>`;
const pjRisk = (p) => { const hrs = Math.round(pjMins(p) / 60), dl = daysLeft(p); return p.status === "active" && ((p.budget && hrs > p.budget * 0.9) || (dl != null && dl < 0) || p.tasks.some((t) => t.status !== "done" && t.due && t.due < D.today())); };

function pmWidget() {
  const mine = pjList().filter((p) => p.manager === "me" && p.status === "active");
  const tasks = mine.flatMap((p) => p.tasks.filter((t) => t.status !== "done")), late = tasks.filter((t) => t.due && t.due < D.today()).length;
  const ts = S.inbox.filter((x) => x.kind === "timesheet").length;
  return rwCard("briefcase", "Projects you manage", ["All projects", "#/projects"], [
    rwStat("briefcase", "#3b82f6", "Active", mine.length, "#/projects"),
    rwStat("alert", "var(--danger)", "Overdue tasks", late, "#/projects", late > 0),
    rwStat("clipboard", "#0d9488", "To approve", ts, "#/inbox?tab=timesheet"),
  ], mine.map((p) => { const prog = pjProg(p), hrs = Math.round(pjMins(p) / 60);
    return rwRow(`<span class="pj-ic tint ${p.tint}">${I(pjIcon(p))}</span>`, esc(pjName(p)), `${Math.round(prog * 100)}% done · ${p.budget ? `${hrs}/${p.budget}h budget` : `${hrs}h`} · ${plural(p.team.length - 1, "teammate")}`, pjRisk(p) ? `<span class="rw-flag">At risk</span>` : "", `#/projects/${p.id}`); }));
}
function salesWidget() {
  const open = crmOpenDeals(), v = open.reduce((a, d) => a + d.value, 0), w = open.reduce((a, d) => a + d.value * d.prob / 100, 0);
  const late = open.filter((d) => d.close < D.today()), week = open.filter((d) => d.close >= D.today() && d.close <= D.add(D.today(), 7));
  const next = [...open].sort((a, b) => a.close.localeCompare(b.close)).slice(0, 3);
  return rwCard("target", "Team pipeline", ["Open CRM", "#/crm"], [
    rwStat("target", "#3b82f6", "Open", crmAmt(v), "#/crm"),
    rwStat("chart", "#8b5cf6", "Weighted", crmAmt(w), "#/crm"),
    rwStat("alert", "var(--danger)", "At risk", late.length, "#/crm?tab=pipeline", late.length > 0),
  ], [...late, ...next.filter((d) => !late.includes(d))].slice(0, 3).map((d) => rwRow(`<i class="crm-sdot" style="background:${STAGE_C[d.stage]};margin:0 6px"></i>`, esc(d.name), `${esc(d.company)} · ${stageName(d.stage)} · ${crmAmt(d.value)}`, d.close < D.today() ? `<span class="rw-flag">${D.diff(d.close, D.today())}d late</span>` : `<span class="tiny muted">${D.short(d.close)}</span>`, `#/crm/deal/${d.id}`)).concat(week.length ? [] : []));
}
function repWidget() {
  const mine = crmOpenDeals().filter((d) => d.owner === "me"), td = D.today();
  const due = S.crm.acts.filter((a) => !a.done && a.due && a.due <= td).sort((a, b) => (a.due + (a.time || "")).localeCompare(b.due + (b.time || "")));
  const fresh = S.crm.leads.filter((l) => l.status === "new");
  const rows = [...due.slice(0, 3).map((a) => rwRow(`<span class="ic" style="color:${ACT_T[a.type][2]}">${I(ACT_T[a.type][1])}</span>`, esc(a.title), `${ACT_T[a.type][0]} · ${esc(crmRefName(a.ref).split(" · ")[0])}`, a.due < td ? `<span class="rw-flag">Overdue</span>` : `<span class="tiny muted">${a.time ? D.hm(a.time) : "Today"}</span>`, crmRefHref(a.ref))),
    ...fresh.sort((a, b) => b.score - a.score).slice(0, Math.max(0, 4 - Math.min(3, due.length))).map((l) => rwRow(crmAv(l), esc(l.name), `New lead · ${esc(l.company)} · ${esc(l.source)}`, `<span class="tiny muted">${l.score >= 70 ? "🔥 " : ""}${l.score}</span>`, `#/crm/lead/${l.id}`))];
  return rwCard("phone", "Your sales day", ["Open CRM", "#/crm"], [
    rwStat("target", "#3b82f6", "My pipeline", crmAmt(mine.reduce((a, d) => a + d.value, 0)), "#/crm"),
    rwStat("clock", due.some((a) => a.due < td) ? "var(--danger)" : "#d97706", "Follow-ups", due.length, "#/crm?tab=activities", due.some((a) => a.due < td)),
    rwStat("sparkles", "#8b5cf6", "New leads", fresh.length, "#/crm?tab=leads&f=new"),
  ], rows);
}
function amWidget() {
  const cos = [...new Set([...S.crm.deals.filter((d) => d.owner === "me").map((d) => d.company), ...pjList().filter((p) => !/internal/i.test(p.client)).map((p) => p.client)])];
  const rows = cos.slice(0, 4).map((co) => {
    const ds = crmOpenDeals().filter((d) => d.company === co), pj = pjList().find((p) => p.client === co && p.status === "active"), c = S.crm.contacts.find((x) => x.company === co);
    const sub = [ds.length ? `${plural(ds.length, "open deal")} · ${crmAmt(ds.reduce((a, d) => a + d.value, 0))}` : "", pj ? `Project ${Math.round(pjProg(pj) * 100)}% done` : ""].filter(Boolean).join(" · ") || "No open work";
    return rwRow(c ? crmAv(c) : `<span class="av sm crm-av t-slate">${esc(initials(co))}</span>`, esc(co), sub, pj && pjRisk(pj) ? `<span class="rw-flag">Needs attention</span>` : "", c ? `#/crm/contact/${c.id}` : pj ? `#/projects/${pj.id}` : "#/crm");
  });
  const openV = crmOpenDeals().filter((d) => cos.includes(d.company)).reduce((a, d) => a + d.value, 0);
  return rwCard("building", "Your accounts", ["Contacts", "#/crm?tab=contacts"], [
    rwStat("building", "#3b82f6", "Accounts", cos.length, "#/crm?tab=contacts"),
    rwStat("target", "#8b5cf6", "Open deals", crmAmt(openV), "#/crm"),
    rwStat("briefcase", "#0d9488", "Live projects", pjList().filter((p) => cos.includes(p.client) && p.status === "active").length, "#/projects"),
  ], rows);
}
function csuiteWidget() {
  const open = crmOpenDeals(), month = D.today().slice(0, 7), won = S.crm.deals.filter((d) => d.stage === "won" && D.iso(d.history.at(-1).ts).startsWith(month));
  const risky = pjList().filter(pjRisk);
  return rwCard("chart", "Company at a glance", null, [
    rwStat("target", "#3b82f6", "Pipeline", crmAmt(open.reduce((a, d) => a + d.value, 0)), "#/crm"),
    rwStat("award", "var(--ok)", "Won (month)", crmAmt(won.reduce((a, d) => a + d.value, 0)), "#/crm?tab=pipeline&stage=won"),
    rwStat("users", "#8b5cf6", "Headcount", S.people.length + 1, "#/people"),
  ], [
    rwRow(`<span class="ic tint t-amber">${I("briefcase")}</span>`, `${plural(pjList().filter((p) => p.status === "active").length, "active project")}`, risky.length ? `${risky.length} at risk: ${risky.map((p) => esc(pjName(p))).slice(0, 2).join(", ")}` : "All on track", risky.length ? `<span class="rw-flag">${risky.length} at risk</span>` : "", "#/projects"),
    rwRow(`<span class="ic tint t-blue">${I("inbox")}</span>`, `${plural(inboxList().length, "approval")} waiting`, "Expenses, timesheets and leave across teams", "", "#/inbox"),
  ]);
}
function adminWidget() {
  const soon = (t) => `data-act="adminSoon" data-t="${t}"`;
  return `<div class="sec"><h2 class="sec-ic">${I("shield")}Admin</h2></div>
    <div class="card rw-card"><div class="w-tk-stats">
      ${rwStat("users", "#3b82f6", "Users", S.people.length + 1, "#/people")}
      ${rwStat("inbox", "#d97706", "Org approvals", S.inbox.length, "")}
      ${rwStat("megaphone", "#8b5cf6", "Posts", S.posts.length, "#/announcements")}
    </div><div class="list rw-list">
      <button class="li" ${soon("Users & roles")}><span class="ic tint t-blue">${I("users")}</span><span class="grow"><b style="display:block">Users & roles</b><span class="tiny muted">Invite people, set roles and access</span></span>${I("chevR")}</button>
      <button class="li" ${soon("Policies")}><span class="ic tint t-violet">${I("file")}</span><span class="grow"><b style="display:block">Leave & expense policies</b><span class="tiny muted">Leave types, limits and approval rules</span></span>${I("chevR")}</button>
      <button class="li" data-go="#/announcements"><span class="ic tint t-amber">${I("megaphone")}</span><span class="grow"><b style="display:block">Announcements</b><span class="tiny muted">Post updates to everyone</span></span>${I("chevR")}</button>
      <button class="li" ${soon("Audit log")}><span class="ic tint t-slate">${I("history")}</span><span class="grow"><b style="display:block">Audit log</b><span class="tiny muted">Who changed what, and when</span></span>${I("chevR")}</button>
    </div></div>`;
}
act("adminSoon", (b) => toast(`${b.dataset.t} is part of the admin console — coming next`, "info"));

// the role block sits right under Quick access
function roleLead() {
  const lead = { pm: pmWidget, am: amWidget, rep: repWidget, sales: salesWidget, csuite: csuiteWidget, admin: adminWidget }[role()];
  return lead ? `<div class="role-lead">${lead()}</div>` : "";
}
// Home: super user keeps today's layout; other roles get their own block first
{
  const base = homeWidgets;
  homeWidgets = function () {
    const r = role();
    if (r === "super") return base();
    const parts = [attentionWidget()];
    if (r !== "csuite" && typeof tasksWidget === "function") parts.push(tasksWidget());
    parts.push(`<div class="sec"><h2>At a glance</h2></div><div class="grid2 w-grid">${leaveWidget()}${paydayWidget()}</div>`);
    if (r === "employee" || r === "pm") parts.push(hoursWidget());
    return parts.join("");
  };
}

// screens a role can't open show a friendly lock instead
function roleLocked(what) {
  return `<div class="screen">${topbar(what)}<div class="scroll">${emptyState(["user"], `${what} isn’t part of your role`, `You’re viewing KEBS as ${roleDef().name}. Ask your admin for access, or switch role to try it.`, `<button class="btn primary" data-act="pickRole">${I("user")}Switch role</button>`)}</div></div>`;
}
ROUTES.forEach((r) => {
  if (/^\^crm/.test(r.re.source)) { const orig = r.render; r.render = (g, q) => (can("crm") ? orig(g, q) : roleLocked("CRM")); }
});
