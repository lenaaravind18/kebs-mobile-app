// Notifications · Inbox approvals · Expenses · Settings (language, theme, security) · Feedback · Kais assistant

// Notifications live in views-notifs.js (Priority Inbox)

// ── Inbox (approvals) ──
// Kais policy check: explains a flag — rule, checks with evidence, recommendation, policy reference
function flagDetails(x) {
  const p = person(x.who).name.split(" ")[0];
  if (x.kind === "expense" && /travel/i.test(x.flag)) return {
    sev: "High", rule: "Domestic travel must be booked through the KEBS travel desk, economy class, within ₹8,000 per trip.",
    checks: [["Booked via travel desk", false, "Booked directly with the airline"], ["Within trip limit", false, `${money(x.amount)} vs ${money(8000)} limit`], ["Receipt attached", true, "e-ticket + invoice"], ["Trip pre-approved", true, "Client visit, approved 2 Nov"]],
    rec: `Ask ${p} for the travel-desk quote, or approve up to ${money(8000)} and reject the difference.`, ref: "Travel & Expense Policy v3 · §4.2", partial: `Approve ${money(8000)}` };
  if (x.kind === "expense") return {
    sev: "Medium", rule: "Meals & entertainment above ₹5,000 need prior approval and an itemised GST bill.",
    checks: [["Within category limit", false, `${money(x.amount)} vs ${money(5000)} limit`], ["Itemised bill", true, "Bill uploaded"], ["GST number on bill", false, "Missing GSTIN"], ["Prior approval", false, "No pre-approval found"]],
    rec: `Request the GST bill from ${p}. If it’s a client meal, approve ${money(5000)} now and ask for pre-approval next time.`, ref: "Travel & Expense Policy v3 · §6.1", partial: `Approve ${money(5000)}` };
  if (x.kind === "timesheet" && /below/i.test(x.flag)) return {
    sev: "Low", rule: "Full-time staff log at least 40 billable/non-billable hours per week.",
    checks: [["Weekly minimum", false, `${x.hours}h vs 40h`], ["Leave or holiday in week", false, "None found"], ["All days submitted", true, "Mon–Fri"]],
    rec: `Likely a missed entry — ask ${p} to add the remaining ${40 - x.hours}h or note the reason.`, ref: "Timesheet Policy · §2.1" };
  if (x.kind === "timesheet") return {
    sev: "Medium", rule: "Weekly hours are capped at 48 without overtime approval; weekend work needs a reason.",
    checks: [["Weekly cap", false, `${x.hours}h vs 48h cap`], ["Overtime approved", false, "No OT request"], ["Weekend entries", false, "Sat 4h · Sun 4h"], ["Project code valid", true, x.proj]],
    rec: `Approve 48h and ask ${p} to raise an overtime request for the extra ${x.hours - 48}h.`, ref: "Timesheet Policy · §3.4", partial: "Approve 48h" };
  return {
    sev: "Medium", rule: "Leave during a planned team release needs manager sign-off and a handover.",
    checks: [["Balance available", true, "6 days left"], ["Overlaps release window", false, "Release on the same day"], ["Handover added", false, "No handover note"]],
    rec: `Approve if ${p} adds a handover, or suggest the next day instead.`, ref: "Leave Policy · §5.3" };
}
function flagCard(x) {
  const f = flagDetails(x), failed = f.checks.filter((c) => !c[1]).length;
  return `<div class="fc">
    <div class="hrow"><span class="fc-ic fc-kais"><img src="kais.svg" alt="" width="22" height="22"></span><span class="grow"><b style="display:block">Kais flagged this request</b><span class="small fc-why">${I("alert")}${esc(x.flag)}</span></span><span class="chip ${f.sev === "High" ? "bad" : f.sev === "Medium" ? "warn" : ""}">${f.sev}</span></div>
    <div class="fc-sum small">${failed} of ${f.checks.length} policy checks failed</div>
    <div class="fc-more" hidden>
      <div class="fc-sec"><span class="eyebrow">Policy rule</span><p class="small">${esc(f.rule)}</p></div>
      <div class="fc-sec"><span class="eyebrow">What Kais checked</span>${f.checks.map(([t, ok, ev]) => `<div class="fc-chk ${ok ? "ok" : "bad"}"><span class="fc-dot">${I(ok ? "check" : "x")}</span><span class="grow"><b class="small" style="display:block">${esc(t)}</b><span class="tiny muted">${esc(ev)}</span></span></div>`).join("")}</div>
      <div class="fc-sec fc-rec"><span class="eyebrow">Recommendation</span><p class="small">${esc(f.rec)}</p>${f.partial ? `<button class="btn ghost sm" data-s="partial">${esc(f.partial)}</button>` : ""}</div>
      <span class="tiny muted">${I("file")} ${esc(f.ref)}</span>
    </div>
    <button class="link fc-toggle" data-s="more" aria-expanded="false">View more ${I("chevD")}</button>
  </div>`;
}
let INBOX_SORT = "date";
function ixMain(x) {
  if (x.kind === "expense") return money(x.amount);
  if (x.kind === "timesheet") return `${x.hours} hrs`;
  return plural(x.days, "day");
}
function ixMeta(x) {
  const w = D.add(D.monday(D.today()), 7 * x.week);
  if (x.kind === "expense") return `<span class="hrow">${I(x.icon)}${esc(x.cat)}</span>`;
  if (x.kind === "timesheet") return `<span class="hrow">${I("history")}${D.range(w, D.add(w, 6))} · ${esc(x.proj)}</span>`;
  return `<span class="hrow">${I("calendar")}${D.short(D.add(D.today(), x.off))} · ${esc(x.ltype)}</span>`;
}
route("inbox", (_, q) => {
  const tab = q.tab || "all", qs = (q.q || "").toLowerCase();
  const count = (k) => inboxList().filter((x) => k === "all" || x.kind === k).length;
  let list = inboxList().filter((x) => (tab === "all" || x.kind === tab) && (!qs || (person(x.who).name + " KEBS India " + (x.cat || x.proj || x.ltype)).toLowerCase().includes(qs)));
  list.sort(INBOX_SORT === "amount" ? (a, b) => (b.amount || b.hours * 1000 || b.days * 1e4) - (a.amount || a.hours * 1000 || a.days * 1e4) : (a, b) => (a.date < b.date ? 1 : -1));
  const routine = list.filter((x) => x.routine);
  return `<div class="screen">
    <div class="big-title"><h1>My inbox</h1><p>${inboxList().length ? `${plural(inboxList().length, "request")} waiting on you` : "Nothing waiting on you"}</p></div>
    ${seg([["all", `All (${count("all")})`], ["expense", `Expense (${count("expense")})`], ["timesheet", `Timesheet (${count("timesheet")})`], ["leave", `Leave (${count("leave")})`]], tab, "ixTab")}
    <div class="scroll">
      <div class="hrow" style="margin-bottom:12px"><label class="searchbox grow">${I("search")}<input data-ixq value="${esc(q.q || "")}" placeholder="Search name / cost center"></label><button class="ib" data-act="ixSort" aria-label="Sort">${I("filter")}${INBOX_SORT !== "date" ? `<span class="dot"></span>` : ""}</button><button class="ib" data-go="#/inbox/history" aria-label="Approval history">${I("history")}</button></div>
      ${routine.length ? `<div class="card ix-bulk">
        <div class="ix-bh"><span class="ix-bk"><img src="kais.svg" alt="" width="24" height="24"></span><span class="grow" style="min-width:0"><b>${plural(routine.length, "request")} ready to approve</b><small>Verified by Kais · match your approval patterns</small></span></div>
        <div class="ix-bl">${routine.slice(0, 3).map((x) => `<div class="ix-br">${avatar(x.who, "sm")}<span class="grow ell"><b>${esc(person(x.who).name)}</b> · ${({ expense: "Expense", timesheet: "Timesheet", leave: "Leave" })[x.kind]}</span><b class="num">${ixMain(x)}</b></div>`).join("")}${routine.length > 3 ? `<small class="muted">and ${routine.length - 3} more</small>` : ""}</div>
        <div class="row-btns"><button class="btn outline" style="flex:1" data-act="ixBulk" data-ids="${routine.map((x) => x.id).join(",")}">Review</button><button class="btn primary" style="flex:1" data-act="ixBulk" data-all="1" data-ids="${routine.map((x) => x.id).join(",")}">${I("check")}Approve all</button></div>
      </div>` : ""}
      <div class="stack" data-lazy="6">${list.map((x) => `<button class="card ix stack s6" data-act="ixOpen" data-id="${x.id}">
        <div class="hrow">${avatar(x.who)}<span class="grow"><b style="display:block">${esc(person(x.who).name)}</b><span class="tiny muted hrow">${I("building")}KEBS India</span></span><b class="num">${ixMain(x)}</b></div>
        <div class="divider" style="margin:4px 0"></div>
        <div class="meta">${ixMeta(x)}<span class="hrow">${I("calendar")}${D.short(x.date)}</span></div>
        ${x.flag ? `<span class="flag">${I("sparkles")}${esc(x.flag)}</span>` : x.routine ? `<span class="flag" style="color:var(--ok)">${I("checkCircle")}Matches policy</span>` : ""}
      </button>`).join("") || emptyState(["inbox", "checkCircle", "sparkles"], "Inbox zero", qs ? `No requests match “${esc(q.q)}”.` : "You’ve cleared every approval. Nice.")}</div>
    </div></div>`;
}, {
  dock: "inbox",
  mount(_, q) {
    const inp = $("[data-ixq]");
    let t; inp?.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { swap(`#/inbox?tab=${q.tab || "all"}${inp.value ? `&q=${encodeURIComponent(inp.value)}` : ""}`); }, 300); });
    if (q.q && inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
  },
});
act("ixTab", (b) => swap(`#/inbox?tab=${b.dataset.v}`));
act("ixSort", () => pickOption({ title: "Sort by", value: INBOX_SORT, options: [{ v: "date", label: "Most recent" }, { v: "amount", label: "Highest value" }], onPick(v) { INBOX_SORT = v; rerender(); } }));
function ixDecide(ids, verdict, reason) {
  const n = ids.length;
  const done = S.inbox.filter((x) => ids.includes(x.id)), who = done.map((x) => x.who);
  ixHist().unshift(...done.map((x) => ({ ...x, verdict, reason: reason || "", at: Date.now() }))); S.ixHistory = S.ixHistory.slice(0, 200);
  S.inbox = S.inbox.filter((x) => !ids.includes(x.id)); save(); rerender();
  if (verdict !== "approved") return toast(`${plural(n, "request")} ${verdict}`, "info");
  const names = [...new Set(who)].map((id) => person(id).name.split(" ")[0]);
  successSheet({ title: n === 1 ? "Request approved" : `${n} requests approved`, sub: `${names.slice(0, 2).join(" and ")}${names.length > 2 ? ` and ${names.length - 2} more` : ""} will be notified.`, rows: [["Left in your inbox", plural(inboxList().length, "request")]], cta: inboxList().length ? "Back to inbox" : "Done" });
}
// bulk approve: see exactly which requests are included and untick any you want to look at yourself
const IX_KIND = { expense: "Expense", timesheet: "Timesheet", leave: "Leave" };
act("ixBulk", (b) => {
  const items = b.dataset.ids.split(",").map((id) => S.inbox.find((x) => x.id === id)).filter(Boolean), sel = new Set(items.map((x) => x.id));
  const s = openSheet({ title: "Bulk approve", cls: "ix-bsheet",
    body: `<p class="small muted" style="margin:-2px 0 12px">Kais checked these against policy and your past approvals. Untick any you want to review yourself.</p>
      <div class="ix-bsl">${items.map((x) => `<button type="button" class="ix-bsr on" data-s="tg" data-id="${x.id}" aria-pressed="true">${avatar(x.who, "sm")}<span class="grow" style="min-width:0"><b class="ell">${esc(person(x.who).name)}</b><small class="ell">${IX_KIND[x.kind]} · ${ixMeta(x).replace(/<[^>]+>/g, "").trim()}</small></span><b class="num">${ixMain(x)}</b><span class="ix-ck">${I("check")}</span></button>`).join("")}</div>`,
    foot: `<div class="row-btns"><button class="btn outline" style="flex:1" data-s="cancel">Cancel</button><button class="btn primary" style="flex:1.4" data-s="ok"></button></div>`,
    onMount(el) {
      const ok = el.querySelector('[data-s="ok"]'), sync = () => { ok.disabled = !sel.size; ok.textContent = sel.size ? `Approve ${sel.size}` : "Select requests"; };
      sync();
      onS(el, {
        tg(r) { const id = r.dataset.id, on = !sel.has(id); on ? sel.add(id) : sel.delete(id); r.classList.toggle("on", on); r.setAttribute("aria-pressed", String(on)); sync(); },
        cancel() { closeSheet(s); },
        ok() { if (!sel.size) return; closeSheet(s); ixDecide([...sel], "approved"); },
      });
    } });
});

// ── approval history: everything you approved or rejected ──
function ixHist() {
  if (!S.ixHistory) {
    const H = 3600e3, now = Date.now();
    S.ixHistory = [
      { id: "h1", kind: "expense", who: "pb", amount: 2450, cat: "Travel", icon: "plane", verdict: "approved", reason: "", at: now - 5 * H },
      { id: "h2", kind: "timesheet", who: "jr", hours: 40, week: -1, proj: "Zifo Analytics", verdict: "approved", reason: "", at: now - 26 * H },
      { id: "h3", kind: "leave", who: "vi", days: 2, off: 6, ltype: "Casual", verdict: "rejected", reason: "Overlaps the release week — can we move it by a few days?", at: now - 30 * H },
      { id: "h4", kind: "expense", who: "sl", amount: 6800, cat: "Food & Beverages", icon: "utensils", verdict: "approved", reason: "", at: now - 3 * 24 * H },
      { id: "h5", kind: "timesheet", who: "ww", hours: 62, week: -2, proj: "CKTKEBS", verdict: "rejected", reason: "62 hours is over the weekly cap. Please split overtime into the OT code.", at: now - 4 * 24 * H },
    ];
    save();
  }
  return S.ixHistory;
}
route("inbox/history", (_, q) => {
  const f = q.f || "all", all = ixHist(), list = all.filter((x) => f === "all" || x.verdict === f);
  let lastDay = "";
  const rows = list.map((x, i) => {
    const day = D.iso(x.at), head = day !== lastDay ? `<div class="ix-hday">${D.diff(day, D.today()) < 2 ? dayLabel(day) : D.nice(day)}</div>` : ""; lastDay = day;
    return `${head}<button class="card ix-hr" data-act="ixHistOpen" data-i="${all.indexOf(x)}">${avatar(x.who)}<span class="grow" style="min-width:0"><b class="ell">${esc(person(x.who).name)}</b><small class="ell">${IX_KIND[x.kind]} · ${ixMeta(x).replace(/<[^>]+>/g, "").trim()}</small>
      <span class="ix-hv ${x.verdict}">${I(x.verdict === "approved" ? "checkCircle" : "x")}${x.verdict === "approved" ? "Approved" : "Rejected"} · ${D.time(x.at)}</span>${x.reason ? `<em class="ell">“${esc(x.reason)}”</em>` : ""}</span><b class="num">${ixMain(x)}</b></button>`;
  }).join("");
  return `<div class="screen">${topbar("Approval history", { sub: `${all.filter((x) => x.verdict === "approved").length} approved · ${all.filter((x) => x.verdict === "rejected").length} rejected` })}
    <div class="scroll"><div class="stack" style="padding-top:4px">
      ${filterHead("Your decisions", "ixHistF", f, [["all", "All decisions", "list", all.length], ["approved", "Approved", "checkCircle", all.filter((x) => x.verdict === "approved").length], ["rejected", "Rejected", "x", all.filter((x) => x.verdict === "rejected").length]], "Show")}
      ${list.length ? `<div class="stack s8">${rows}</div>` : emptyState(["history"], "Nothing here yet", "Requests you approve or reject show up here so you can look back at them.")}
    </div></div></div>`;
}, { parent: "#/inbox" });
act("ixHistF", (b) => swap(`#/inbox/history${b.dataset.v === "all" ? "" : `?f=${b.dataset.v}`}`));
act("ixHistOpen", (b) => {
  const x = ixHist()[Number(b.dataset.i)]; if (!x) return;
  openSheet({ title: IX_KIND[x.kind] + (x.kind === "leave" ? " request" : x.kind === "expense" ? " claim" : ""),
    body: `<div class="stack"><div class="hrow">${avatar(x.who, "lg")}<span class="grow"><b style="display:block;font-size:17px">${esc(person(x.who).name)}</b><span class="small muted">${esc(person(x.who).role || "")} · KEBS India</span></span></div>
      <div class="card"><div class="kv"><span>${x.kind === "expense" ? "Amount" : x.kind === "timesheet" ? "Hours" : "Duration"}</span><span>${ixMain(x)}</span></div><div class="kv"><span>Details</span><span class="small">${ixMeta(x).replace(/<[^>]+>/g, "").trim()}</span></div>
        <div class="kv"><span>Decision</span><span class="ix-hv ${x.verdict}">${x.verdict === "approved" ? "Approved" : "Rejected"}</span></div><div class="kv"><span>Decided</span><span>${D.nice(D.iso(x.at))}, ${D.time(x.at)}</span></div></div>
      ${x.reason ? `<div class="card ix-hreason"><small class="muted">Your comment</small><p>${esc(x.reason)}</p></div>` : ""}</div>` });
});
act("ixOpen", (b) => {
  const x = S.inbox.find((i) => i.id === b.dataset.id); if (!x) return;
  const title = { expense: "Expense claim", timesheet: "Timesheet", leave: "Leave request" }[x.kind];
  const s = openSheet({
    title,
    body: `<div class="stack"><div class="hrow">${avatar(x.who, "lg")}<span class="grow"><b style="display:block;font-size:17px">${esc(person(x.who).name)}</b><span class="small muted">${esc(person(x.who).role)} · KEBS India</span></span></div>
      <div class="card"><div class="kv"><span>${x.kind === "expense" ? "Amount" : x.kind === "timesheet" ? "Hours" : "Duration"}</span><span>${ixMain(x)}</span></div><div class="kv"><span>Details</span><span class="small">${ixMeta(x).replace(/<span class="i[\s\S]*?<\/svg><\/span>/g, "")}</span></div><div class="kv"><span>Submitted</span><span>${D.long(x.date)}</span></div></div>
      ${x.flag ? flagCard(x) : `<div class="banner ok">${I("checkCircle")}No policy issues found</div>`}
      <div class="field"><label for="ix-r">Comment <span class="opt">(required to reject)</span></label><textarea id="ix-r" class="inp" data-r style="min-height:70px" placeholder="Add a note for ${esc(person(x.who).name.split(" ")[0])}"></textarea></div></div>`,
    foot: `<div class="row-btns"><button class="btn danger" data-s="rej">Reject</button><button class="btn ok" data-s="ok">${I("check")}Approve</button></div>`,
    onMount(el) {
      onS(el, {
        ok() { closeSheet(s); ixDecide([x.id], "approved"); },
        more(b) { const box = el.querySelector(".fc-more"); const open = box.hasAttribute("hidden"); box.toggleAttribute("hidden", !open); b.setAttribute("aria-expanded", open); b.innerHTML = (open ? "View less " : "View more ") + I(open ? "chevU" : "chevD"); },
        partial() { closeSheet(s); ixDecide([x.id], "approved"); toast("Approved within the policy limit", "info"); },
        rej() { const r = el.querySelector("[data-r]").value.trim(); if (!r) { el.querySelector("[data-r]").focus(); return toast("Add a reason to reject", "bad"); } closeSheet(s); ixDecide([x.id], "rejected", r); },
      });
    },
  });
});

// ── Settings ──
const settingsPage = (title, body) => `<div class="screen">${topbar(title, { left: `<button class="ib" data-act="back" aria-label="Close">${I("x")}</button>` })}<div class="scroll">${body}</div></div>`;
route("settings/lang", () => settingsPage("Language selection", `<b style="display:block;margin:8px 4px 2px">Choose your language</b><p class="small muted" style="margin:0 4px 8px">Navigation and greetings switch right away.</p>
  <div class="list">${LANGS.map((l) => `<button class="opt-row" data-act="setLang" data-v="${l.id}"><span class="grow"><b style="display:block">${l.native}</b><span class="small faint">${l.name}</span></span>${S.settings.lang === l.id ? `<span class="tick">${I("check")}</span>` : ""}</button>`).join("")}</div>`));
act("setLang", (b) => { S.settings.lang = b.dataset.v; save(); rerender(); toast(`Language: ${LANGS.find((l) => l.id === b.dataset.v).name}`); });
// colour themes = the support dashboard's side-nav themes (Default keeps the KEBS orange look)
const THEME_COLORS = [["orange","Default","linear-gradient(135deg, #ff9a6b, #ff4013)","#ff4013"],["cloud","Light grey","linear-gradient(160deg, #ffffff 0 45%, #dfe1e6 45% 100%)","#ff4013"],["midnight","Midnight","linear-gradient(160deg, #262626, #0a0a0a)","#ff4013"],["ocean","Ocean blue","linear-gradient(160deg, #172554, #1d4ed8 55%, #0ea5e9)","#2563eb"],["sunset","Sunset orange","linear-gradient(160deg, #ff9466, #f4683a 50%, #dc4f24)","#ec5f2e"],["royal","Royal purple","linear-gradient(160deg, #2e1065, #7c3aed 55%, #c026d3)","#7c3aed"],["aurora","Aurora","linear-gradient(160deg, #1e40af, #7c3aed 50%, #db2777)","#7c3aed"],["forest","Forest green","linear-gradient(160deg, #022c22, #059669 55%, #34d399)","#059669"],["lagoon","Teal lagoon","linear-gradient(160deg, #042f2e, #0d9488 55%, #2dd4bf)","#0d9488"],["berry","Berry pink","linear-gradient(160deg, #500724, #db2777 55%, #f472b6)","#db2777"],["sunshine","Sunshine yellow","linear-gradient(160deg, #f59e0b, #facc15 55%, #fde68a)","#d97706"]];
// colours from before the dashboard themes map to their closest theme
const ACCENT_MOVED = { blue: "ocean", navy: "ocean", green: "forest", purple: "royal", teal: "lagoon", rose: "berry", graphite: "midnight" };
route("settings/theme", () => {
  const t = S.settings.theme, ac = S.settings.accent || "orange", cur = THEME_COLORS.find((c) => c[0] === ac);
  return settingsPage("Theme", `<div class="stack s16 th-min" style="padding-top:4px">
    <div class="field"><span class="lbl">Appearance</span>
      ${seg([["auto", "Automatic"], ["light", "Light"], ["dark", "Dark"]], t, "setTheme")}
      <span class="tiny muted">${t === "auto" ? "Follows your phone’s light or dark setting." : t === "light" ? "Always light." : "Always dark, easier on the eyes at night."}</span></div>
    <div class="field"><span class="lbl">Colour<span class="th-cur">${esc(cur ? cur[1] : "")}</span></span>
      <div class="th-dots">${THEME_COLORS.map(([v, l, a]) => `<button class="th-d ${ac === v ? "on" : ""}" data-act="setAccent" data-v="${v}" aria-pressed="${ac === v}" aria-label="${l}" title="${l}" style="--c:${a}"></button>`).join("")}</div></div>
    ${ac !== "orange" ? `<button class="link" style="align-self:flex-start" data-act="themeReset">Reset to KEBS orange</button>` : ""}
  </div>`);
});
// Style and Corners are gone from Theme: everyone gets the default look
if (S.settings.style || S.settings.corners) { delete S.settings.style; delete S.settings.corners; save(); }
act("setTheme", (b) => { S.settings.theme = b.dataset.v; S.settings.themeSet = true; save(); rerender(); });
act("setAccent", (b) => { S.settings.accent = b.dataset.v; save(); rerender(); });
act("setStyle", (b) => { S.settings.style = b.dataset.v; save(); rerender(); });
act("setCorners", (b) => { S.settings.corners = b.dataset.v; save(); rerender(); });
act("themeReset", () => { S.settings.accent = "orange"; save(); rerender(); });
// Device-lock illustration in the Design System's illustration style: dashed blue-grey rings,
// soft grey objects, one coral gradient accent (#FF8960 → #FF62A5), tiny sparkles
function secureArt(on) {
  const shackle = on
    ? '<path d="M104 92V78a16 16 0 0 1 32 0v14" fill="none" stroke="url(#saG)" stroke-width="7" stroke-linecap="round"/>'
    : '<path d="M104 92V78a16 16 0 0 1 31.2-5" fill="none" stroke="url(#saG)" stroke-width="7" stroke-linecap="round" class="sa-shackle"/>';
  return `<figure class="sec-art ${on ? "on" : ""}" aria-hidden="true"><svg viewBox="0 0 240 200">
    <defs><linearGradient id="saG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8960"/><stop offset="1" stop-color="#FF62A5"/></linearGradient></defs>
    <circle cx="120" cy="104" r="92" fill="none" stroke="var(--ill-ring)" stroke-width="2" stroke-dasharray="6 7"/>
    <circle cx="120" cy="104" r="68" fill="none" stroke="var(--ill-ring)" stroke-width="2" stroke-dasharray="6 7"/>
    <circle cx="120" cy="104" r="48" fill="var(--ill-disc)"/>
    <path d="M24 118h-6M21 110l-3 4M216 62l5-2M214 54l4 3" stroke="var(--ill-mark)" stroke-width="3" stroke-linecap="round"/>
    <circle cx="44" cy="58" r="3" fill="var(--ill-mark)"/><circle cx="208" cy="150" r="3.5" fill="none" stroke="var(--ill-mark)" stroke-width="2"/>
    <path d="M196 92l2 4.6 4.6 2-4.6 2-2 4.6-2-4.6-4.6-2 4.6-2z" fill="url(#saG)" class="sa-twinkle"/>
    <g class="sa-phone">
      <rect x="146" y="106" width="44" height="74" rx="9" fill="var(--ill-obj)"/>
      <rect x="150" y="113" width="36" height="58" rx="5" fill="var(--ill-paper)"/>
      <circle cx="168" cy="132" r="8" fill="none" stroke="var(--ill-mark)" stroke-width="2.4"/>
      <path d="M163.5 137.5a6.4 6.4 0 0 1 9 0" fill="none" stroke="var(--ill-mark)" stroke-width="2" stroke-linecap="round"/>
      ${[0, 1, 2, 3].map((i) => `<circle cx="${158 + i * 6.8}" cy="152" r="2.2" fill="${on ? "url(#saG)" : "var(--ill-mark)"}"/>`).join("")}
      <rect x="158" y="160" width="20" height="3.5" rx="1.75" fill="var(--ill-obj)"/>
    </g>
    <g class="sa-chip"><rect x="40" y="128" width="46" height="34" rx="10" fill="var(--ill-paper)" stroke="var(--ill-obj)" stroke-width="2"/>
      <path d="M52 152c0-5.4 1.8-9 9-9s9 3.6 9 9M56 152c0-3.6 1-5.4 5-5.4s5 1.8 5 5.4M49 145.5c2.6-4.3 6.4-6.3 12-6.3s9.4 2 12 6.3" fill="none" stroke="url(#saG)" stroke-width="2" stroke-linecap="round"/></g>
    <g class="sa-shield">
      ${shackle}
      <rect x="92" y="90" width="56" height="46" rx="12" fill="var(--ill-paper)" stroke="var(--ill-obj)" stroke-width="2.5"/>
      <rect x="98" y="96" width="44" height="34" rx="8" fill="url(#saG)"/>
      <circle cx="120" cy="109" r="5" fill="#fff"/><rect x="117.6" y="111" width="4.8" height="10" rx="2.4" fill="#fff"/>
    </g>
    <g class="sa-badge"><circle cx="146" cy="88" r="12" fill="var(--ill-paper)"/>
      ${on ? '<circle cx="146" cy="88" r="9.5" fill="#22a06b"/><path d="M141.5 88l3 3 6-6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'
            : '<circle cx="146" cy="88" r="9.5" fill="#f5a524"/><path d="M146 83v6M146 93v.2" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>'}</g>
  </svg></figure>`;
}
route("settings/secure", () => {
  const on = S.settings.secure;
  return settingsPage("Secure your KEBS app", `<b style="display:block;margin:8px 4px 6px">Do you want to secure your KEBS app?</b>
    <p class="small muted" style="margin:0 4px">Enabling this asks for your device’s passcode, pattern, fingerprint or face recognition every time KEBS opens.</p>
    <div class="card hrow" style="margin-top:16px"><b class="grow">Enable device authentication</b><button class="switch" role="switch" aria-checked="${on}" aria-label="Enable device authentication" data-act="toggleSecure"></button></div>
    ${secureArt(on)}
    <p class="small muted" style="text-align:center;max-width:300px;margin:0 auto">${on ? "KEBS is secured. You’ll unlock it with your device each time you open the app." : "Your KEBS app is not secured. Anyone with access to your phone can open it."}</p>`);
});
act("toggleSecure", () => {
  // both turning the lock on and turning it off need a real fingerprint / screen-lock check
  const off = S.settings.secure;
  const s = openSheet({ title: "Confirm it’s you", body: `<div class="empty" style="padding:16px"><div class="lock-art on scanning">${I("fingerprint")}</div><p data-amsg>Use your fingerprint or screen lock…</p></div>` });
  (off ? DeviceAuth.verify() : DeviceAuth.enroll()).then((r) => {
    if (!r.ok) {
      const m = s.el.querySelector("[data-amsg]"), art = s.el.querySelector(".lock-art");
      art?.classList.remove("scanning"); art?.classList.add("err");
      if (m) m.textContent = r.error === "cancelled" ? "Cancelled. Nothing was changed." : DeviceAuth.message(r.error);
      return;
    }
    closeSheet(s);
    if (off) { S.settings.secure = false; delete S.settings.secureCred; save(); rerender(); return toast("Device authentication turned off", "info"); }
    S.settings.secure = true; unlocked = true; save(); rerender(); toast("KEBS is now secured");
  });
});
route("feedback", () => {
  const F = draft("fb", { type: "", text: "" });
  return `<div class="screen has-foot">${topbar("Help us improve!", { left: `<button class="ib" data-act="back" aria-label="Close">${I("x")}</button>` })}
    <div class="scroll"><div class="stack s16" style="padding-top:6px"><div class="banner info">${I("msg")}Help us improve! Share your feedback on our app.</div>
    <div class="field"><span class="lbl">What type of feedback would you like to share?</span><button class="inp sel ${F.type ? "" : "ph"}" data-act="fbType"><span>${esc(F.type || "Choose the type")}</span>${I("chevD")}</button></div>
    <div class="field"><label for="fb-t">Write your feedback</label><textarea id="fb-t" class="inp" data-bind="text" style="min-height:140px" placeholder="Ex: Dark mode can be introduced!">${esc(F.text)}</textarea></div></div></div>
    <div class="foot"><button class="btn primary block" data-act="fbSend" data-cta>Submit</button></div></div>`;
}, { mount() { FORM_CHECK = () => { const b = $("[data-cta]"); if (b) b.disabled = !(DRAFT.type && DRAFT.text.trim().length > 3); }; FORM_CHECK(); } });
act("fbType", () => pickOption({ title: "Choose the type", value: DRAFT.type, options: ["Login issues", "Loading issues", "Missing features", "Stability", "Discoverability", "Others"].map((v) => ({ v, label: v })), onPick(v) { DRAFT.type = v; rerender(); } }));
act("fbSend", (b) => { if (b.disabled) return; S.feedback.push({ type: DRAFT.type, text: DRAFT.text.trim(), ts: Date.now() }); save(); DRAFT = null; toast("Thanks — feedback sent!"); ACTIONS.back(); });

