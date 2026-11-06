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
    <div class="hrow"><span class="fc-ic">${I("sparkles")}</span><span class="grow"><b style="display:block">Kais flagged this request</b><span class="small">${esc(x.flag)}</span></span><span class="chip ${f.sev === "High" ? "bad" : f.sev === "Medium" ? "warn" : ""}">${f.sev}</span></div>
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
  const count = (k) => S.inbox.filter((x) => k === "all" || x.kind === k).length;
  let list = S.inbox.filter((x) => (tab === "all" || x.kind === tab) && (!qs || (person(x.who).name + " KEBS India " + (x.cat || x.proj || x.ltype)).toLowerCase().includes(qs)));
  list.sort(INBOX_SORT === "amount" ? (a, b) => (b.amount || b.hours * 1000 || b.days * 1e4) - (a.amount || a.hours * 1000 || a.days * 1e4) : (a, b) => (a.date < b.date ? 1 : -1));
  const routine = list.filter((x) => x.routine);
  return `<div class="screen">
    <div class="big-title"><h1>My inbox</h1><p>${S.inbox.length ? `${plural(S.inbox.length, "request")} waiting on you` : "Nothing waiting on you"}</p></div>
    ${seg([["all", `All (${count("all")})`], ["expense", `Expense (${count("expense")})`], ["timesheet", `Timesheet (${count("timesheet")})`], ["leave", `Leave (${count("leave")})`]], tab, "ixTab")}
    <div class="scroll">
      <div class="hrow" style="margin-bottom:12px"><label class="searchbox grow">${I("search")}<input data-ixq value="${esc(q.q || "")}" placeholder="Search name / cost center"></label><button class="ib" data-act="ixSort" aria-label="Sort">${I("filter")}${INBOX_SORT !== "date" ? `<span class="dot"></span>` : ""}</button></div>
      ${routine.length ? `<div class="card bulk stack" style="margin-bottom:12px"><div class="hrow"><span class="i" style="color:var(--accent)">${I("sparkles")}</span><b class="grow">Bulk approvals</b><span class="chip solid-ok">${routine.length} ready</span></div><span class="small muted">Kais Assistant has verified ${plural(routine.length, "routine request")} that match your approval patterns.</span><button class="btn primary sm" style="align-self:flex-start" data-act="ixBulk" data-ids="${routine.map((x) => x.id).join(",")}">Approve all</button></div>` : ""}
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
  S.inbox = S.inbox.filter((x) => !ids.includes(x.id)); save(); rerender();
  toast(`${plural(n, "request")} ${verdict}${reason ? "" : ""}`, verdict === "approved" ? "ok" : "info");
}
act("ixBulk", (b) => { const ids = b.dataset.ids.split(","); confirmSheet({ eyebrow: "Bulk approve", text: `Approve <b>${plural(ids.length, "routine request")}</b> verified by Kais?`, ok: "Approve all", onOk: () => ixDecide(ids, "approved") }); });
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
const THEME_COLORS = [["orange", "Orange", "#ff9a6b", "#ff4013"], ["blue", "Blue", "#60a5fa", "#2563eb"], ["navy", "Navy", "#4466d6", "#172a6e"], ["green", "Green", "#4ade80", "#16a34a"], ["purple", "Purple", "#a78bfa", "#7c4dff"],
  ["teal", "Teal", "#2dd4bf", "#0d9488"], ["rose", "Rose", "#fb7199", "#e11d58"], ["graphite", "Graphite", "#94a3b8", "#334155"]];
route("settings/theme", () => {
  const t = S.settings.theme, ac = S.settings.accent || "orange", st = S.settings.style || "classic";
  return settingsPage("Theme", `<div class="stack s16" style="padding-top:4px">
    <div class="th-prev" aria-hidden="true">
      <div class="th-prev-bar"><i></i>Good morning, ${esc(S.me.display.split(" ")[0])}</div>
      <div class="th-prev-row"><span class="th-prev-ring"></span><span class="grow"><b>31 days</b><small>Leave left this year</small></span><span class="chip acc">Preview</span></div>
      <div class="row-btns"><button class="btn primary" style="flex:1" tabindex="-1">Clock in</button><button class="btn outline" style="flex:1" tabindex="-1">Apply leave</button></div>
    </div>
    <div class="field"><span class="lbl">Appearance</span><div class="th-modes">${[["auto", "Automatic", "sparkles"], ["light", "Light", "sun"], ["dark", "Dark", "moon"]].map(([v, l, ic]) => `<button class="th-mode ${t === v ? "on" : ""}" data-act="setTheme" data-v="${v}" aria-pressed="${t === v}">${I(ic)}${l}</button>`).join("")}</div>
      <span class="tiny muted">${t === "auto" ? "Follows your phone’s light or dark setting." : t === "light" ? "Always light." : "Always dark — easier on the eyes at night."}</span></div>
    <div class="field"><span class="lbl">Colour</span><div class="th-swatches">${THEME_COLORS.map(([v, l, a, b]) => `<button class="th-sw ${ac === v ? "on" : ""}" data-act="setAccent" data-v="${v}" aria-pressed="${ac === v}" aria-label="${l}"><span class="th-dot" style="--a:${a};--b:${b}">${I("check")}</span>${l}</button>`).join("")}</div></div>
    <div class="field"><span class="lbl">Style</span><div class="th-styles">
      <button class="th-style ${st === "classic" ? "on" : ""}" data-act="setStyle" data-v="classic" aria-pressed="${st === "classic"}"><span class="th-mini classic"><i></i><i></i><i style="width:70%"></i></span><b>Classic</b><small>Soft gradients, depth and colour</small></button>
      <button class="th-style ${st === "minimal" ? "on" : ""}" data-act="setStyle" data-v="minimal" aria-pressed="${st === "minimal"}"><span class="th-mini minimal"><i></i><i></i><i style="width:70%"></i></span><b>Minimal</b><small>Flat and quiet — no gradients or shadows</small></button>
    </div></div>
    <div class="field"><span class="lbl">Corners</span><div class="th-styles">
      <button class="th-style ${(S.settings.corners || "round") === "round" ? "on" : ""}" data-act="setCorners" data-v="round" aria-pressed="${(S.settings.corners || "round") === "round"}"><span class="th-corner round"><i></i><i></i></span><b>Rounded</b><small>Soft, friendly curves</small></button>
      <button class="th-style ${S.settings.corners === "sharp" ? "on" : ""}" data-act="setCorners" data-v="sharp" aria-pressed="${S.settings.corners === "sharp"}"><span class="th-corner sharp"><i></i><i></i></span><b>Sharp</b><small>Crisp 6px edges, square header</small></button>
    </div></div>
    ${ac !== "orange" || st !== "classic" || S.settings.corners === "sharp" ? `<button class="link" style="align-self:center" data-act="themeReset">Reset to KEBS default</button>` : ""}
  </div>`);
});
act("setTheme", (b) => { S.settings.theme = b.dataset.v; save(); rerender(); });
act("setAccent", (b) => { S.settings.accent = b.dataset.v; save(); rerender(); toast(`${THEME_COLORS.find((c) => c[0] === b.dataset.v)[1]} theme on`); });
act("setStyle", (b) => { S.settings.style = b.dataset.v; save(); rerender(); });
act("setCorners", (b) => { S.settings.corners = b.dataset.v; save(); rerender(); });
act("themeReset", () => { S.settings.accent = "orange"; S.settings.style = "classic"; S.settings.corners = "round"; save(); rerender(); toast("Back to the KEBS default"); });
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

