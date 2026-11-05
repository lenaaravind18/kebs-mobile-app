// Notifications · Inbox approvals · Expenses · Settings (language, theme, security) · Feedback · Kais assistant

// Notifications live in views-notifs.js (Priority Inbox)

// ── Inbox (approvals) ──
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
      ${routine.length ? `<div class="card bulk stack" style="margin-bottom:12px"><div class="hrow"><span class="i" style="color:var(--accent)">${I("sparkles")}</span><b class="grow">Bulk approvals</b><span class="chip solid-ok">${routine.length} ready</span></div><span class="small muted">Kais AI has verified ${plural(routine.length, "routine request")} that match your approval patterns.</span><button class="btn primary sm" style="align-self:flex-start" data-act="ixBulk" data-ids="${routine.map((x) => x.id).join(",")}">Approve all</button></div>` : ""}
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
      ${x.flag ? `<div class="banner bad">${I("sparkles")}<span>Kais flagged: ${esc(x.flag)}</span></div>` : `<div class="banner ok">${I("checkCircle")}No policy issues found</div>`}
      <div class="field"><label for="ix-r">Comment <span class="opt">(required to reject)</span></label><textarea id="ix-r" class="inp" data-r style="min-height:70px" placeholder="Add a note for ${esc(person(x.who).name.split(" ")[0])}"></textarea></div></div>`,
    foot: `<div class="row-btns"><button class="btn danger" data-s="rej">Reject</button><button class="btn ok" data-s="ok">${I("check")}Approve</button></div>`,
    onMount(el) {
      onS(el, {
        ok() { closeSheet(s); ixDecide([x.id], "approved"); },
        rej() { const r = el.querySelector("[data-r]").value.trim(); if (!r) { el.querySelector("[data-r]").focus(); return toast("Add a reason to reject", "bad"); } closeSheet(s); ixDecide([x.id], "rejected", r); },
      });
    },
  });
});

// ── Expenses ──
const EXP_CATS = [["Food & Beverages", "utensils"], ["Travel", "plane"], ["Software", "grid"], ["Internet", "globe"], ["Local conveyance", "wallet"], ["Other", "receipt"]];
const catIcon = (c) => (EXP_CATS.find(([n]) => n === c) || EXP_CATS[5])[1];
route("expenses", (_, q) => {
  const tab = q.tab || "claims";
  let body;
  if (tab === "claims") {
    body = `<div class="stack">${S.expenses.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).map((e) => `<div class="card hrow"><span class="li" style="padding:0;border:0"><span class="ic tint t-amber">${I(catIcon(e.cat))}</span></span><span class="grow"><b style="display:block" class="ell">${esc(e.title)}</b><span class="tiny muted">${esc(e.cat)} · ${D.short(e.date)}${e.note ? ` · <span style="color:var(--danger)">${esc(e.note)}</span>` : ""}</span></span><span class="stack s6" style="align-items:flex-end"><b class="num">${money(e.amount)}</b>${statusChip(e.status)}</span></div>`).join("") || emptyState(["wallet", "receipt", "scan"], "No claims yet", "Scan a bill to start your first claim.")}</div>`;
  } else if (tab === "bills") {
    body = `<div class="stack">${S.bills.map((b) => `<div class="card hrow">${fileIcon(b.name)}<span class="grow"><b class="ell" style="display:block">${esc(b.name)}</b><span class="tiny muted">${b.amount ? money(b.amount) + " · " : ""}saved ${D.short(b.date)}</span></span><button class="btn primary sm" data-go="#/expenses/new?bill=${b.id}">Claim</button><button class="ib sm" data-act="billDel" data-id="${b.id}" aria-label="Delete bill">${I("trash")}</button></div>`).join("") || emptyState(["receipt", "scan", "wallet"], "No saved bills", "Bills you save for later appear here.")}</div>`;
  } else {
    const by = {}; S.expenses.filter((e) => e.status !== "rejected").forEach((e) => (by[e.cat] = (by[e.cat] || 0) + e.amount));
    const max = Math.max(1, ...Object.values(by)), total = Object.values(by).reduce((a, b) => a + b, 0);
    const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
    body = `<div class="card accent"><span class="eyebrow">Total claimed (last 30 days)</span><div class="timer" style="font-size:28px;margin-top:6px">${money(total)}</div>${top ? `<span class="small muted">Most spent on <b style="color:var(--ink)">${esc(top[0])}</b></span>` : ""}</div>
      <div class="sec"><h2>By category</h2></div>
      <div class="card"><div class="chart-bars">${Object.entries(by).map(([c, v]) => `<div class="col"><span class="tiny b num">${(v / 1000).toFixed(1)}k</span><i style="height:${(v / max) * 100}%"></i><small>${esc(c.split(" ")[0])}</small></div>`).join("") || `<p class="muted small">No spend yet.</p>`}</div></div>`;
  }
  return `<div class="screen has-foot">${topbar("Expenses")}${seg([["claims", "Claims"], ["bills", "Saved bills"], ["insights", "Insights"]], tab, "expTab")}<div class="scroll">${body}</div>
    <div class="foot"><button class="btn primary block" data-go="#/expenses/new?scan=1">${I("scan")}Scan bill / new claim</button></div></div>`;
});
act("expTab", (b) => swap(`#/expenses?tab=${b.dataset.v}`));
act("billDel", (b) => { S.bills = S.bills.filter((x) => x.id !== b.dataset.id); save(); rerender(); toast("Bill removed"); });
route("expenses/new", (_, q) => {
  const bill = S.bills.find((b) => b.id === q.bill);
  const F = draft("exp", { title: "", cat: "Food & Beverages", amount: bill?.amount ? String(bill.amount) : "", date: bill?.date || D.today(), file: bill ? { name: bill.name } : null, billId: bill?.id || null });
  return `<div class="screen has-foot">${topbar("New expense")}<div class="scroll"><div class="stack s16" style="padding-top:6px">
    ${F.file ? `<div class="attach">${fileIcon(F.file.name)}<span class="grow"><b class="ell" style="display:block">${esc(F.file.name)}</b><span class="tiny muted">${esc(F.file.size || "Saved bill")}</span></span><button class="ib sm" data-act="expFile" aria-label="Replace bill">${I("edit")}</button></div>`
      : `<button class="card" data-act="expFile" style="border-style:dashed;text-align:center;padding:28px 16px"><span class="i" style="width:34px;height:34px;color:var(--accent)">${I("scan")}</span><b style="display:block;margin-top:8px">Scan or upload bill</b><span class="small muted">Photo, PDF or image · up to 5 MB</span></button>`}
    <div class="field"><label for="ex-t">Title</label><input id="ex-t" class="inp" data-bind="title" value="${esc(F.title)}" placeholder="Ex: Client lunch – Zifo"></div>
    <div class="field"><span class="lbl">Category</span><div class="choices">${EXP_CATS.map(([c]) => `<button class="choice ${F.cat === c ? "on" : ""}" data-act="expCat" data-v="${c}">${c}</button>`).join("")}</div></div>
    <div class="grid2"><div class="field"><label for="ex-a">Amount (INR)</label><input id="ex-a" class="inp" type="number" min="1" inputmode="decimal" data-bind="amount" value="${esc(F.amount)}" placeholder="0"></div>
      <div class="field"><span class="lbl">Bill date</span><button class="inp sel" data-act="expDate"><span>${D.long(F.date)}</span>${I("calendar")}</button></div></div>
  </div></div>
  <div class="foot"><div class="row-btns"><button class="btn outline" data-act="expSaveBill">Save bill for later</button><button class="btn primary" data-act="expSubmit" data-cta>Submit claim</button></div></div></div>`;
}, { mount() { FORM_CHECK = () => { const b = $("[data-cta]"); if (b) b.disabled = !(DRAFT.title.trim() && Number(DRAFT.amount) > 0 && DRAFT.file); }; FORM_CHECK(); } });
act("expFile", () => pickFile("image/*,.pdf", (f) => { if (f.bytes > 5e6) return toast(`${f.name} is over 5 MB`, "bad"); DRAFT.file = { name: f.name, size: f.size }; if (!DRAFT.title) DRAFT.title = f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "); rerender(); toast("Bill attached"); }));
act("expCat", (b) => { DRAFT.cat = b.dataset.v; rerender(); });
act("expDate", () => pickDates({ title: "Bill date", mode: "single", start: DRAFT.date, onDone({ start }) { if (start > D.today()) return toast("Bill date can’t be in the future", "bad"); DRAFT.date = start; rerender(); } }));
act("expSaveBill", () => {
  const F = DRAFT; if (!F.file) return toast("Attach a bill first", "bad");
  if (!F.billId) S.bills.unshift({ id: uid(), name: F.file.name, amount: Number(F.amount) || 0, date: F.date });
  save(); DRAFT = null; toast("Bill saved for later"); swap("#/expenses?tab=bills");
});
act("expSubmit", (b) => {
  if (b.disabled) return;
  const F = DRAFT;
  S.expenses.unshift({ id: uid(), title: F.title.trim(), cat: F.cat, amount: Math.round(Number(F.amount)), date: F.date, status: "pending", bill: F.file.name });
  if (F.billId) S.bills = S.bills.filter((x) => x.id !== F.billId);
  save(); DRAFT = null; toast("Claim submitted for approval"); swap("#/expenses");
});

// ── Settings ──
const settingsPage = (title, body) => `<div class="screen">${topbar(title, { left: `<button class="ib" data-act="back" aria-label="Close">${I("x")}</button>` })}<div class="scroll">${body}</div></div>`;
route("settings/lang", () => settingsPage("Language selection", `<b style="display:block;margin:8px 4px 2px">Choose your language</b><p class="small muted" style="margin:0 4px 8px">Navigation and greetings switch right away.</p>
  <div class="list">${LANGS.map((l) => `<button class="opt-row" data-act="setLang" data-v="${l.id}"><span class="grow"><b style="display:block">${l.native}</b><span class="small faint">${l.name}</span></span>${S.settings.lang === l.id ? `<span class="tick">${I("check")}</span>` : ""}</button>`).join("")}</div>`));
act("setLang", (b) => { S.settings.lang = b.dataset.v; save(); rerender(); toast(`Language: ${LANGS.find((l) => l.id === b.dataset.v).name}`); });
route("settings/theme", () => settingsPage("Theme", `<b style="display:block;margin:8px 4px 8px">Choose how KEBS looks on this device</b>
  <div class="list">${[["auto", "Automatic", "Matches your device’s light or dark setting", "sparkles"], ["light", "Light mode", "Always light", "sun"], ["dark", "Dark mode", "Always dark", "moon"]].map(([v, t, s, ic]) => `<button class="opt-row" data-act="setTheme" data-v="${v}"><span class="ic tint t-slate" style="width:38px;height:38px;border-radius:12px;display:grid;place-items:center">${I(ic)}</span><span class="grow"><b style="display:block">${t}</b><span class="small faint">${s}</span></span>${S.settings.theme === v ? `<span class="tick">${I("check")}</span>` : ""}</button>`).join("")}</div>`));
act("setTheme", (b) => { S.settings.theme = b.dataset.v; save(); rerender(); });
route("settings/secure", () => {
  const on = S.settings.secure;
  return settingsPage("Secure your KEBS app", `<b style="display:block;margin:8px 4px 6px">Do you want to secure your KEBS app?</b>
    <p class="small muted" style="margin:0 4px">Enabling this asks for your device’s passcode, pattern, fingerprint or face recognition every time KEBS opens.</p>
    <div class="card hrow" style="margin-top:16px"><b class="grow">Enable device authentication</b><button class="switch" role="switch" aria-checked="${on}" aria-label="Enable device authentication" data-act="toggleSecure"></button></div>
    <div class="lock-art ${on ? "on" : ""}" style="margin-top:36px">${I(on ? "lock" : "unlock")}</div>
    <p class="small muted" style="text-align:center;max-width:300px;margin:0 auto">${on ? "KEBS is secured. You’ll unlock it with your device each time you open the app." : "Your KEBS app is not secured. Anyone with access to your phone can open it."}</p>`);
});
act("toggleSecure", () => {
  if (S.settings.secure) { S.settings.secure = false; save(); rerender(); return toast("Device authentication turned off", "info"); }
  const s = openSheet({ title: "Confirm it’s you", body: `<div class="empty" style="padding:16px"><div class="lock-art on scanning">${I("fingerprint")}</div><p>Touch the sensor to verify…</p></div>` });
  setTimeout(() => { closeSheet(s); S.settings.secure = true; unlocked = true; save(); rerender(); toast("KEBS is now secured"); }, 1100);
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

