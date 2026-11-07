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

// ── checks shared by the app screens and Kais ──
const RECEIPT_NEEDED_OVER = 2000, HIGH_AMOUNT = 200000;
const rcFileOk = (f) => /\.(jpe?g|png|heic|heif|webp|gif|pdf)$/i.test(f?.name || "");
const rcReadable = (f) => !/(blur|unreadable|dark|fail|torn|cropped)/i.test(f?.name || ""); // demo: these file names "fail" to read
const hasReceipt = (x) => !!x.file && !/^no-receipt/.test(x.file.name || "");
const needsReceipt = (x) => x.inr > RECEIPT_NEEDED_OVER && !hasReceipt(x);
function rcDuplicate(x, ignore = []) {
  const m = (x.merchant || "").trim().toLowerCase();
  return m && S.receipts.find((r) => r.claim && !ignore.includes(r.id) && Math.abs(r.inr - x.inr) <= 1 && r.date === x.date && (r.merchant || "").trim().toLowerCase() === m);
}
const dupClaim = (r) => claimOf(r.claim);

// ── Kais receipt "extraction" (demo): plausible values from the file name ──
const MERCHANTS = [
  ["Uber", "Local conveyance", 180, 900], ["Starbucks", "Food & Beverages", 350, 1400], ["IndiGo", "Travel", 4200, 11800], ["Taj Hotels", "Accommodation", 6500, 14000],
  ["ACT Fibernet", "Internet", 799, 1499], ["Figma", "Software", 1100, 1300], ["McDonald’s", "Food & Beverages", 220, 780], ["Ola", "Local conveyance", 150, 700],
];
function kaisExtract(file) {
  if (!rcReadable(file)) return { id: uid(), rid: "RC" + Math.floor(1e7 + Math.random() * 9e7), merchant: "", cat: "Other", cur: "INR", amt: 0, inr: 0, date: D.today(), pay: "Corporate card", paidBy: "Me", project: "p4", taxPct: 5, desc: "", people: [], file, claim: null, _err: "unreadable" };
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
    const files = [...inp.files].filter((f) => {
      if (!rcFileOk(f) && !/^image\/|pdf$/.test(f.type)) { toast(`${f.name} isn’t a photo or PDF`, "bad"); return false; }
      if (f.size > 25e6) { toast(`${f.name} is over 25 MB — try a smaller photo`, "bad"); return false; }
      if (!f.size) { toast(`${f.name} is empty`, "bad"); return false; }
      return true;
    });
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
    const mon = D.today().slice(0, 7), apr = S.claims.filter((c) => c.status === "approved" && claimDate(c).startsWith(mon));
    const rs = (n) => `<span class="pc-cur">₹</span>${Math.round(n).toLocaleString("en-IN")}`;
    body = `<div class="paycard xc-pay">
      <div class="pc-top"><span class="pc-ic">${I("wallet")}</span><span class="pc-lbl">Yet to receive</span><span class="xc-pn">${nPending ? `${nPending} waiting` : "All clear"}</span></div>
      <div class="pc-amt">${rs(yet)}</div>
      <div class="pc-foot"><span class="pc-sub">${I("checkCircle")}<span>Approved in ${D.f(D.today(), { month: "short" })}</span><b>${rs(apr.reduce((a, c) => a + claimTotal(c), 0))}</b><em>· ${plural(apr.length, "claim")}</em></span></div>
    </div>
      <div class="hrow" style="margin-top:12px"><label class="searchbox grow">${I("search")}<input data-xq placeholder="Search claims" value="${esc(q.q || "")}" enterkeyhint="search"></label><button class="ib" data-act="xFilter" aria-label="Filters">${I("filter")}${xfCount() ? `<span class="dot"></span>` : ""}</button></div>
      ${filterHead(`${list.length} ${st === "all" ? "" : st + " "}${list.length === 1 ? "claim" : "claims"}`, "xSt", st, [["all", "All", "list"], ["pending", "Pending", "clock"], ["approved", "Approved", "checkCircle"], ["rejected", "Rejected", "x"], ["withdrawn", "Withdrawn", "archive"]].map(([v, l, ic]) => { const n = S.claims.filter((c) => c.status !== "saved" && (v === "all" || c.status === v)).length; return [v, l, ic, `${n} ${n === 1 ? "claim" : "claims"}`]; }), "Show claims")}
      ${xfCount() ? `<div class="hrow small muted" style="margin:2px 4px 0">${plural(xfCount(), "filter")} applied<span class="grow"></span><button class="link" data-act="xClear">Clear</button></div>` : ""}
      ${groups.length ? groups.map((g) => `<div class="sec"><h2>${dayLabel(g.k)} <span class="muted" style="font-weight:600">(${g.items.length})</span></h2></div><div class="stack" data-lazy="6">${g.items.map(claimCard).join("")}</div>`).join("")
        : emptyState(qq || xfCount() || st !== "all" ? ["search", "filter", "receipt"] : ["wallet", "receipt", "scan"], qq || xfCount() || st !== "all" ? "No claims match" : "No claims yet", qq || xfCount() || st !== "all" ? "Try a different search or filter." : "Upload a receipt to start your first claim.")}`;
  } else if (tab === "saved") {
    const drafts = S.claims.filter((c) => c.status === "saved");
    const loose = S.receipts.filter((r) => !r.claim);
    if (!drafts.length && !loose.length) body = emptyState(["wallet", "receipt", "scan"], "Nothing saved yet", "Receipts and claims you save for later appear here.", `<button class="btn primary" data-act="xNew">${I("plus")}New claim</button>`);
    else body = `<div class="sec" style="margin-top:4px"><h2>Saved claims</h2><span class="tiny muted">Not submitted yet</span></div>
      <div class="stack">${drafts.map(claimCard).join("") || emptyMini("wallet", "No saved claims.")}</div>
      <div class="sec"><h2>Saved receipts</h2>${loose.length > 1 ? `<button class="link" data-act="xClaimAll">Claim all</button>` : ""}</div>
      <div class="stack" data-lazy="6">${loose.map((r) => `<div class="card hrow">${rcThumb(r)}<span class="grow" style="min-width:0"><b class="ell" style="display:block">${esc(r.merchant)}</b><span class="tiny muted">${fmtCur(r.inr)} · ${D.short(r.date)} · ${esc(r.cat)}</span></span><button class="btn primary sm" data-act="xClaimOne" data-id="${r.id}">Claim</button><button class="ib sm" data-act="xRcDel" data-id="${r.id}" aria-label="Delete receipt">${I("trash")}</button></div>`).join("") || emptyMini("receipt", "Receipts you save for later appear here.")}</div>`;
  } else {
    const by = {}; S.claims.filter((c) => c.status !== "rejected" && c.status !== "withdrawn").forEach((c) => claimReceipts(c).forEach((r) => (by[r.cat] = (by[r.cat] || 0) + r.inr)));
    const total = Object.values(by).reduce((a, b) => a + b, 0), top = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
    body = `<div class="card accent"><span class="eyebrow">Total claimed</span><div class="timer" style="font-size:28px;margin-top:6px">${money(total)}</div>${top ? `<span class="small muted">Most spent on <b style="color:var(--ink)">${esc(top[0])}</b></span>` : ""}</div>
      <div class="sec"><h2>By category</h2></div>
      <div class="card ch-card">${Object.keys(by).length ? capsuleBars({ tone: "low", values: Object.values(by), labels: Object.keys(by).map((c) => ({ "Food & Beverages": "Food", "Local conveyance": "Local", Accommodation: "Stay", Software: "Apps", Internet: "Net" }[c] || c.split(" ")[0])), active: Object.values(by).indexOf(Math.max(...Object.values(by))), fmt: (v) => money(Math.round(v)), height: 132 }) : `<p class="muted small">No spend yet.</p>`}</div>`;
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
  const multi = mode === "multi", saved = S.receipts.filter((r) => !r.claim).length;
  return `<div class="screen">${topbar(multi ? "Upload receipts" : "Upload receipt", { sub: "Kais reads and categorises them" })}
  ${seg([["single", "Single claim"], ["multi", "Multi claim"]], mode, "upMode")}
  <div class="scroll"><div class="stack s16">
    <div class="up-hero" data-drop>
      ${uploadArt(mode)}
      <h2>${multi ? "Add all your receipts" : "Add your receipt"}</h2>
      <p>${multi ? "Pick several at once — Kais reads each one and groups them into one claim." : "Snap or upload it — Kais fills in the amount, date and merchant."}</p>
      <div class="up-acts">
        <button class="btn primary" data-act="upPick" data-cam="1">${I("scan")}${multi ? "Take photos" : "Take photo"}</button>
        <button class="btn outline" data-act="upPick">${I("upload")}${multi ? "Choose files" : "Choose file"}</button>
      </div>
      <span class="up-hint">Photo or PDF · up to 25 MB<span class="up-drag"> · or drop files here</span></span>
    </div>
    <div class="up-alt">
      <button data-act="upManual">${I("edit")}<span class="grow">No receipt? Add the details yourself</span>${I("chevR")}</button>
      ${saved ? `<button data-go="#/expenses?tab=saved">${I("receipt")}<span class="grow">Use a saved receipt <span class="muted">(${saved})</span></span>${I("chevR")}</button>` : ""}
    </div>
  </div></div></div>`;
}, {
  parent: "#/expenses",
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
function uploadArt(mode) {
  const lines = (y0) => [0, 1, 2, 3].map((i) => `<rect x="56" y="${y0 + i * 9}" width="${[30, 22, 26, 18][i]}" height="3" rx="1.5" class="ua-line"/><rect x="${[94, 94, 94, 94][i]}" y="${y0 + i * 9}" width="10" height="3" rx="1.5" class="ua-line"/>`).join("");
  return `<svg class="up-art" viewBox="0 0 160 128" role="img" aria-label="">
    <circle cx="80" cy="64" r="56" class="ua-bg"/>
    ${mode === "multi" ? `<g transform="rotate(9 92 66)"><path d="M54 24h56v74l-5-4-5 4-5-4-5 4-5-4-5 4-5-4-5 4-5-4-5 4-5-4-6 4Z" class="ua-paper back"/></g>` : ""}
    <g class="ua-receipt" transform="rotate(-5 80 64)">
      <path d="M46 20h64v80l-5.3-4-5.3 4-5.4-4-5.3 4-5.4-4-5.3 4-5.4-4-5.3 4-5.3-4-5.4 4-5.3-4-5.4 4Z" class="ua-paper"/>
      <rect x="56" y="30" width="20" height="5" rx="2.5" class="ua-head"/>
      ${lines(44)}
      <rect x="56" y="84" width="48" height="1.5" rx=".75" class="ua-line"/>
      <rect x="56" y="88.5" width="18" height="4" rx="2" class="ua-head"/><rect x="88" y="88.5" width="16" height="4" rx="2" class="ua-total"/>
    </g>
    <path d="M38 26v-8h8M122 26v-8h-8M38 102v8h8M122 102v8h-8" class="ua-frame"/>
    <rect x="40" y="40" width="80" height="2.5" rx="1.25" class="ua-beam"/>
    <g class="ua-badge"><circle cx="122" cy="96" r="15" class="ua-badge-bg"/><path d="M122 103v-13M116.5 95.5 122 90l5.5 5.5" class="ua-arrow"/></g>
    <circle cx="30" cy="44" r="3" class="ua-dot a"/><circle cx="134" cy="36" r="2.2" class="ua-dot b"/><circle cx="26" cy="88" r="2" class="ua-dot c"/>
  </svg>`;
}
act("upManual", () => { const mode = parseHash().q.mode === "multi" ? "multi" : "single"; RV = { mode, i: 0, more: true, items: [{ id: uid(), rid: "RC" + Math.floor(1e7 + Math.random() * 9e7), merchant: "", cat: "Other", cur: "INR", amt: 0, inr: 0, date: D.today(), pay: "Corporate card", paidBy: "Me", project: "p4", taxPct: 5, desc: "", people: [], file: { name: "no-receipt.txt" }, claim: null, manual: true }] }; go("#/expenses/review"); });
act("upMode", (b) => swap(`#/expenses/new?mode=${b.dataset.v}`));
act("upPick", (b) => {
  const multi = parseHash().q.mode === "multi";
  pickReceipts({ multiple: multi && !b.dataset.cam, capture: !!b.dataset.cam, onFiles: (files) => startReview(multi ? "multi" : "single", multi ? files : files.slice(0, 1)) });
});
function startReview(mode, files, extra = {}) {
  RV = { mode, items: files.map((f) => ({ ...kaisExtract(f), _p: true })), i: 0, ...extra };
  if (extra.append) return;
  go("#/expenses/review");
  setTimeout(() => {
    RV?.items.forEach((r) => delete r._p); if (parseHash().path === "expenses/review") rerender();
    // tell people their receipts are read (a banner if they left the screen, a phone notification if they left the app)
    if (typeof kebsNotify === "function" && RV) { const bad = RV.items.filter((r) => r._err).length, ok = RV.items.length - bad, tot = RV.items.reduce((a, r) => a + (r.inr || 0), 0);
      kebsNotify(bad ? { cat: "expenses", title: bad === RV.items.length ? "Receipt couldn’t be read" : `${plural(bad, "receipt")} couldn’t be read`, body: "Retake the photo or enter the details yourself.", route: "#/expenses/review", quietOn: "expenses/review" }
        : { cat: "expenses", title: "Expense analyzed successfully", body: `${plural(ok, "receipt")} read · ₹${Math.round(tot).toLocaleString("en-IN")} · ready to submit`, route: "#/expenses/review", quietOn: "expenses/review" }); }
  }, 1500);
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
    ${r.manual ? `<div class="rv-manual"><span class="kc-ic tint t-amber">${I("receipt")}</span><span class="grow"><b>No receipt</b><span>Fine for small amounts. Over ${money(RECEIPT_NEEDED_OVER)}, attach one before you submit.</span></span><button class="btn ghost sm" data-act="rvRetake">Add one</button></div>` : `<div class="rv-prev ${busy ? "scan" : ""}">${r.file?.img ? `<img src="${r.file.img}" alt="Receipt ${esc(r.file.name)}">` : `<div class="rv-doc">${fileIcon(r.file?.name || "receipt.pdf")}<span class="small muted ell">${esc(r.file?.name || "")}</span></div>`}${busy ? `<span class="rv-beam"></span>` : ""}</div>`}
    ${!busy && r._err ? `<div class="x-err"><span class="x-err-ic">${I("alert")}</span><span class="grow"><b>Kais couldn’t read this receipt</b><span>It looks blurry, dark or cut off. Retake it, or fill in the details yourself.</span><span class="hrow" style="gap:8px;margin-top:10px"><button class="btn primary sm" data-act="rvRetake">${I("scan")}Retake</button><button class="btn ghost sm" data-act="rvManual">Fill in myself</button></span></span></div>` : ""}
    ${!busy && !r._err && r.amt > 0 && rcDuplicate(r, [r.id]) ? (() => { const d = rcDuplicate(r, [r.id]), dc = dupClaim(d); return `<div class="banner warn">${I("copy")}<span>Looks like a duplicate — <b>${esc(d.merchant)}</b>, same amount and date, is already in ${esc(dc?.code || "another claim")}.</span></div>`; })() : ""}
    ${busy ? `<div class="stack s16"><div class="ai-hint">${I("sparkles")}Extracting data · categorising expense…</div>${sk("60%")}${sk("100%")}${sk("100%")}${sk("80%")}</div>` : `
    <div class="field"><span class="lbl">Amount</span>
      <div class="rv-amt"><button class="rv-cur" data-act="rvCur">${r.cur}${I("chevD")}</button><input class="rv-num" type="number" inputmode="decimal" min="0" step="0.01" data-rf="amt" value="${r.amt}" aria-label="Amount">${r.cur !== "INR" ? `<span class="rv-inr" data-inr>≈ ${fmtCur(r.inr)}</span>` : ""}</div>
      ${r._err ? "" : `<span class="ai-hint">${I("sparkles")}Amount and currency auto-extracted</span>`}
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
  parent: () => { const cid = RV?.claim || (RV?.edit && rcpt(RV.items[0]?.id)?.claim); return cid ? `#/expenses/claim/${cid}` : RV?.edit ? "#/expenses?tab=saved" : `#/expenses/new?mode=${RV?.mode || "single"}`; },
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
act("rvRetake", () => pickReceipts({ multiple: false, capture: true, onFiles(files) {
  const r = RV.items[RV.i], e = kaisExtract(files[0]);
  Object.assign(r, { ...e, id: r.id, _p: true }); delete r.manual; rerender();
  setTimeout(() => { delete r._p; if (parseHash().path === "expenses/review") rerender(); }, 1500);
} }));
act("rvManual", () => { const r = RV.items[RV.i]; delete r._err; rerender(); setTimeout(() => $("[data-rf=amt]")?.focus(), 50); });
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
  return groups.map((g) => `<div class="rc-gh">${XG === "date" ? D.long(g.k) : `${esc(g.k)} (${g.items.length})`}</div><div class="rc-list" data-lazy="8">${g.items.map((r) => rcRow(r, c, editable)).join("")}</div>`).join("");
}
route("expenses/claim/:id", ({ id }, q) => {
  const c = claimOf(id);
  if (!c) return `<div class="screen">${topbar("Claim")}${emptyState(["wallet"], "Claim not found", "It may have been split or removed.", `<button class="btn primary" data-go="#/expenses">My expenses</button>`)}</div>`;
  const rs = claimReceipts(c), total = claimTotal(c), warn = rs.filter(overLimit);
  if (c.status !== "saved") return claimDetail(c, rs, total, q);
  return `<div class="screen has-foot">
  <header class="cdh s-saved">
    <button class="ib" data-act="back" aria-label="Back">${I("back")}</button>
    <div class="cdh-b">
      <div class="cdh-id"><span>#${esc(c.code)}</span><span class="cdh-badge">Saved</span><span class="grow"></span><button class="cg-cur" data-act="xCur" data-id="${c.id}" aria-label="Show amounts in another currency">${c.cur}${I("chevD")}</button></div>
      <button class="cg-name" data-act="xRename" data-id="${c.id}" aria-label="Rename claim"><h1>${esc(claimTitle(c))}</h1>${I("edit")}</button>
      <div class="cg-total"><b>${fmtCur(total, c.cur)}</b><span>${plural(rs.length, "receipt")}${c.cur !== "INR" ? ` · ${money(total)}` : ""}</span></div>
      <button class="cg-meta" data-go="#/expenses/claim/${c.id}/edit">
        <span><small>Cost centre</small><b class="${c.cc ? "" : "miss"}">${c.cc ? esc(ccName(c.cc)) : "Add cost centre"}</b></span>
        <span><small>Approver</small><b>${esc(approverName(c.approver))}</b></span>
        ${I("chevR")}</button>
    </div>
  </header>
  <div class="scroll"><div class="stack" style="padding-top:14px">
    ${warn.length ? `<div class="kais-tip"><img src="kais.svg" alt=""><span><b>${warn.length === 1 ? esc(warn[0].merchant) + " is" : plural(warn.length, "receipt") + " are"} over the policy limit.</b> Add a note in the description so your approver knows why, or split the claim.</span></div>` : ""}
    <div class="sec"><h2 class="sec-ic">${I("receipt")}All expenses <span class="muted" style="font-weight:600">(${rs.length})</span></h2><button class="link" data-act="xGroup">${XG === "date" ? "By date" : "By category"} ${I("chevD")}</button></div>
    ${rcGroups(rs, c, true)}
    <button class="add-row" data-act="xAddBill" data-id="${c.id}">${I("plus")}Add another receipt</button>
  </div></div>
  <div class="foot"><div class="row-btns"><button class="btn outline" data-go="#/expenses/claim/${c.id}/split" ${rs.length < 2 ? "disabled" : ""}>Split</button><button class="btn primary" style="flex:1" data-act="xSubmit" data-id="${c.id}">Submit claim</button></div></div></div>`;
}, { parent: ({ id }) => (claimOf(id)?.status === "saved" ? "#/expenses?tab=saved" : "#/expenses") });
function claimDetail(c, rs, total, q) {
  const badge = { pending: "Submitted", approved: "Approved", rejected: "Rejected", withdrawn: "Withdrawn" }[c.status] || c.status;
  const cats = [...new Set(rs.map((r) => r.cat))], dates = rs.map((r) => r.date).sort();
  const people = [...new Set([c.approver === "pr" ? "pr" : null, ...rs.flatMap((r) => r.people || [])].filter(Boolean))];
  const comments = [...(c.comments || [])];
  if (c.status === "rejected" && c.note && !comments.some((x) => x.text === c.note)) comments.push({ who: c.approver === "pr" ? "pr" : null, name: approverName(c.approver), text: c.note, ts: (c.submitted || c.created) + 864e5 });
  const kv = [["Claim ID", c.code], ["Amount", fmtCur(total, c.cur)], ["Category", cats.length === 1 ? cats[0] : `Multiple (${cats.length})`],
    ["Expense date", dates.length ? (dates[0] === dates[dates.length - 1] ? D.long(dates[0]) : `${D.short(dates[0])} – ${D.long(dates[dates.length - 1])}`) : "—"],
    ["Cost centre ID", c.cc || "—"], ["Cost centre name", ccName(c.cc)], ["Approver", approverName(c.approver)], ["Billing type", c.billing],
    c.submitted && ["Submitted on", D.long(D.iso(c.submitted))]].filter(Boolean);
  return `<div class="screen has-foot">
  <header class="cdh s-${c.status}">
    <button class="ib" data-act="back" aria-label="Back">${I("back")}</button>
    <div class="cdh-b">
      <div class="cdh-id"><span>#${esc(c.code)}</span><span class="cdh-badge">${badge}</span></div>
      <h1>${esc(claimTitle(c))}</h1>
      <div class="cdh-m"><span class="ell">${I("building")}${esc(c.entity)}</span>${people.length ? `<span class="av-stack">${people.slice(0, 3).map((p) => avatar(p, "sm")).join("")}</span>` : ""}</div>
      <div class="cdh-amt"><span><small>Amount requested</small><b>${fmtCur(total, c.cur)}</b></span><span><small>Amount paid</small><b>${fmtCur(c.paid || 0, c.cur)}</b></span></div>
    </div>
  </header>
  <div class="scroll"><div class="stack">
    ${q.new && c.status === "pending" ? `<div class="cd-done">${successTick()}<b>Claim submitted</b><span class="small muted">Sent to ${esc(approverName(c.approver))} for approval. You’ll be notified when it’s reviewed.</span></div>` : ""}
    <div class="stack s8" style="margin-top:14px">${rs.map((r) => `<button class="card cd-file" data-act="xRcView" data-id="${r.id}">${r.file?.img ? rcThumb(r) : fileIcon(r.file?.name || "receipt.pdf")}<span class="grow" style="min-width:0"><b class="ell" style="display:block">${esc(r.file?.name || r.merchant)}</b><span class="tiny muted">${esc(r.file?.size || r.merchant)}${rs.length > 1 ? ` · ${fmtCur(r.inr, c.cur)}` : ""}</span></span>${I("chevR")}</button>`).join("")}</div>
    <div class="sec"><h2 class="sec-ic">${I("list")}Expense details</h2></div>
    <div class="cd-kv">${kv.map(([k, v]) => `<div><span class="kv-ic"><i class="tint ${({ "Claim ID": "t-slate", Amount: "t-green", Category: "t-violet", "Expense date": "t-blue", "Cost centre ID": "t-amber", "Cost centre name": "t-amber", Approver: "t-pink", "Billing type": "t-teal", "Submitted on": "t-blue" })[k] || "t-slate"}">${I(({ "Claim ID": "tag", Amount: "wallet", Category: "grid", "Expense date": "calendar", "Cost centre ID": "building", "Cost centre name": "building", Approver: "user", "Billing type": "receipt", "Submitted on": "send" })[k] || "info")}</i>${k}</span><b>${esc(v)}</b></div>`).join("")}</div>
    ${rs.length > 1 ? `<div class="sec"><h2 class="sec-ic">${I("receipt")}Expenses <span class="muted" style="font-weight:600">(${rs.length})</span></h2></div>${rcGroups(rs, c, false)}` : ""}
    ${c.desc ? `<div class="cd-sec"><h2 class="sec-ic">${I("edit")}Notes</h2><p>${esc(c.desc)}</p></div>` : ""}
    <div class="cd-sec"><div class="hrow"><h2 class="grow sec-ic">${I("msg")}Comments</h2>${c.status === "pending" ? `<button class="link" data-act="xComment" data-id="${c.id}">+ Add comment</button>` : ""}</div>
      ${comments.length ? comments.map((m) => `<div class="cd-cm">${m.who ? avatar(m.who, "sm") : `<span class="av sm" style="background:var(--panel-2);color:var(--ink-3)">${I("users")}</span>`}<div class="grow"><div class="hrow"><b class="grow">${esc(m.who ? (m.who === "me" ? "You" : person(m.who).name) : m.name || "Approver")}</b><span class="tiny faint">${D.ago(m.ts)}</span></div><p>${esc(m.text)}</p></div></div>`).join("") : `<p class="small muted">No comments yet.</p>`}</div>
    <div class="sec"><h2 class="sec-ic">${I("history")}Activity</h2></div>
    ${activityFeed(claimActivity(c, comments))}
  </div></div>
  <div class="foot">${c.status === "pending" ? `<button class="btn primary block" data-act="xWithdraw" data-id="${c.id}">Withdraw claim</button>`
    : c.status === "withdrawn" || c.status === "rejected" ? `<button class="btn primary block" data-act="xReopen" data-id="${c.id}">Edit and resubmit</button>`
    : `<button class="btn ghost block" data-go="#/expenses">All claims</button>`}</div></div>`;
}
// events for the app's activity feed (same icons as request details)
function claimActivity(c, comments) {
  const ap = approverName(c.approver), t0 = c.submitted || c.created, ev = [{ text: "Claim created", ts: c.created, kind: "" }];
  if (c.submitted) ev.push({ text: `Submitted to ${ap}`, ts: c.submitted, kind: "" });
  comments.filter((m) => m.who === "me").forEach((m) => ev.push({ text: "Comment added", ts: m.ts, kind: "" }));
  if (c.status === "approved") ev.push({ text: `Approved by ${ap}`, ts: t0 + 864e5, kind: "ok" });
  if (c.status === "rejected") ev.push({ text: `Rejected by ${ap}`, ts: t0 + 864e5, kind: "bad" });
  if (c.status === "withdrawn") ev.push({ text: "Withdrawn by you", ts: c.withdrawn || Date.now(), kind: "bad" });
  return { status: c.status, activity: ev.sort((a, b) => a.ts - b.ts) };
}
act("xComment", (b) => {
  const s = openSheet({ title: "Add comment", body: `<textarea class="inp" data-t rows="3" placeholder="Add context for your approver"></textarea>`, foot: `<button class="btn primary block" data-s="ok">Add comment</button>`,
    onMount(el) { onS(el, { ok() { const v = el.querySelector("[data-t]").value.trim(); if (!v) return toast("Write a comment first", "bad"); const c = claimOf(b.dataset.id); (c.comments ||= []).push({ who: "me", text: v, ts: Date.now() }); save(); closeSheet(s); rerender(); toast("Comment added"); } }); } });
});
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
  const rs = claimReceipts(c), missing = rs.filter(needsReceipt), dups = rs.filter((r) => rcDuplicate(r, c.receipts));
  if (missing.length) return xProblem({ icon: "receipt", title: "Receipt needed", text: `${missing.map((r) => `<b>${esc(r.merchant)}</b>`).join(", ")} ${missing.length > 1 ? "are" : "is"} over ${money(RECEIPT_NEEDED_OVER)}, so ${missing.length > 1 ? "they need" : "it needs"} a receipt before you can submit.`, ok: "Add receipt", onOk() { ACTIONS.xRcOpen({ dataset: { id: missing[0].id } }); } });
  if (!navigator.onLine) return xProblem({ icon: "wifi", title: "You’re offline", text: "Your claim is saved on this phone. Connect to the internet and submit it again.", ok: "Okay" });
  if (dups.length && !b.dataset.dupok) return xProblem({ icon: "copy", tone: "warn", title: "Possible duplicate", text: `${dups.map((r) => `<b>${esc(r.merchant)}</b> (${money(r.inr)}, ${D.short(r.date)})`).join(", ")} looks the same as an expense you’ve already claimed. Submit anyway?`, ok: "Submit anyway", cancel: "Review", onOk() { ACTIONS.xSubmit({ dataset: { id: c.id, dupok: "1" } }); } });
  confirmSheet({ eyebrow: "Submit claim", text: `Submit ${esc(claimTitle(c))} for ${fmtCur(claimTotal(c), c.cur)} to ${esc(approverName(c.approver))}?`, ok: "Submit claim", onOk() {
    c.status = "pending"; c.submitted = Date.now(); save(); try { navigator.vibrate?.([18, 40, 28]); } catch {} swap(`#/expenses/claim/${c.id}?new=1`);
  } });
});
function xProblem({ icon = "alert", tone = "bad", title, text, ok = "Okay", cancel, onOk }) {
  const s = openSheet({ body: `<div class="x-prob ${tone}"><span class="x-prob-ic">${I(icon)}</span><h3>${esc(title)}</h3><p>${text}</p></div>`,
    foot: `<div class="row-btns">${cancel ? `<button class="btn outline" style="flex:1" data-s="no">${esc(cancel)}</button>` : ""}<button class="btn primary" style="flex:1" data-s="ok">${esc(ok)}</button></div>`,
    onMount(el) { onS(el, { ok() { closeSheet(s); onOk?.(); }, no() { closeSheet(s); } }); } });
  try { navigator.vibrate?.(30); } catch {}
}
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
}, { parent: ({ id }) => `#/expenses/claim/${id}`, mount() { FORM_CHECK = () => { const b = $("[data-cta]"); if (b && DRAFT) b.disabled = !DRAFT.name.trim(); }; FORM_CHECK(); } });
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
  return `<div class="screen has-foot">${topbar("Split claim", { sub: esc(claimTitle(c)), right: `<button class="ib" data-act="spHelp" aria-label="How splitting works">${I("help")}</button>` })}
  ${seg([["cc", "By cost centre"], ["cat", "By category"]], SP.by, "spBy")}
  <div class="scroll"><div class="stack">
    <div class="kais-tip"><img src="kais.svg" alt=""><span>${SP.by === "cc" ? "Pick a cost centre for each part, then press and hold a receipt to drag it to another part. Each part is submitted as its own claim." : "I grouped your receipts by category. Choose a cost centre for each — each category becomes its own claim."}</span></div>
    <div class="card sp-sum"><span><small>Total</small><b class="num">${fmtCur(total, c.cur)}</b></span><span><small>Parts</small><b>${SP.groups.length}</b></span></div>
    ${SP.groups.map((g, gi) => `<div class="card sp-g" data-g="${gi}">
      <div class="hrow"><span class="sp-n">${gi + 1}</span><b class="grow ell">${SP.by === "cat" ? esc(g.key) : g.cc ? esc(ccName(g.cc)) : "New part"}</b><span class="num"><b>${fmtCur(sums[gi], c.cur)}</b> <span class="tiny muted">${total ? Math.round(sums[gi] / total * 100) : 0}%</span></span>${SP.by === "cc" && SP.groups.length > 2 ? `<button class="ib sm" data-act="spDel" data-g="${gi}" aria-label="Remove part">${I("trash")}</button>` : ""}</div>
      <button class="inp sel" data-act="spCc" data-g="${gi}"><span class="hrow">${I("building")}<span class="${g.cc ? "" : "muted"}">${g.cc ? esc(ccName(g.cc)) : "Choose cost centre"}</span></span>${I("chevD")}</button>
      <div class="rc-list">${rs.filter((r) => SP.asg[r.id] === gi).map((r) => `<div class="rc-row ${SP.by === "cc" ? "sp-drag" : ""}" data-rid="${r.id}">${SP.by === "cc" ? `<span class="sp-grip" aria-hidden="true">${I("move")}</span>` : ""}${rcThumb(r)}<span class="grow" style="min-width:0"><b class="ell" style="display:block">${esc(r.merchant)}</b><span class="tiny muted">${D.short(r.date)} · ${esc(r.cat)}</span></span><span class="rc-amt"><b class="num">${fmtCur(r.inr, c.cur)}</b>${SP.by === "cc" ? `<button class="link" data-act="spMove" data-id="${r.id}">Move</button>` : ""}</span></div>`).join("") || `<p class="small muted" style="padding:8px 0">No receipts yet — drag one here.</p>`}</div>
    </div>`).join("")}
    ${SP.by === "cc" && SP.groups.length < COST_CENTRES.length ? `<button class="add-row" data-act="spAdd" data-newpart>${I("plus")}Add cost centre <span class="muted" style="font-weight:500">· or drop a receipt here</span></button>` : ""}
  </div></div>
  <div class="foot"><button class="btn primary block" data-act="spSubmit" ${ready ? "" : "disabled"}>${ready ? `Submit ${SP.groups.length} claims` : "Choose a cost centre and receipts for each part"}</button></div></div>`;
}, { parent: ({ id }) => `#/expenses/claim/${id}`, mount() { spDragMount(); if (SP?.by === "cc" && !S.seen?.split) setTimeout(() => splitGuide(), 450); } });
// ── drag a receipt to another part: press and hold (touch) or drag (mouse) ──
function spDragMount() {
  const sc = $(".screen .scroll"); if (!sc || SP?.by !== "cc") return;
  let st = null; // { row, id, x0, y0, timer, on, from }
  const scaleOf = (el) => el.getBoundingClientRect().width / (el.offsetWidth || 1) || 1;
  const targetAt = (x, y) => document.elementFromPoint(x, y)?.closest(".sp-g[data-g], [data-newpart]");
  const clearHi = () => $$(".sp-g.drop-on, [data-newpart].drop-on").forEach((e) => e.classList.remove("drop-on"));
  const begin = () => {
    st.on = true; st.row.classList.add("dragging"); document.body.classList.add("sp-dragging");
    try { navigator.vibrate?.(12); } catch {}
  };
  const move = (e) => {
    if (!st) return;
    const dx = e.clientX - st.x0, dy = e.clientY - st.y0;
    if (!st.on) { if (Math.hypot(dx, dy) > 8) { if (st.touch) return end(); begin(); } else return; }
    const k = scaleOf(st.row);
    st.row.style.transform = `translate(${dx / k}px, ${dy / k}px) scale(1.03)`;
    clearHi(); const t = targetAt(e.clientX, e.clientY); if (t && Number(t.dataset.g) !== st.from) t.classList.add("drop-on");
    // auto-scroll near the edges
    const r = sc.getBoundingClientRect();
    if (e.clientY < r.top + 50) sc.scrollTop -= 10; else if (e.clientY > r.bottom - 50) sc.scrollTop += 10;
  };
  const end = (e) => {
    if (!st) return;
    clearTimeout(st.timer);
    const s0 = st; st = null; document.body.classList.remove("sp-dragging");
    removeEventListener("pointermove", move); removeEventListener("pointerup", end); removeEventListener("pointercancel", end); removeEventListener("touchmove", block);
    if (!s0.on) return;
    const t = e && e.type === "pointerup" ? targetAt(e.clientX, e.clientY) : null; clearHi();
    if (t && t.hasAttribute("data-newpart")) { SP.groups.push({ key: "", cc: "" }); SP.asg[s0.id] = SP.groups.length - 1; rerender(); toast("Moved to a new part — choose its cost centre"); return; }
    if (t && Number(t.dataset.g) !== s0.from) { SP.asg[s0.id] = Number(t.dataset.g); const g = SP.groups[SP.asg[s0.id]]; rerender(); toast(`Moved to ${g.cc ? ccName(g.cc) : "part " + (SP.asg[s0.id] + 1)}`); return; }
    s0.row.classList.add("returning"); s0.row.style.transform = ""; s0.row.classList.remove("dragging"); setTimeout(() => s0.row.classList.remove("returning"), 250);
  };
  const block = (e) => { if (st?.on) e.preventDefault(); };
  sc.addEventListener("pointerdown", (e) => {
    const row = e.target.closest(".rc-row.sp-drag[data-rid]"); if (!row || e.target.closest("button") || st) return;
    st = { row, id: row.dataset.rid, x0: e.clientX, y0: e.clientY, on: false, touch: e.pointerType !== "mouse", from: SP.asg[row.dataset.rid] };
    if (st.touch) st.timer = setTimeout(() => { if (st && !st.on) begin(); }, 260); // long-press on touch so normal scrolling still works
    addEventListener("pointermove", move); addEventListener("pointerup", end); addEventListener("pointercancel", end);
    addEventListener("touchmove", block, { passive: false });
  });
}

// ── first-run guide for splitting ──
function splitGuide() {
  (S.seen ||= {}).split = true; save();
  const steps = [
    { art: "sg-a1", t: "Pick a cost centre for each part", d: "Each part of the claim gets its own cost centre — tap the dropdown on a part to choose one." },
    { art: "sg-a2", t: "Drag receipts between parts", d: "Press and hold a receipt, then drag it onto another part. Prefer tapping? Use Move." },
    { art: "sg-a3", t: "Submit — one claim per part", d: "Each part goes to your approver as its own claim, so each cost centre is billed correctly." },
  ];
  let i = 0;
  const art = (k) => k === "sg-a1"
    ? `<div class="sg-art sg-a1"><div class="sg-card"><i class="sg-n">1</i><span class="sg-sel">KEBS – Projects<b>⌄</b></span></div><div class="sg-card"><i class="sg-n">2</i><span class="sg-sel on">KEBS – Design<b>⌄</b></span></div></div>`
    : k === "sg-a2"
    ? `<div class="sg-art sg-a2"><div class="sg-card top"><i class="sg-n">1</i><span class="sg-line"></span><span class="sg-line s"></span></div><div class="sg-card bot"><i class="sg-n">2</i><span class="sg-line s"></span></div><div class="sg-chip"><span class="sg-dot"></span>Starbucks<b>$31</b></div><span class="sg-hand">${I("move")}</span></div>`
    : `<div class="sg-art sg-a3"><div class="sg-claim"><span class="sg-tick">${I("check")}</span>Claim 1<b>Projects</b></div><div class="sg-claim d2"><span class="sg-tick">${I("check")}</span>Claim 2<b>Design</b></div></div>`;
  const s = openSheet({ title: "How splitting works", cls: "sg-sheet", body: `<div data-sg></div>`, foot: `<div class="row-btns"><button class="btn ghost" data-s="skip">Skip</button><button class="btn primary" style="flex:1" data-s="next"></button></div>`,
    onMount(el) {
      const draw = () => {
        const st = steps[i];
        el.querySelector("[data-sg]").innerHTML = `${art(st.art)}<div class="sg-dots">${steps.map((_, j) => `<i class="${j === i ? "on" : ""}"></i>`).join("")}</div><h3 class="sg-t">${st.t}</h3><p class="sg-d">${st.d}</p>`;
        el.querySelector("[data-s=next]").textContent = i < steps.length - 1 ? "Next" : "Get started";
        el.querySelector("[data-s=skip]").hidden = i === steps.length - 1;
      };
      onS(el, { next() { if (i < steps.length - 1) { i++; draw(); } else closeSheet(s); }, skip() { closeSheet(s); } });
      draw();
    } });
}
act("spHelp", () => splitGuide());
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

// success sheet (PhonePe-style): the animated tick, a title, one line, a short summary and Done
function successSheet({ title, sub = "", rows = [], cta = "Done", go = null, alt = null }) {
  try { navigator.vibrate?.([18, 40, 28]); } catch {}
  const s = openSheet({ title: "", cls: "ok-sheet", body: `<div class="ok-box">${successTick()}<h2>${title}</h2>${sub ? `<p class="muted">${sub}</p>` : ""}
      ${rows.length ? `<div class="ok-rows">${rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("")}</div>` : ""}</div>`,
    foot: alt ? `<div class="row-btns"><button class="btn outline" style="flex:1" data-s="alt">${alt.label}</button><button class="btn primary" style="flex:1" data-s="ok">${cta}</button></div>` : `<button class="btn primary block" data-s="ok">${cta}</button>`,
    onMount(el) { onS(el, { ok() { closeSheet(s); if (go) go(); }, alt() { closeSheet(s); alt.go?.(); } }); } });
  return s;
}
// a request just went in: open it and celebrate
function requestDone(r) {
  swap(`#/request/${r.id}`);
  const T2 = REQ_TYPES[r.type] || { short: "Request" }, lt = r.type === "leave" && LEAVE_TYPES.find((l) => l.id === r.leaveType);
  const days = r.dayType === "half" ? 0.5 : D.workdays(r.from, r.to);
  setTimeout(() => successSheet({ title: `${lt ? lt.name : T2.short} request submitted`, sub: `Sent to ${esc(person(S.me.manager || "pr").name)} for approval. We’ll let you know when it’s decided.`,
    rows: [["Dates", r.from === r.to ? D.nice(r.from) : D.range(r.from, r.to)], ...(r.type === "leave" || r.type === "compoff" || r.type === "wfh" ? [["Days", plural(days, "day")]] : []), ["Status", "Pending approval"]] }), 220);
}

// animated success tick (claim submitted): circle pops, check draws, rings ripple, confetti bursts
function successTick() {
  const bits = Array.from({ length: 12 }, (_, i) => `<i style="--a:${i * 30}deg;--d:${(i % 3) * 0.04}s;--c:${["#22c55e", "#f97316", "#facc15", "#3b82f6"][i % 4]}"></i>`).join("");
  return `<div class="s-tick" role="img" aria-label="Success"><span class="tick-ring"></span><span class="tick-ring r2"></span><span class="tick-bits">${bits}</span>
    <svg viewBox="0 0 96 96"><circle class="tick-c" cx="48" cy="48" r="44"/><path class="tick-p" d="M29 49.5 L42 62 L67 35"/></svg></div>`;
}
