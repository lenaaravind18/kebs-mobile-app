// Expense claims: My expenses · upload receipts (single / multi claim) · Kais receipt parsing · claim group ·
// edit claim details · split by cost centre or category · submitted claim detail · filters
// Data: S.receipts (bills, parsed by Kais) and S.claims (a claim groups receipt ids). Amounts are stored in INR;
// each receipt keeps its original currency + amount for display.

const CUR = { INR: 1, USD: 86.42, EUR: 93.1, GBP: 110.6, AED: 23.53, SGD: 66.4 };
const CUR_SYM = { INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "AED ", SGD: "S$" };
const fmtCur = (inr, cur = "INR") => {
  const v = inr / (CUR[cur] || 1);
  return (CUR_SYM[cur] || cur + " ") + v.toLocaleString(cur === "INR" ? "en-IN" : "en-US", { minimumFractionDigits: cur === "INR" ? 0 : 2, maximumFractionDigits: 2 });
};
const EXP_CATS = [
  { id: "Travel", icon: "plane", tint: "t-violet", limit: 25000 },
  { id: "Food & Beverages", icon: "utensils", tint: "t-amber", limit: 2000 },
  { id: "Accommodation", icon: "building", tint: "t-blue", limit: 12000 },
  { id: "Local conveyance", icon: "wallet", tint: "t-teal", limit: 1500 },
  { id: "Internet", icon: "globe", tint: "t-green", limit: 1500 },
  { id: "Software", icon: "grid", tint: "t-pink", limit: 5000 },
  { id: "Other", icon: "receipt", tint: "t-slate", limit: 5000 },
];
const expCat = (c) => EXP_CATS.find((x) => x.id === c) || EXP_CATS[EXP_CATS.length - 1];
const catIcon = (c) => expCat(c).icon;
const COST_CENTRES = [
  { id: "CKTKEBS25-IMP", name: "KEBS – Implementation" }, { id: "CKTKEBS25-PRJ", name: "KEBS – Projects" },
  { id: "CKTKEBS25-DSG", name: "KEBS – Design" }, { id: "CKTZIFO-INT", name: "Zifo – Internal travel" },
];
const ccName = (id) => COST_CENTRES.find((c) => c.id === id)?.name || "Not set";
const ENTITIES = ["Prima Technologies Pvt Ltd", "KEBS India Pvt Ltd", "NextGen Corp"];
const APPROVERS = [{ v: "pr", label: "Reporting manager" }, { v: "treasury", label: "Treasury" }, { v: "finance", label: "Finance team" }];
const approverName = (v) => (v === "pr" ? person("pr").name : APPROVERS.find((a) => a.v === v)?.label || "Not set");
const PAY_MODES = ["Corporate card", "Personal card", "UPI", "Cash"];

// ── data ──
const rcpt = (id) => S.receipts.find((r) => r.id === id);
const claimOf = (id) => S.claims.find((c) => c.id === id);
const claimReceipts = (c) => c.receipts.map(rcpt).filter(Boolean);
const claimTotal = (c) => claimReceipts(c).reduce((a, r) => a + r.inr, 0);
const overLimit = (r) => r.inr > expCat(r.cat).limit;
const claimTitle = (c) => c.name || claimReceipts(c)[0]?.merchant || "Untitled claim";
const claimDate = (c) => c.submitted ? D.iso(c.submitted) : (claimReceipts(c)[0]?.date || D.today());
const nextCode = () => "CL-" + (12320 + S.claims.length + Math.floor(Math.random() * 9));
// compatibility for Kais and the Apps page: one row per submitted/saved claim
function expList() {
  return S.claims.map((c) => {
    const rs = claimReceipts(c), by = {};
    rs.forEach((r) => (by[r.cat] = (by[r.cat] || 0) + r.inr));
    const cat = Object.entries(by).sort((a, b) => b[1] - a[1])[0]?.[0] || "Other";
    return { id: c.id, title: claimTitle(c), amount: claimTotal(c), status: c.status === "saved" ? "draft" : c.status, date: claimDate(c), cat };
  });
}

function seedClaims() {
  const today = D.today();
  const R = (o) => ({ id: uid(), rid: "RC" + Math.floor(1e7 + Math.random() * 9e7), cur: "INR", pay: "Corporate card", paidBy: "Me", project: "p4", taxPct: 5, desc: "", people: [], file: { name: "receipt.jpg" }, claim: null, ...o, inr: Math.round((o.amt || 0) * (CUR[o.cur || "INR"] || 1)) });
  const old = S.expenses || [], bills = S.bills || [];
  const receipts = [], claims = [];
  old.forEach((e, i) => {
    const r = R({ merchant: e.title, cat: e.cat === "Internet" ? "Internet" : EXP_CATS.some((c) => c.id === e.cat) ? e.cat : "Other", amt: e.amount, date: e.date, file: { name: e.bill || "receipt.jpg" } });
    const c = { id: uid(), code: "CL-" + (12301 + i), name: e.title, status: e.status, cc: "CKTKEBS25-IMP", approver: "pr", entity: ENTITIES[0], billing: "Billable", desc: e.title, cur: "INR", receipts: [r.id], created: Date.parse(e.date), submitted: Date.parse(e.date) + 36e5, paid: e.status === "approved" ? e.amount : 0, note: e.note || "" };
    r.claim = c.id; receipts.push(r); claims.push(c);
  });
  // a saved (not yet submitted) multi-receipt trip, as in the Figma claim group
  const trip = [
    R({ merchant: "IndiGo MAA – DEL", cat: "Travel", cur: "USD", amt: 88.68, date: D.add(today, -2), file: { name: "indigo_maa_del.pdf" }, desc: "Flight to Delhi for client workshop" }),
    R({ merchant: "Starbucks", cat: "Food & Beverages", cur: "USD", amt: 31.4, date: D.add(today, -2), file: { name: "starbucks.jpg" }, taxPct: 12 }),
    R({ merchant: "Hotel stay @ ITC", cat: "Accommodation", amt: 9800, date: D.add(today, -1), file: { name: "itc_folio.pdf" }, taxPct: 18 }),
    R({ merchant: "IndiGo DEL – MAA", cat: "Travel", cur: "USD", amt: 95.68, date: D.add(today, -1), file: { name: "indigo_del_maa.pdf" } }),
  ];
  const tc = { id: uid(), code: "CL-12321", name: "Trip to Delhi", status: "saved", cc: "CKTKEBS25-IMP", approver: "treasury", entity: ENTITIES[1], billing: "Billable", desc: "Client workshop in Delhi", cur: "USD", receipts: trip.map((r) => r.id), created: Date.now() - 864e5, submitted: null, paid: 0, note: "" };
  trip.forEach((r) => { r.claim = tc.id; receipts.push(r); });
  claims.unshift(tc);
  bills.forEach((b) => receipts.push(R({ merchant: b.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "), cat: /hotel/i.test(b.name) ? "Accommodation" : /parking/i.test(b.name) ? "Local conveyance" : "Other", amt: b.amount || 0, date: b.date, file: { name: b.name } })));
  return { receipts, claims };
}
if (!S.claims) { const x = seedClaims(); S.receipts = x.receipts; S.claims = x.claims; delete S.expenses; delete S.bills; save(); }

// ── Kais receipt "extraction" (demo): plausible values from the file name ──
const MERCHANTS = [
  ["Uber", "Local conveyance", 180, 900], ["Starbucks", "Food & Beverages", 350, 1400], ["IndiGo", "Travel", 4200, 11800], ["Taj Hotels", "Accommodation", 6500, 14000],
  ["ACT Fibernet", "Internet", 799, 1499], ["Figma", "Software", 1100, 1300], ["McDonald’s", "Food & Beverages", 220, 780], ["Ola", "Local conveyance", 150, 700],
];
function kaisExtract(file) {
  const n = file.name.toLowerCase();
  let m = MERCHANTS.find(([name]) => n.includes(name.toLowerCase().split(/[\s’']/)[0]));
  if (!m) { let h = 0; for (const ch of n) h = (h * 31 + ch.charCodeAt(0)) >>> 0; m = MERCHANTS[h % MERCHANTS.length]; }
  const [merchant, cat, lo, hi] = m;
  const amt = Math.round(lo + Math.random() * (hi - lo));
  return { id: uid(), rid: "RC" + Math.floor(1e7 + Math.random() * 9e7), merchant, cat, cur: "INR", amt, inr: amt, date: D.add(D.today(), -Math.floor(Math.random() * 6)),
    pay: "Corporate card", paidBy: "Me", project: "p4", taxPct: cat === "Food & Beverages" ? 5 : 18, desc: "", people: [], file, claim: null };
}
// small JPEG thumbnail so the receipt can be shown later without storing the full photo
function thumbOf(f) {
  return new Promise((res) => {
    if (!/^image\//.test(f.type)) return res(null);
    const url = URL.createObjectURL(f), img = new Image();
    img.onload = () => { const k = Math.min(1, 320 / Math.max(img.width, img.height)), c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); try { res(c.toDataURL("image/jpeg", 0.72)); } catch { res(null); } };
    img.onerror = () => { URL.revokeObjectURL(url); res(null); };
    img.src = url;
  });
}
function pickReceipts({ multiple = true, capture = false, onFiles }) {
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = "image/*,.pdf"; inp.multiple = multiple;
  if (capture) inp.setAttribute("capture", "environment");
  inp.onchange = async () => {
    const files = [...inp.files].filter((f) => { if (f.size > 25e6) { toast(`${f.name} is over 25 MB`, "bad"); return false; } return true; });
    if (!files.length) return;
    onFiles(await Promise.all(files.map(async (f) => ({ name: f.name, size: fmtSize(f.size), img: await thumbOf(f) }))));
  };
  inp.click();
}
const rcThumb = (r, cls = "") => r.file?.img ? `<span class="rc-thumb ${cls}" style="background-image:url(${r.file.img})" role="img" aria-label="${esc(r.file.name)}"></span>` : `<span class="rc-thumb doc ${cls}">${fileIcon(r.file?.name || "receipt.pdf")}</span>`;

// ── My expenses ──
let XF = { status: [], cats: [], cc: [], min: "", max: "", month: "" }; // filters (session only)
const xfCount = () => XF.status.length + XF.cats.length + XF.cc.length + (XF.min || XF.max ? 1 : 0) + (XF.month ? 1 : 0);
function dayLabel(iso) { const d = D.diff(iso, D.today()); return d === 0 ? "Today" : d === 1 ? "Yesterday" : D.long(iso); }
function claimCard(c) {
  const rs = claimReceipts(c), first = rs[0];
  return `<button class="card xc" data-go="#/expenses/claim/${c.id}">
    <span class="hrow"><span class="grow ell xc-t">${esc(claimTitle(c))}</span><b class="num">${fmtCur(claimTotal(c), c.cur)}</b></span>
    <span class="xc-m">${c.status === "saved" ? `<span class="chip">Saved</span>` : statusChip(c.status)}<span>${esc(c.code)}</span><span class="dotsep"></span><span class="ell">${esc(c.entity)}</span></span>
    <span class="xc-f">${first ? rcThumb(first, "xs") : ""}<span class="tiny muted grow ell">${plural(rs.length, "receipt")} · ${esc(ccName(c.cc))}</span>${I("chevR")}</span>
  </button>`;
}
route("expenses", (_, q) => {
  const tab = q.tab === "bills" ? "saved" : q.tab || "claims";
  const st = q.st || "all", qq = (q.q || "").toLowerCase();
  const yet = S.claims.filter((c) => c.status === "pending" || (c.status === "approved" && c.paid < claimTotal(c))).reduce((a, c) => a + claimTotal(c) - (c.paid || 0), 0);
  const nPending = S.claims.filter((c) => c.status === "pending").length;
  let body = "";
  if (tab === "claims") {
    let list = S.claims.filter((c) => c.status !== "saved");
    if (st !== "all") list = list.filter((c) => c.status === st);
    if (qq) list = list.filter((c) => [claimTitle(c), c.code, c.entity, c.desc, ...claimReceipts(c).map((r) => r.merchant)].join(" ").toLowerCase().includes(qq));
    if (XF.status.length) list = list.filter((c) => XF.status.includes(c.status));
    if (XF.cats.length) list = list.filter((c) => claimReceipts(c).some((r) => XF.cats.includes(r.cat)));
    if (XF.cc.length) list = list.filter((c) => XF.cc.includes(c.cc));
    if (XF.min) list = list.filter((c) => claimTotal(c) >= Number(XF.min));
    if (XF.max) list = list.filter((c) => claimTotal(c) <= Number(XF.max));
    if (XF.month) list = list.filter((c) => claimDate(c).startsWith(XF.month));
    list.sort((a, b) => (claimDate(a) < claimDate(b) ? 1 : -1));
    const groups = []; list.forEach((c) => { const k = claimDate(c); const g = groups.find((x) => x.k === k); g ? g.items.push(c) : groups.push({ k, items: [c] }); });
    body = `<div class="xc-hero card accent"><span class="eyebrow">Yet to receive</span><b class="timer">${money(yet)}</b><span class="small muted">${nPending ? `${plural(nPending, "claim")} waiting for approval` : "Nothing waiting for approval"}</span></div>
      <div class="hrow" style="margin-top:12px"><label class="searchbox grow">${I("search")}<input data-xq placeholder="Search claims" value="${esc(q.q || "")}" enterkeyhint="search"></label><button class="ib" data-act="xFilter" aria-label="Filters">${I("filter")}${xfCount() ? `<span class="dot"></span>` : ""}</button></div>
      <div class="xs-tabs" role="tablist">${[["all", "All"], ["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"], ["withdrawn", "Withdrawn"]].map(([v, l]) => `<button role="tab" class="${st === v ? "on" : ""}" aria-selected="${st === v}" data-act="xSt" data-v="${v}">${l}</button>`).join("")}</div>
      ${xfCount() ? `<div class="hrow small muted" style="margin:2px 4px 0">${plural(xfCount(), "filter")} applied<span class="grow"></span><button class="link" data-act="xClear">Clear</button></div>` : ""}
      ${groups.length ? groups.map((g) => `<div class="sec"><h2>${dayLabel(g.k)} <span class="muted" style="font-weight:600">(${g.items.length})</span></h2></div><div class="stack">${g.items.map(claimCard).join("")}</div>`).join("")
        : emptyState(["wallet", "receipt", "scan"], qq || xfCount() || st !== "all" ? "No claims match" : "No claims yet", qq || xfCount() || st !== "all" ? "Try a different search or filter." : "Upload a receipt to start your first claim.")}`;
  } else if (tab === "saved") {
    const drafts = S.claims.filter((c) => c.status === "saved");
    const loose = S.receipts.filter((r) => !r.claim);
    body = `<div class="sec" style="margin-top:4px"><h2>Saved claims</h2><span class="tiny muted">Not submitted yet</span></div>
      <div class="stack">${drafts.map(claimCard).join("") || emptyMini("wallet", "No saved claims.")}</div>
      <div class="sec"><h2>Saved receipts</h2>${loose.length > 1 ? `<button class="link" data-act="xClaimAll">Claim all</button>` : ""}</div>
      <div class="stack">${loose.map((r) => `<div class="card hrow">${rcThumb(r)}<span class="grow" style="min-width:0"><b class="ell" style="display:block">${esc(r.merchant)}</b><span class="tiny muted">${fmtCur(r.inr)} · ${D.short(r.date)} · ${esc(r.cat)}</span></span><button class="btn primary sm" data-act="xClaimOne" data-id="${r.id}">Claim</button><button class="ib sm" data-act="xRcDel" data-id="${r.id}" aria-label="Delete receipt">${I("trash")}</button></div>`).join("") || emptyMini("receipt", "Receipts you save for later appear here.")}</div>`;
  } else {
    const by = {}; S.claims.filter((c) => c.status !== "rejected" && c.status !== "withdrawn").forEach((c) => claimReceipts(c).forEach((r) => (by[r.cat] = (by[r.cat] || 0) + r.inr)));
    const total = Object.values(by).reduce((a, b) => a + b, 0), top = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
    body = `<div class="card accent"><span class="eyebrow">Total claimed</span><div class="timer" style="font-size:28px;margin-top:6px">${money(total)}</div>${top ? `<span class="small muted">Most spent on <b style="color:var(--ink)">${esc(top[0])}</b></span>` : ""}</div>
      <div class="sec"><h2>By category</h2></div>
      <div class="card ch-card">${Object.keys(by).length ? capsuleBars({ values: Object.values(by), labels: Object.keys(by).map((c) => c.split(" ")[0]), active: Object.values(by).indexOf(Math.max(...Object.values(by))), fmt: (v) => money(Math.round(v)), height: 132 }) : `<p class="muted small">No spend yet.</p>`}</div>`;
  }
  return `<div class="screen has-foot">${topbar("My expenses")}${seg([["claims", "Claims"], ["saved", "Saved"], ["insights", "Insights"]], tab, "expTab")}<div class="scroll">${body}</div>
    <div class="foot"><button class="btn primary block" data-act="xNew">${I("plus")}New claim</button></div></div>`;
}, {
  mount(_, q) {
    const inp = $("[data-xq]"); let t;
    inp?.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => swap(`#/expenses?st=${q.st || "all"}${inp.value ? `&q=${encodeURIComponent(inp.value)}` : ""}`), 300); });
    if (q.q && inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); } // keep typing after the list refreshes
  },
});
act("expTab", (b) => swap(`#/expenses?tab=${b.dataset.v}`));
act("xSt", (b) => { const q = parseHash().q; swap(`#/expenses?st=${b.dataset.v}${q.q ? `&q=${encodeURIComponent(q.q)}` : ""}`); });
act("xClear", () => { XF = { status: [], cats: [], cc: [], min: "", max: "", month: "" }; rerender(); });
act("xRcDel", (b) => confirmSheet({ eyebrow: "Delete receipt", text: "Delete this saved receipt?", ok: "Delete", danger: true, onOk() { S.receipts = S.receipts.filter((r) => r.id !== b.dataset.id); save(); rerender(); toast("Receipt deleted"); } }));
act("xClaimOne", (b) => { RV = { mode: "single", items: [{ ...rcpt(b.dataset.id) }], i: 0, from: "saved" }; go("#/expenses/review"); });
act("xClaimAll", () => { RV = { mode: "multi", items: S.receipts.filter((r) => !r.claim).map((r) => ({ ...r })), i: 0, from: "saved" }; go("#/expenses/review"); });
act("xNew", () => {
  const s = openSheet({
    title: "New claim",
    body: `<div class="stack">
      <button class="choice-card" data-s="m" data-v="single"><span class="x-ic tint t-blue">${I("receipt")}</span><span class="grow"><b style="display:block">Single claim</b><span class="small muted">One receipt, claimed on its own.</span></span>${I("chevR")}</button>
      <button class="choice-card" data-s="m" data-v="multi"><span class="x-ic tint t-violet">${I("copy")}</span><span class="grow"><b style="display:block">Multi claim</b><span class="small muted">Several receipts grouped into one claim, like a trip.</span></span>${I("chevR")}</button></div>`,
    onMount(el) { onS(el, { m(b) { closeSheet(s); go(`#/expenses/new?mode=${b.dataset.v}`); } }); },
  });
});
act("xFilter", () => {
  const F = JSON.parse(JSON.stringify(XF));
  const months = [...new Set(S.claims.map(claimDate).map((d) => d.slice(0, 7)))].sort().reverse();
  const tog = (arr, v) => { const i = arr.indexOf(v); i < 0 ? arr.push(v) : arr.splice(i, 1); };
  const s = openSheet({
    title: "Filters", body: `<div data-f></div>`,
    foot: `<div class="row-btns"><button class="btn outline" data-s="clear">Clear all</button><button class="btn primary" style="flex:1" data-s="apply">Apply filter</button></div>`,
    onMount(el) {
      const draw = () => {
        el.querySelector("[data-f]").innerHTML = `<div class="stack s16">
          <div class="field"><span class="lbl">Claim status</span><div class="choices">${[["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"], ["withdrawn", "Withdrawn"]].map(([v, l]) => `<button class="choice ${F.status.includes(v) ? "on" : ""}" data-s="st" data-v="${v}">${l}</button>`).join("")}</div></div>
          <div class="field"><span class="lbl">Claim type</span><div class="choices">${EXP_CATS.map((c) => `<button class="choice ${F.cats.includes(c.id) ? "on" : ""}" data-s="cat" data-v="${esc(c.id)}">${esc(c.id)}</button>`).join("")}</div></div>
          <div class="field"><span class="lbl">Amount range (INR)</span><div class="grid2"><input class="inp" type="number" inputmode="numeric" min="0" placeholder="From 0" data-min value="${esc(F.min)}"><input class="inp" type="number" inputmode="numeric" min="0" placeholder="To any" data-max value="${esc(F.max)}"></div></div>
          <div class="field"><span class="lbl">Cost centre</span><div class="choices">${COST_CENTRES.map((c) => `<button class="choice ${F.cc.includes(c.id) ? "on" : ""}" data-s="cc" data-v="${c.id}">${esc(c.name)}</button>`).join("")}</div></div>
          <div class="field"><span class="lbl">Month</span><div class="choices">${months.map((m) => `<button class="choice ${F.month === m ? "on" : ""}" data-s="mo" data-v="${m}">${D.f(m + "-01", { month: "short", year: "numeric" })}</button>`).join("")}</div></div>
        </div>`;
      };
      el.addEventListener("input", (e) => { if (e.target.matches("[data-min]")) F.min = e.target.value; if (e.target.matches("[data-max]")) F.max = e.target.value; });
      onS(el, {
        st(b) { tog(F.status, b.dataset.v); draw(); }, cat(b) { tog(F.cats, b.dataset.v); draw(); }, cc(b) { tog(F.cc, b.dataset.v); draw(); },
        mo(b) { F.month = F.month === b.dataset.v ? "" : b.dataset.v; draw(); },
        clear() { F.status = []; F.cats = []; F.cc = []; F.min = ""; F.max = ""; F.month = ""; draw(); },
        apply() { if (F.min && F.max && Number(F.min) > Number(F.max)) return toast("“From” is more than “To”", "bad"); XF = F; closeSheet(s); rerender(); },
      });
      draw();
    },
  });
});

// ── Upload receipts ──
let RV = null; // receipt review state: { mode, items, i, claim?, edit?, from?, more? }
route("expenses/new", (_, q) => {
  const mode = q.mode === "multi" ? "multi" : "single";
  return `<div class="screen">${topbar("Upload receipt", { sub: "Kais reads and categorises it for you" })}
  ${seg([["single", "Single claim"], ["multi", "Multi claim"]], mode, "upMode")}
  <div class="scroll"><div class="stack s16">
    <button class="up-drop" data-act="upPick" data-drop>${I("upload")}<b>Tap to upload${mode === "multi" ? " receipts" : " a receipt"}</b><span class="small muted">or drag and drop · photo or PDF, up to 25 MB</span></button>
    <div class="card soft up-tips"><div class="hrow"><span class="i acc-ic">${I("sparkles")}</span><b>Smart tips</b></div>
      <p>Capture the whole receipt in good light for the best extraction.</p><p>Kais reads multiple currencies and languages.</p>${mode === "multi" ? `<p>Pick several receipts at once to group them into one claim.</p>` : `<p>Have more than one bill? Switch to Multi claim.</p>`}</div>
    <div class="up-opts">
      <button data-act="upPick"><span class="up-ic">${I("file")}</span>Choose file</button>
      ${mode === "multi" ? `<button data-act="upPick" data-gallery="1"><span class="up-ic">${I("copy")}</span>Multi take</button>` : ""}
      <button data-act="upPick" data-cam="1"><span class="up-ic">${I("scan")}</span>Take photo</button>
    </div>
  </div></div></div>`;
}, {
  mount(_, q) {
    const z = $("[data-drop]"); if (!z) return;
    z.addEventListener("dragover", (e) => { e.preventDefault(); z.classList.add("over"); });
    z.addEventListener("dragleave", () => z.classList.remove("over"));
    z.addEventListener("drop", async (e) => {
      e.preventDefault(); z.classList.remove("over");
      let files = [...e.dataTransfer.files].filter((f) => /^image\/|pdf$/.test(f.type));
      if (q.mode !== "multi") files = files.slice(0, 1);
      if (files.length) startReview(q.mode === "multi" ? "multi" : "single", await Promise.all(files.map(async (f) => ({ name: f.name, size: fmtSize(f.size), img: await thumbOf(f) }))));
    });
  },
});
act("upMode", (b) => swap(`#/expenses/new?mode=${b.dataset.v}`));
act("upPick", (b) => {
  const multi = parseHash().q.mode === "multi";
  pickReceipts({ multiple: multi && !b.dataset.cam, capture: !!b.dataset.cam, onFiles: (files) => startReview(multi ? "multi" : "single", multi ? files : files.slice(0, 1)) });
});
function startReview(mode, files, extra = {}) {
  RV = { mode, items: files.map((f) => ({ ...kaisExtract(f), _p: true })), i: 0, ...extra };
  if (extra.append) return;
  go("#/expenses/review");
  setTimeout(() => { RV?.items.forEach((r) => delete r._p); if (parseHash().path === "expenses/review") rerender(); }, 1500);
}

// ── Review receipt (Kais-parsed details) ──
route("expenses/review", () => {
  if (!RV || !RV.items.length) return `<div class="screen">${topbar("Receipt")}${emptyState(["receipt"], "No receipt", "Upload a receipt to continue.", `<button class="btn primary" data-go="#/expenses/new">Upload receipt</button>`)}</div>`;
  const r = RV.items[RV.i], n = RV.items.length, busy = !!r._p;
  const cat = expCat(r.cat);
  const proj = PROJECTS.find((p) => p.id === r.project);
  const taxAmt = Math.round(r.inr * r.taxPct / (100 + r.taxPct));
  const addTo = RV.claim && claimOf(RV.claim);
  const right = RV.mode === "multi" && !RV.edit ? `<button class="ib acc" data-act="rvMore" aria-label="Add more receipts">${I("plus")}</button>` : RV.edit ? `<button class="ib" style="color:var(--danger)" data-act="rvRemove" aria-label="Remove from claim">${I("trash")}</button>` : "";
  const sk = (w) => `<i class="sk" style="width:${w};height:18px;display:block;border-radius:8px"></i>`;
  return `<div class="screen has-foot">${topbar(RV.edit ? "Receipt details" : "Review receipt", { sub: busy ? "Kais is reading your receipt" : "Details parsed by Kais", right })}
  <div class="scroll"><div class="stack s16" style="padding-top:4px">
    ${n > 1 ? `<div class="rv-pager"><button class="ib sm" data-act="rvGo" data-d="-1" ${RV.i ? "" : "disabled"} aria-label="Previous receipt">${I("chevL")}</button><span class="grow"><b>Receipt ${RV.i + 1} of ${n}</b><span class="rv-dots">${RV.items.map((x, i) => `<i class="${i === RV.i ? "on" : ""} ${overLimit(x) ? "warn" : ""}"></i>`).join("")}</span></span><button class="ib sm" data-act="rvGo" data-d="1" ${RV.i < n - 1 ? "" : "disabled"} aria-label="Next receipt">${I("chevR")}</button></div>` : ""}
    <div class="rv-prev ${busy ? "scan" : ""}">${r.file?.img ? `<img src="${r.file.img}" alt="Receipt ${esc(r.file.name)}">` : `<div class="rv-doc">${fileIcon(r.file?.name || "receipt.pdf")}<span class="small muted ell">${esc(r.file?.name || "")}</span></div>`}${busy ? `<span class="rv-beam"></span>` : ""}</div>
    ${busy ? `<div class="stack s16"><div class="ai-hint">${I("sparkles")}Extracting data · categorising expense…</div>${sk("60%")}${sk("100%")}${sk("100%")}${sk("80%")}</div>` : `
    <div class="field"><span class="lbl">Amount</span>
      <div class="rv-amt"><button class="rv-cur" data-act="rvCur">${r.cur}${I("chevD")}</button><input class="rv-num" type="number" inputmode="decimal" min="0" step="0.01" data-rf="amt" value="${r.amt}" aria-label="Amount">${r.cur !== "INR" ? `<span class="rv-inr" data-inr>≈ ${fmtCur(r.inr)}</span>` : ""}</div>
      <span class="ai-hint">${I("sparkles")}Amount and currency auto-extracted</span>
      ${overLimit(r) ? `<div class="banner warn" style="margin-top:6px">${I("alert")}Over the ${esc(cat.id)} limit of ${money(cat.limit)} per receipt. Add a note for your approver.</div>` : ""}</div>
    <div class="grid2"><div class="field"><span class="lbl">Receipt ID</span><div class="inp ro">${esc(r.rid)}</div></div>
      <div class="field"><span class="lbl">Receipt date</span><button class="inp sel" data-act="rvDate"><span>${D.long(r.date)}</span>${I("calendar")}</button></div></div>
    <div class="field"><label for="rv-m">Merchant</label><input id="rv-m" class="inp" data-rf="merchant" value="${esc(r.merchant)}" placeholder="Ex: Starbucks"></div>
    <div class="field"><span class="lbl">Category</span><button class="inp sel" data-act="rvCat"><span class="hrow"><span class="i" style="color:var(--c-${cat.tint})">${I(cat.icon)}</span>${esc(cat.id)}</span>${I("chevD")}</button></div>
    <div class="field"><span class="lbl">Payment mode</span><button class="inp sel" data-act="rvPay"><span>${esc(r.pay)}</span>${I("chevD")}</button></div>
    ${RV.more ? `
      <div class="field"><label for="rv-d">Description</label><input id="rv-d" class="inp" data-rf="desc" value="${esc(r.desc)}" placeholder="Ex: Dinner with Zifo team"></div>
      <div class="grid2"><div class="field"><label for="rv-t">Tax %</label><input id="rv-t" class="inp" type="number" min="0" max="40" inputmode="decimal" data-rf="taxPct" value="${r.taxPct}"></div>
        <div class="field"><span class="lbl">Tax amount</span><div class="inp ro" data-tax>${money(taxAmt)}</div></div></div>
      <div class="grid2"><div class="field"><span class="lbl">Paid by</span><button class="inp sel" data-act="rvPaid"><span>${esc(r.paidBy)}</span>${I("chevD")}</button></div>
        <div class="field"><span class="lbl">Project</span><button class="inp sel" data-act="rvProj"><span class="ell">${esc(proj?.name || "None")}</span>${I("chevD")}</button></div></div>
      <div class="field"><span class="lbl">Involved people <span class="opt">(optional)</span></span><button class="inp sel" data-act="rvPeople"><span class="hrow">${r.people.length ? `<span class="av-stack">${r.people.slice(0, 4).map((p) => avatar(p, "sm")).join("")}</span>${r.people.length > 4 ? `+${r.people.length - 4}` : ""}` : `<span class="muted">Add people</span>`}</span>${I("plus")}</button></div>
      <button class="link" style="align-self:flex-start" data-act="rvMoreF">Show fewer fields</button>`
      : `<button class="link" style="align-self:flex-start" data-act="rvMoreF">Show more fields</button>`}`}
  </div></div>
  <div class="foot">${RV.edit
    ? `<button class="btn primary block" data-act="rvSaveEdit" ${busy ? "disabled" : ""}>Save changes</button>`
    : `<div class="row-btns"><button class="btn outline" data-act="rvSaveLater" ${busy ? "disabled" : ""}>Save for later</button><button class="btn primary" style="flex:1" data-act="rvCreate" ${busy ? "disabled" : ""}>${addTo ? `Add to ${esc(claimTitle(addTo))}` : n > 1 ? `Create claim (${n})` : "Create claim"}</button></div>`}</div></div>`;
}, {
  mount() {
    const sc = $(".screen"); if (!sc || !RV) return;
    sc.addEventListener("input", (e) => {
      const k = e.target.dataset?.rf; if (!k || !RV) return;
      const r = RV.items[RV.i];
      if (k === "amt" || k === "taxPct") {
        r[k] = Math.max(0, Number(e.target.value) || 0);
        if (k === "amt") { r.inr = Math.round(r.amt * (CUR[r.cur] || 1)); const t = $("[data-inr]"); if (t) t.textContent = "≈ " + fmtCur(r.inr); }
        const tx = $("[data-tax]"); if (tx) tx.textContent = money(Math.round(r.inr * r.taxPct / (100 + r.taxPct)));
      } else r[k] = e.target.value;
    });
    sc.addEventListener("change", (e) => { if (e.target.dataset?.rf === "amt") rerender(); }); // refresh the limit warning
  },
});
act("rvGo", (b) => { if (!RV) return; RV.i = Math.min(RV.items.length - 1, Math.max(0, RV.i + Number(b.dataset.d))); rerender(); });
act("rvMoreF", () => { RV.more = !RV.more; rerender(); });
act("rvCur", () => { const r = RV.items[RV.i]; pickOption({ title: "Currency", value: r.cur, options: Object.keys(CUR).map((c) => ({ v: c, label: c, sub: c === "INR" ? "Indian rupee" : `1 ${c} ≈ ${fmtCur(CUR[c])}` })), onPick(v) { r.cur = v; r.inr = Math.round(r.amt * CUR[v]); rerender(); } }); });
act("rvCat", () => { const r = RV.items[RV.i]; pickOption({ title: "Category", value: r.cat, options: EXP_CATS.map((c) => ({ v: c.id, label: c.id, icon: c.icon, sub: `Limit ${money(c.limit)} per receipt` })), onPick(v) { r.cat = v; rerender(); } }); });
act("rvPay", () => { const r = RV.items[RV.i]; pickOption({ title: "Payment mode", value: r.pay, options: PAY_MODES.map((p) => ({ v: p, label: p })), onPick(v) { r.pay = v; rerender(); } }); });
act("rvPaid", () => { const r = RV.items[RV.i]; pickOption({ title: "Paid by", value: r.paidBy, options: [{ v: "Me", label: "Me", sub: "Reimburse to my account" }, { v: "Company", label: "Company", sub: "Paid with a company card" }], onPick(v) { r.paidBy = v; rerender(); } }); });
act("rvProj", () => { const r = RV.items[RV.i]; pickOption({ title: "Project", value: r.project, options: [{ v: "", label: "None" }, ...PROJECTS.map((p) => ({ v: p.id, label: p.name, sub: p.owner }))], onPick(v) { r.project = v; rerender(); } }); });
act("rvPeople", () => { const r = RV.items[RV.i]; pickPeople({ title: "Involved people", selected: r.people, onDone(ids) { r.people = ids; rerender(); } }); });
act("rvDate", () => { const r = RV.items[RV.i]; pickDates({ title: "Receipt date", mode: "single", start: r.date, onDone({ start }) { if (start > D.today()) return toast("Receipt date can’t be in the future", "bad"); r.date = start; rerender(); } }); });
act("rvMore", () => pickReceipts({ multiple: true, onFiles(files) {
  const add = files.map((f) => ({ ...kaisExtract(f), _p: true }));
  RV.items.push(...add); RV.i = RV.items.length - add.length; rerender();
  setTimeout(() => { add.forEach((r) => delete r._p); if (parseHash().path === "expenses/review") rerender(); }, 1500);
} }));
const cleanRc = (r) => { const x = { ...r }; delete x._p; return x; };
function rvValid() {
  const bad = RV.items.findIndex((r) => !(r.amt > 0) || !r.merchant.trim());
  if (bad >= 0) { RV.i = bad; rerender(); toast(!(RV.items[bad].amt > 0) ? "Enter the receipt amount" : "Add the merchant name", "bad"); return false; }
  return true;
}
function upsertReceipts(claimId) {
  RV.items.forEach((r) => { const x = cleanRc(r); x.claim = claimId; const i = S.receipts.findIndex((y) => y.id === x.id); i >= 0 ? (S.receipts[i] = x) : S.receipts.push(x); });
}
act("rvSaveLater", () => { if (!rvValid()) return; upsertReceipts(null); save(); const n = RV.items.length; RV = null; toast(n > 1 ? `${n} receipts saved for later` : "Receipt saved for later"); swap("#/expenses?tab=saved"); });
act("rvCreate", () => {
  if (!rvValid()) return;
  let c = RV.claim && claimOf(RV.claim);
  if (c) { upsertReceipts(c.id); RV.items.forEach((r) => { if (!c.receipts.includes(r.id)) c.receipts.push(r.id); }); }
  else {
    const first = RV.items[0];
    c = { id: uid(), code: nextCode(), name: RV.items.length > 1 ? `Claim – ${D.f(D.today(), { day: "numeric", month: "short" })}` : first.merchant, status: "saved", cc: "", approver: "pr", entity: ENTITIES[0], billing: "Billable", desc: first.desc || "", cur: first.cur, receipts: RV.items.map((r) => r.id), created: Date.now(), submitted: null, paid: 0, note: "" };
    upsertReceipts(c.id); S.claims.unshift(c);
  }
  save(); RV = null; swap(`#/expenses/claim/${c.id}`); toast("Claim saved · review and submit");
});
act("rvSaveEdit", () => { if (!rvValid()) return; const r = cleanRc(RV.items[0]); const i = S.receipts.findIndex((y) => y.id === r.id); if (i >= 0) S.receipts[i] = r; save(); RV = null; ACTIONS.back(); toast("Receipt updated"); });
act("rvRemove", () => confirmSheet({ eyebrow: "Remove receipt", text: "Remove this receipt from the claim? It moves to your saved receipts.", ok: "Remove", danger: true, onOk() {
  const r = rcpt(RV.items[0].id), c = r && claimOf(r.claim);
  if (c) { c.receipts = c.receipts.filter((id) => id !== r.id); r.claim = null; if (!c.receipts.length) S.claims = S.claims.filter((x) => x !== c); }
  save(); RV = null; ACTIONS.back(); toast("Moved to saved receipts");
} }));

// ── Claim group (saved) / claim detail (submitted) ──
let XG = "date"; // group receipts by date | category
function rcRow(r, c, editable) {
  const cat = expCat(r.cat);
  return `<button class="rc-row" ${editable ? `data-act="xRcOpen" data-id="${r.id}"` : `data-act="xRcView" data-id="${r.id}"`}>${rcThumb(r)}
    <span class="grow" style="min-width:0"><b class="ell" style="display:block">${esc(r.merchant)}</b><span class="rc-meta"><span>${esc(r.rid.slice(0, 8))}…</span><span class="dotsep"></span><span class="rc-cat" style="--t:var(--c-${cat.tint})">${I(cat.icon)}${esc(cat.id.split(" ")[0])}</span></span>
    ${overLimit(r) ? `<span class="rc-warn">${I("alert")}Over the ${money(cat.limit)} limit</span>` : ""}</span>
    <span class="rc-amt"><b class="num">${fmtCur(r.inr, c.cur)}</b>${r.cur !== c.cur ? `<span class="tiny muted">${fmtCur(r.inr, r.cur)}</span>` : ""}</span></button>`;
}
function rcGroups(rs, c, editable) {
  const groups = [];
  rs.slice().sort((a, b) => (XG === "date" ? (a.date < b.date ? 1 : -1) : a.cat.localeCompare(b.cat))).forEach((r) => { const k = XG === "date" ? r.date : r.cat; const g = groups.find((x) => x.k === k); g ? g.items.push(r) : groups.push({ k, items: [r] }); });
  return groups.map((g) => `<div class="rc-gh">${XG === "date" ? D.long(g.k) : `${esc(g.k)} (${g.items.length})`}</div><div class="rc-list">${g.items.map((r) => rcRow(r, c, editable)).join("")}</div>`).join("");
}
route("expenses/claim/:id", ({ id }, q) => {
  const c = claimOf(id);
  if (!c) return `<div class="screen">${topbar("Claim")}${emptyState(["wallet"], "Claim not found", "It may have been split or removed.", `<button class="btn primary" data-go="#/expenses">My expenses</button>`)}</div>`;
  const rs = claimReceipts(c), total = claimTotal(c), warn = rs.filter(overLimit);
  if (c.status !== "saved") return claimDetail(c, rs, total, q);
  return `<div class="screen has-foot">${topbar(esc(claimTitle(c)), { sub: c.code, right: `<button class="ib" data-act="xRename" data-id="${c.id}" aria-label="Rename claim">${I("edit")}</button>` })}
  <div class="scroll"><div class="stack">
    <div class="card accent cg-hero">
      <div class="hrow"><span class="chip">Saved</span><span class="grow"></span><button class="cg-cur" data-act="xCur" data-id="${c.id}">${c.cur}${I("chevD")}</button></div>
      <b class="timer">${fmtCur(total, c.cur)}</b>
      <span class="small muted">${plural(rs.length, "receipt")}${c.cur !== "INR" ? ` · ${money(total)}` : ""}</span>
      <button class="cg-meta" data-go="#/expenses/claim/${c.id}/edit">
        <span><small>Cost centre</small><b class="${c.cc ? "" : "miss"}">${c.cc ? esc(ccName(c.cc)) : "Add cost centre"}</b></span>
        <span><small>Approver</small><b>${esc(approverName(c.approver))}</b></span>
        ${I("chevR")}</button>
    </div>
    ${warn.length ? `<div class="kais-tip"><img src="kais.svg" alt=""><span><b>${warn.length === 1 ? esc(warn[0].merchant) + " is" : plural(warn.length, "receipt") + " are"} over the policy limit.</b> Add a note in the description so your approver knows why, or split the claim.</span></div>` : ""}
    <div class="sec"><h2>All expenses <span class="muted" style="font-weight:600">(${rs.length})</span></h2><button class="link" data-act="xGroup">${XG === "date" ? "By date" : "By category"} ${I("chevD")}</button></div>
    ${rcGroups(rs, c, true)}
    <button class="add-row" data-act="xAddBill" data-id="${c.id}">${I("plus")}Add another receipt</button>
  </div></div>
  <div class="foot"><div class="row-btns"><button class="btn outline" data-go="#/expenses/claim/${c.id}/split" ${rs.length < 2 ? "disabled" : ""}>Split</button><button class="btn primary" style="flex:1" data-act="xSubmit" data-id="${c.id}">Submit claim</button></div></div></div>`;
});
function claimDetail(c, rs, total, q) {
  const banner = { pending: `<div class="banner warn">${I("clock")}Waiting for approval · ${esc(approverName(c.approver))}</div>`, approved: `<div class="banner ok">${I("checkCircle")}Approved${c.paid >= total ? " and paid" : ""}</div>`, rejected: `<div class="banner bad">${I("x")}Rejected${c.note ? ` · ${esc(c.note)}` : ""}</div>`, withdrawn: `<div class="banner info">${I("info")}Withdrawn by you</div>` }[c.status] || "";
  const act2 = [["Created", c.created, ""], c.submitted && ["Submitted to " + approverName(c.approver), c.submitted, ""], c.status === "approved" && ["Approved", c.submitted + 864e5, "ok"], c.status === "rejected" && ["Rejected", c.submitted + 864e5, "bad"], c.status === "withdrawn" && ["Withdrawn by you", c.withdrawn || Date.now(), "bad"]].filter(Boolean);
  return `<div class="screen has-foot">${topbar(esc(c.code), { sub: "Claim" })}
  <div class="scroll"><div class="stack">
    ${q.new && c.status === "pending" ? `<div class="banner ok">${I("checkCircle")}Claim submitted successfully</div>` : banner}
    <div class="card accent cd-hero"><b class="cd-t">${esc(claimTitle(c))}</b><span class="small muted ell">${esc(c.entity)}</span>
      <div class="grid2" style="margin-top:12px"><span><small>Amount requested</small><b class="num">${fmtCur(total, c.cur)}</b></span><span><small>Amount paid</small><b class="num">${fmtCur(c.paid || 0, c.cur)}</b></span></div></div>
    <div class="sec"><h2>Claim details</h2></div>
    <div class="card">
      <div class="kv"><span>Claim ID</span><span>${esc(c.code)}</span></div>
      <div class="kv"><span>Cost centre</span><span>${esc(ccName(c.cc))}</span></div>
      <div class="kv"><span>Cost centre ID</span><span>${esc(c.cc || "—")}</span></div>
      <div class="kv"><span>Approver</span><span>${esc(approverName(c.approver))}</span></div>
      <div class="kv"><span>Billing type</span><span>${esc(c.billing)}</span></div>
      ${c.submitted ? `<div class="kv"><span>Submitted on</span><span>${D.long(D.iso(c.submitted))}</span></div>` : ""}
    </div>
    ${c.desc ? `<div class="stack s6" style="margin:6px 4px 0"><b class="small">Notes</b><span>${esc(c.desc)}</span></div>` : ""}
    <div class="sec"><h2>Expenses <span class="muted" style="font-weight:600">(${rs.length})</span></h2></div>
    ${rcGroups(rs, c, false)}
    <div class="sec"><h2>Attachments</h2></div>
    <div class="stack s8">${attachList(rs.map((r) => ({ name: r.file?.name || "receipt", size: r.file?.size || "" })))}</div>
    <div class="sec"><h2>Activity</h2></div>
    <div class="card"><div class="xtl">${act2.map(([t, ts, k]) => `<div class="xtl-i ${k}"><i></i><span class="grow">${esc(t)}</span><span class="tiny faint">${D.short(D.iso(ts))}</span></div>`).join("")}</div></div>
  </div></div>
  <div class="foot">${c.status === "pending" ? `<button class="btn danger block" data-act="xWithdraw" data-id="${c.id}">Withdraw claim</button>`
    : c.status === "withdrawn" || c.status === "rejected" ? `<button class="btn primary block" data-act="xReopen" data-id="${c.id}">Edit and resubmit</button>`
    : `<button class="btn ghost block" data-go="#/expenses">All claims</button>`}</div></div>`;
}
act("xGroup", () => pickOption({ title: "Group expenses", value: XG, options: [{ v: "date", label: "By date", icon: "calendar" }, { v: "cat", label: "By category", icon: "tag" }], onPick(v) { XG = v; rerender(); } }));
act("xCur", (b) => { const c = claimOf(b.dataset.id); pickOption({ title: "Show amounts in", value: c.cur, options: Object.keys(CUR).map((k) => ({ v: k, label: k, sub: fmtCur(claimTotal(c), k) })), onPick(v) { c.cur = v; save(); rerender(); } }); });
act("xRename", (b) => {
  const c = claimOf(b.dataset.id);
  const s = openSheet({ title: "Rename claim", body: `<input class="inp" data-n maxlength="60" value="${esc(c.name)}" placeholder="Ex: Trip to Delhi">`, foot: `<button class="btn primary block" data-s="ok">Save</button>`,
    onMount(el) { onS(el, { ok() { const v = el.querySelector("[data-n]").value.trim(); if (!v) return toast("Give the claim a name", "bad"); c.name = v; save(); closeSheet(s); rerender(); } }); } });
});
act("xRcOpen", (b) => { const r = rcpt(b.dataset.id); RV = { mode: "single", items: [{ ...r }], i: 0, edit: true }; go("#/expenses/review"); });
act("xRcView", (b) => {
  const r = rcpt(b.dataset.id), cat = expCat(r.cat), proj = PROJECTS.find((p) => p.id === r.project);
  openSheet({ title: esc(r.merchant), body: `${r.file?.img ? `<img class="rv-sheet-img" src="${r.file.img}" alt="">` : ""}<div class="card" style="margin-top:4px">
    <div class="kv"><span>Amount</span><span>${fmtCur(r.inr, r.cur)}${r.cur !== "INR" ? ` · ${money(r.inr)}` : ""}</span></div><div class="kv"><span>Category</span><span>${esc(cat.id)}</span></div>
    <div class="kv"><span>Receipt date</span><span>${D.long(r.date)}</span></div><div class="kv"><span>Receipt ID</span><span>${esc(r.rid)}</span></div>
    <div class="kv"><span>Payment mode</span><span>${esc(r.pay)}</span></div><div class="kv"><span>Tax</span><span>${r.taxPct}% · ${money(Math.round(r.inr * r.taxPct / (100 + r.taxPct)))}</span></div>
    ${proj ? `<div class="kv"><span>Project</span><span>${esc(proj.name)}</span></div>` : ""}${r.desc ? `<div class="kv"><span>Description</span><span>${esc(r.desc)}</span></div>` : ""}</div>` });
});
act("xAddBill", (b) => pickReceipts({ multiple: true, onFiles(files) { startReview("multi", files, { claim: b.dataset.id }); } }));
act("xSubmit", (b) => {
  const c = claimOf(b.dataset.id);
  if (!c.cc) { toast("Add a cost centre before submitting", "bad"); return go(`#/expenses/claim/${c.id}/edit`); }
  confirmSheet({ eyebrow: "Submit claim", text: `Submit ${esc(claimTitle(c))} for ${fmtCur(claimTotal(c), c.cur)} to ${esc(approverName(c.approver))}?`, ok: "Submit claim", onOk() {
    c.status = "pending"; c.submitted = Date.now(); save(); swap(`#/expenses/claim/${c.id}?new=1`);
  } });
});
act("xWithdraw", (b) => confirmSheet({ eyebrow: "Withdraw", text: "Withdraw this claim? Your approver will be notified.", ok: "Yes, withdraw", danger: true, onOk() { const c = claimOf(b.dataset.id); c.status = "withdrawn"; c.withdrawn = Date.now(); save(); rerender(); toast("Claim withdrawn"); } }));
act("xReopen", (b) => { const c = claimOf(b.dataset.id); c.status = "saved"; c.note = ""; save(); rerender(); toast("Claim moved back to saved"); });

// ── Edit claim details ──
route("expenses/claim/:id/edit", ({ id }) => {
  const c = claimOf(id); if (!c) return `<div class="screen">${topbar("Edit details")}${emptyState(["wallet"], "Claim not found", "")}</div>`;
  const F = draft("claimEdit" + id, { name: c.name, cc: c.cc, approver: c.approver, entity: c.entity, desc: c.desc, billing: c.billing });
  return `<div class="screen has-foot">${topbar("Edit details", { sub: "Review and edit your claim" })}<div class="scroll"><div class="stack s16" style="padding-top:6px">
    <div class="grid2" style="grid-template-columns:.8fr 1.2fr"><div class="field"><span class="lbl">Claim ID</span><div class="inp ro">${esc(c.code)}</div></div>
      <div class="field"><label for="ce-n">Claim name</label><input id="ce-n" class="inp" data-bind="name" value="${esc(F.name)}" maxlength="60"></div></div>
    <div class="field"><span class="lbl">Cost centre</span><button class="inp sel" data-act="ceCc"><span class="hrow">${I("building")}<span class="${F.cc ? "" : "muted"}">${F.cc ? `${esc(ccName(F.cc))} <span class="tiny muted">${esc(F.cc)}</span>` : "Choose a cost centre"}</span></span>${I("chevD")}</button></div>
    <div class="field"><span class="lbl">Approver</span><button class="inp sel" data-act="ceAp"><span class="hrow">${F.approver === "pr" ? avatar("pr", "sm") : `<span class="i">${I("users")}</span>`}${esc(approverName(F.approver))}</span>${I("chevD")}</button></div>
    <div class="field"><span class="lbl">Legal entity</span><button class="inp sel" data-act="ceEn"><span>${esc(F.entity)}</span>${I("chevD")}</button></div>
    <div class="field"><label for="ce-d">Description</label><textarea id="ce-d" class="inp" rows="3" data-bind="desc" placeholder="Ex: Flight to NYC for client meeting">${esc(F.desc)}</textarea></div>
    <div class="field"><span class="lbl">Billing type</span><div class="choices">${["Billable", "Non-billable"].map((x) => `<button class="choice ${F.billing === x ? "on" : ""}" data-act="ceBill" data-v="${x}">${x}</button>`).join("")}</div></div>
  </div></div><div class="foot"><button class="btn primary block" data-act="ceSave" data-id="${c.id}" data-cta>Save</button></div></div>`;
}, { mount() { FORM_CHECK = () => { const b = $("[data-cta]"); if (b && DRAFT) b.disabled = !DRAFT.name.trim(); }; FORM_CHECK(); } });
act("ceCc", () => pickOption({ title: "Cost centre", value: DRAFT.cc, options: COST_CENTRES.map((c) => ({ v: c.id, label: c.name, sub: c.id, icon: "building" })), onPick(v) { DRAFT.cc = v; rerender(); } }));
act("ceAp", () => pickOption({ title: "Approver", value: DRAFT.approver, options: APPROVERS.map((a) => ({ v: a.v, label: a.v === "pr" ? `${person("pr").name}` : a.label, sub: a.v === "pr" ? "Reporting manager" : "Team approval", icon: "users" })), onPick(v) { DRAFT.approver = v; rerender(); } }));
act("ceEn", () => pickOption({ title: "Legal entity", value: DRAFT.entity, options: ENTITIES.map((e) => ({ v: e, label: e })), onPick(v) { DRAFT.entity = v; rerender(); } }));
act("ceBill", (b) => { DRAFT.billing = b.dataset.v; rerender(); });
act("ceSave", (b) => { if (b.disabled) return; const c = claimOf(b.dataset.id), F = DRAFT; Object.assign(c, { name: F.name.trim(), cc: F.cc, approver: F.approver, entity: F.entity, desc: F.desc.trim(), billing: F.billing }); save(); DRAFT = null; ACTIONS.back(); toast("Claim details saved"); });

// ── Split a claim by cost centre or category ──
let SP = null; // { id, by: "cc"|"cat", groups: [{ key, cc }], asg: { receiptId: groupIndex } }
function spInit(c, by) {
  const rs = claimReceipts(c);
  if (by === "cat") {
    const cats = [...new Set(rs.map((r) => r.cat))];
    SP = { id: c.id, by, groups: cats.map((k) => ({ key: k, cc: c.cc || "" })), asg: Object.fromEntries(rs.map((r) => [r.id, cats.indexOf(r.cat)])) };
  } else SP = { id: c.id, by, groups: [{ key: c.cc || "", cc: c.cc || "" }, { key: "", cc: "" }], asg: Object.fromEntries(rs.map((r) => [r.id, 0])) };
}
route("expenses/claim/:id/split", ({ id }) => {
  const c = claimOf(id); if (!c) return `<div class="screen">${topbar("Split claim")}${emptyState(["wallet"], "Claim not found", "")}</div>`;
  if (!SP || SP.id !== id) spInit(c, "cc");
  const rs = claimReceipts(c), total = claimTotal(c);
  const sums = SP.groups.map((_, gi) => rs.filter((r) => SP.asg[r.id] === gi).reduce((a, r) => a + r.inr, 0));
  const ready = SP.groups.length >= 2 && SP.groups.every((g, gi) => g.cc && sums[gi] > 0);
  return `<div class="screen has-foot">${topbar("Split claim", { sub: esc(claimTitle(c)) })}
  ${seg([["cc", "By cost centre"], ["cat", "By category"]], SP.by, "spBy")}
  <div class="scroll"><div class="stack">
    <div class="kais-tip"><img src="kais.svg" alt=""><span>${SP.by === "cc" ? "Pick a cost centre for each part, then move receipts between them. Each part is submitted as its own claim." : "I grouped your receipts by category. Choose a cost centre for each — each category becomes its own claim."}</span></div>
    <div class="card sp-sum"><span><small>Total</small><b class="num">${fmtCur(total, c.cur)}</b></span><span><small>Parts</small><b>${SP.groups.length}</b></span></div>
    ${SP.groups.map((g, gi) => `<div class="card sp-g">
      <div class="hrow"><span class="sp-n">${gi + 1}</span><b class="grow ell">${SP.by === "cat" ? esc(g.key) : g.cc ? esc(ccName(g.cc)) : "New part"}</b><span class="num"><b>${fmtCur(sums[gi], c.cur)}</b> <span class="tiny muted">${total ? Math.round(sums[gi] / total * 100) : 0}%</span></span>${SP.by === "cc" && SP.groups.length > 2 ? `<button class="ib sm" data-act="spDel" data-g="${gi}" aria-label="Remove part">${I("trash")}</button>` : ""}</div>
      <button class="inp sel" data-act="spCc" data-g="${gi}"><span class="hrow">${I("building")}<span class="${g.cc ? "" : "muted"}">${g.cc ? esc(ccName(g.cc)) : "Choose cost centre"}</span></span>${I("chevD")}</button>
      <div class="rc-list">${rs.filter((r) => SP.asg[r.id] === gi).map((r) => `<div class="rc-row">${rcThumb(r)}<span class="grow" style="min-width:0"><b class="ell" style="display:block">${esc(r.merchant)}</b><span class="tiny muted">${D.short(r.date)} · ${esc(r.cat)}</span></span><span class="rc-amt"><b class="num">${fmtCur(r.inr, c.cur)}</b>${SP.by === "cc" ? `<button class="link" data-act="spMove" data-id="${r.id}">Move</button>` : ""}</span></div>`).join("") || `<p class="small muted" style="padding:8px 0">No receipts yet — move one here.</p>`}</div>
    </div>`).join("")}
    ${SP.by === "cc" && SP.groups.length < COST_CENTRES.length ? `<button class="add-row" data-act="spAdd">${I("plus")}Add cost centre</button>` : ""}
  </div></div>
  <div class="foot"><button class="btn primary block" data-act="spSubmit" ${ready ? "" : "disabled"}>${ready ? `Submit ${SP.groups.length} claims` : "Choose a cost centre and receipts for each part"}</button></div></div>`;
});
act("spBy", (b) => { spInit(claimOf(SP.id), b.dataset.v); rerender(); });
act("spAdd", () => { SP.groups.push({ key: "", cc: "" }); rerender(); });
act("spDel", (b) => { const gi = Number(b.dataset.g); Object.keys(SP.asg).forEach((k) => { if (SP.asg[k] === gi) SP.asg[k] = 0; else if (SP.asg[k] > gi) SP.asg[k]--; }); SP.groups.splice(gi, 1); rerender(); });
act("spCc", (b) => { const g = SP.groups[Number(b.dataset.g)]; const used = SP.by === "cc" ? SP.groups.filter((x) => x !== g).map((x) => x.cc) : [];
  pickOption({ title: "Cost centre", value: g.cc, options: COST_CENTRES.filter((c) => !used.includes(c.id)).map((c) => ({ v: c.id, label: c.name, sub: c.id, icon: "building" })), onPick(v) { g.cc = v; if (SP.by === "cc") g.key = v; rerender(); } }); });
act("spMove", (b) => { const id = b.dataset.id; pickOption({ title: "Move receipt to", value: String(SP.asg[id]), options: SP.groups.map((g, gi) => ({ v: String(gi), label: `${gi + 1}. ${g.cc ? ccName(g.cc) : "New part"}` })), onPick(v) { SP.asg[id] = Number(v); rerender(); } }); });
act("spSubmit", (b) => {
  if (b.disabled) return;
  const c = claimOf(SP.id), n = SP.groups.length;
  confirmSheet({ eyebrow: "Split and submit", text: `Split ${esc(claimTitle(c))} into ${n} claims and submit them?`, ok: `Submit ${n} claims`, onOk() {
    const now = Date.now();
    const made = SP.groups.map((g, gi) => {
      const ids = c.receipts.filter((id) => SP.asg[id] === gi);
      const nc = { ...c, id: uid(), code: gi === 0 ? c.code : nextCode(), name: `${claimTitle(c)} – ${SP.by === "cat" ? g.key : ccName(g.cc).replace(/^.*– /, "")}`, cc: g.cc, receipts: ids, status: "pending", submitted: now };
      ids.forEach((id) => { const r = rcpt(id); if (r) r.claim = nc.id; });
      return nc;
    });
    S.claims = S.claims.filter((x) => x.id !== c.id); S.claims.unshift(...made); save(); SP = null;
    swap("#/expenses?st=pending"); toast(`${n} claims submitted`);
  } });
});

// demo reset re-creates the claims sample data
{ const base = resetDemo; resetDemo = function () { base(); const x = seedClaims(); S.receipts = x.receipts; S.claims = x.claims; delete S.expenses; delete S.bills; save(); }; }
