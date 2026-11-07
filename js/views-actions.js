// All actions: every quick action in KEBS on one page, grouped by area and searchable.
// Opened from the arrow on Home's Quick access card. "Edit" picks which ones sit on Home.

const MORE_ACTIONS = [
  { id: "projects", label: "My projects", cat: "Projects", go: "#/projects", ms: ["briefcase", "#3E6FC0", "#1E3F82", "#BCD0F0", "#7D9EDA"] },
  { id: "mytasks", label: "My tasks", cat: "Projects", go: "#/projects?tab=tasks", ms: ["checkCircle", "#9061F9", "#5B2BC9", "#D8C7FD", "#AF8BFB"] },
  { id: "crm", label: "CRM pipeline", cat: "Sales", go: "#/crm", need: "crm" },
  { id: "leads", label: "Leads", cat: "Sales", go: "#/crm?tab=leads", need: "crm" },
  { id: "crmact", label: "Sales activities", cat: "Sales", go: "#/crm?tab=activities", need: "crm", ms: ["phone", "#2EA866", "#13713F", "#B8E8CB", "#6CCB94"] },
  { id: "approvals", label: "Approvals", cat: "Approvals", go: "#/inbox", ms: ["inbox", "#4C8BF5", "#1A56C4", "#BBD3FB", "#7AA7F2"] },
  { id: "requests", label: "My requests", cat: "Raise Request", go: "#/requests", ms: ["file", "#20B2A6", "#0B7A70", "#B5ECE6", "#64CFC4"] },
  { id: "reports", label: "Reports", cat: "Reports", go: "#/reports", need: "reports" },
  { id: "support", label: "Support desk", cat: "Helpdesk", go: "#/support", need: "support", ms: ["ticket", "#0EA5E9", "#0369A1", "#BAE6FD", "#7DD3FC"] },
  { id: "announce", label: "Announcements", cat: "Company", go: "#/announcements", ms: ["megaphone", "#FF8A3D", "#E2531F", "#FFD2B3", "#FFA66E"] },
  { id: "askkais", label: "Ask Kais", cat: "Company", act: "kais", ms: ["sparkles", "#F25A4F", "#C62828", "#FBC3BE", "#F0857C"] },
];
MORE_ACTIONS.forEach((a) => { if (a.ms && !MS_STYLE[a.id]) MS_STYLE[a.id] = a.ms; });
const ACTION_CATS = ["Attendance", "Leave Management", "Raise Request", "Timesheet", "Expense", "Payroll", "Projects", "Sales", "Approvals", "Reports", "Helpdesk", "Company"];
function allActions() {
  return [...QUICK_ACTIONS, ...MORE_ACTIONS].filter((a) => {
    if (a.need === "crm") return typeof can !== "function" || can("crm");
    if (a.need === "support") return typeof can !== "function" || can("support");
    if (a.need === "reports") return typeof RPT === "undefined" || Object.keys(RPT).some(rptAllowed);
    return true;
  });
}

route("actions", () => {
  const list = allActions(), onHome = new Set(S.quick);
  const groups = ACTION_CATS.map((c) => [c, list.filter((a) => a.cat === c)]).filter(([, g]) => g.length);
  return `<div class="screen">${topbar("All actions", { right: `<button class="ib" data-act="editQuick" aria-label="Choose actions for Home">${I("edit")}</button>` })}
    <div class="scroll"><div class="stack" style="padding-top:4px">
      <label class="searchbox">${I("search")}<input data-aq placeholder="Search ${list.length} actions" enterkeyhint="search" autocomplete="off"></label>
      ${groups.map(([c, g]) => `<section class="aa-sec" data-cat="${esc(c)}"><div class="sec"><h2>${esc(c)}</h2><span class="tiny muted">${g.length}</span></div>
        <div class="card aa-card"><div class="qa aa-grid">${g.map((a) => `<span class="aa-it${onHome.has(a.id) ? " on-home" : ""}" data-l="${esc(a.label.toLowerCase())} ${esc(c.toLowerCase())}">${quickTile(a)}</span>`).join("")}</div></div></section>`).join("")}
      <div class="aa-none" hidden>${emptyMini("search", "No actions match. Try another word.")}</div>
      <p class="tiny muted" style="text-align:center;margin:10px 0 2px">Dots mark the actions on your Home. Tap ${I("edit")} to change them.</p>
    </div></div></div>`;
}, {
  parent: "#/home",
  mount() {
    const inp = $("[data-aq]"); if (!inp) return;
    inp.addEventListener("input", () => {
      const q = inp.value.trim().toLowerCase(); let any = false;
      $$(".aa-sec").forEach((sec) => {
        let n = 0; sec.querySelectorAll(".aa-it").forEach((it) => { const show = !q || it.dataset.l.includes(q); it.hidden = !show; if (show) n++; });
        sec.hidden = !n; if (n) any = true;
      });
      $(".aa-none").hidden = any;
    });
  },
});
