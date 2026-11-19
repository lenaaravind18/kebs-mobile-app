// Corporate card — the card inbox from the KEBS web expense module (support-dashboard: expenses/card-inbox),
// made for a phone. Charges come from the bank feed; each one is a business expense to put on a claim (with its
// receipt) or personal (recovered from payroll). Card-paid lines are never reimbursed: the company already paid.
// Data: S.cards = { list: [card], txns: [charge] }  (demo workspace; KEBS getCorporateCards is the live source later)

const CC_NUDGE = 3, CC_EXPLAIN = 30, CC_RECEIPT_OVER = 500;
const CC_LOGO = { uber: "uber.svg", swiggy: "swiggy.svg", indigo: "indigo.svg", amazon: "amazon.svg", airtel: "airtel.svg", starbucks: "starbucks.svg", netflix: "netflix.svg", ola: "ola.svg", zoom: "zoom.svg", linkedin: "linkedin.svg", taj: "taj.png" };
const CC_ST = { receipt: ["Needs receipt", "var(--warn, #b45309)"], ready: ["Ready to claim", "var(--ok, #15803d)"], claimed: ["On a claim", "var(--ink-3)"], personal: ["Personal", "var(--ink-3)"] };
// app categories the card charge maps to (the claimer can change it on the claim)
const CC_CAT = { Travel: "Travel", Food: "Food & Beverages", Accommodation: "Accommodation", "Office supplies": "Other", "Internet & phone": "Internet", Software: "Software", "Local conveyance": "Local conveyance" };

function seedCardsData() {
  const now = Date.now(), day = (n) => D.add(D.today(), -n);
  let n = 5580;
  const T = (d, merchant, amount, o = {}) => ({ id: "tx" + ++n, cardId: "cc1", date: day(d), merchant, amount, cat: "Travel", business: 90, at: now - d * 864e5, ...o,
    status: o.status || (amount > CC_RECEIPT_OVER && !o.receipt ? "receipt" : "ready") });
  return {
    list: [{ id: "cc1", programme: "HDFC Corporate", issuer: "HDFC Bank", network: "VISA", last4: "4417", holder: fullName(), limit: 150000, feedAt: now - 3 * 36e5 }],
    txns: [
      T(1, "Uber", 486, { cat: "Local conveyance" }), T(2, "Swiggy", 1240, { cat: "Food", business: 72 }), T(3, "IndiGo", 8960),
      T(3, "Taj Coromandel", 7900, { cat: "Accommodation", logo: "taj" }), T(4, "Amazon", 3299, { cat: "Office supplies", business: 56 }),
      T(6, "Airtel", 799, { cat: "Internet & phone", receipt: { name: "airtel-bill.pdf" } }), T(9, "Starbucks", 640, { cat: "Food", business: 64 }),
      T(12, "Netflix", 649, { cat: "Software", status: "personal", personalReason: "My subscription, charged by mistake", business: 8 }),
      T(4, "Ola", 420, { status: "claimed", receipt: { name: "ola-trip.pdf" } }),
    ],
  };
}
if (!S.cards) { S.cards = seedCardsData(); save(); }
{ const base = resetDemo; resetDemo = function () { base(); S.cards = seedCardsData(); save(); }; }

const ccCard = () => S.cards.list[0];
const ccTxn = (id) => S.cards.txns.find((t) => t.id === id);
const ccNeeds = (t) => t.amount > CC_RECEIPT_OVER && !t.receipt;
const ccStatus = (t) => (t.status === "receipt" || t.status === "ready" ? (ccNeeds(t) ? "receipt" : "ready") : t.status);
const ccOpen = () => S.cards.txns.filter((t) => ["receipt", "ready"].includes(t.status));
const ccSpent = () => S.cards.txns.filter((t) => t.cardId === ccCard().id && t.date.slice(0, 7) === D.today().slice(0, 7)).reduce((a, t) => a + t.amount, 0);
const ccDueIn = (t) => CC_EXPLAIN - D.diff(t.date, D.today());
const ccMoney = (n) => fmtCur(n);
const ccLogo = (t) => { const k = t.logo || String(t.merchant).toLowerCase().split(/\s+/)[0]; return CC_LOGO[k]
  ? `<span class="cc-logo"><img src="assets/vendors/${CC_LOGO[k]}" alt=""></span>` : `<span class="cc-logo txt">${esc(t.merchant[0] || "?")}</span>`; };
const ccAgo = (ts) => { const m = Math.max(1, Math.round((Date.now() - ts) / 6e4)); return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };

// the card itself (calm dark gradient, like a real corporate card)
function ccVisual(c) {
  const spent = ccSpent(), pct = Math.min(100, (spent / c.limit) * 100);
  return `<div class="cc-card"><span class="cc-shine" aria-hidden="true"></span>
      <div class="cc-top"><span><b>${esc(c.programme)}</b><small>${esc(c.issuer)}</small></span><span class="cc-net">${esc(c.network)}</span></div>
      <div class="cc-num">•••• •••• •••• ${esc(c.last4)}</div>
      <div class="cc-bot"><span>${esc(c.holder)}</span><span class="cc-chip" aria-hidden="true"></span></div>
    </div>
    <div class="cc-limit"><div class="hrow"><span class="grow"><b>${ccMoney(spent)}</b> <span class="muted">spent this month</span></span><span class="small muted">of ${ccMoney(c.limit)}</span></div>
      <div class="cc-bar" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
      <span class="tiny muted">Bank feed updated ${ccAgo(c.feedAt)} · ${ccMoney(Math.max(0, c.limit - spent))} left</span></div>`;
}
function ccRow(t, pick) {
  const st = ccStatus(t), [label, col] = CC_ST[st], due = ["receipt", "ready"].includes(st) ? ccDueIn(t) : null;
  return `<div class="cc-row ${pick && pick.includes(t.id) ? "on" : ""}">
    ${pick ? `<button class="cc-pick" data-act="ccPick" data-id="${t.id}" aria-pressed="${pick.includes(t.id)}" aria-label="Choose ${esc(t.merchant)}"><span class="ccp">${I("check")}</span></button>` : ""}
    <button class="cc-open" data-act="ccOpen" data-id="${t.id}">${ccLogo(t)}<span class="grow" style="min-width:0"><b class="ell">${esc(t.merchant)}</b>
      <span class="small muted ell">${D.short(t.date)} · ${esc(t.cat)}</span></span>
      <span class="cc-amt"><b class="num">${ccMoney(t.amount)}</b><small style="color:${col}">${label}${due != null && due <= 7 ? ` · ${due}d left` : ""}</small></span></button>
  </div>`;
}

let CC_PICK = [];
route("expenses/card", (_, q) => {
  const c = ccCard(), tab = q.tab || "todo", f = q.f || "";
  const open = ccOpen(), receipt = open.filter((t) => ccStatus(t) === "receipt"), ready = open.filter((t) => ccStatus(t) === "ready");
  const due = open.filter((t) => ccDueIn(t) <= 7), personal = S.cards.txns.filter((t) => t.status === "personal"), claimed = S.cards.txns.filter((t) => t.status === "claimed");
  const sum = (l) => l.reduce((a, t) => a + t.amount, 0);
  let list = tab === "todo" ? open : tab === "claimed" ? claimed : personal;
  if (tab === "todo" && f === "receipt") list = receipt; else if (tab === "todo" && f === "ready") list = ready; else if (tab === "todo" && f === "due") list = due;
  list = list.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  CC_PICK = CC_PICK.filter((id) => ccTxn(id) && ["receipt", "ready"].includes(ccTxn(id).status));
  const fig = (k, label, n, sub) => `<button class="cc-fig ${f === k ? "on" : ""}" data-act="ccFig" data-v="${k}" aria-pressed="${f === k}"><b class="num">${n}</b><span>${label}</span><small>${sub}</small></button>`;
  const picked = CC_PICK.map(ccTxn).filter(Boolean);
  return `<div class="screen ${picked.length ? "has-foot" : ""}">${topbar("Corporate card")}
    <div class="scroll">
      ${ccVisual(c)}
      <div class="cc-figs">
        ${fig("receipt", "Need receipt", receipt.length, receipt.length ? ccMoney(sum(receipt)) : "All in")}
        ${fig("ready", "Ready to claim", ready.length, ready.length ? ccMoney(sum(ready)) : "Nothing ready")}
        ${fig("due", "Due this week", due.length, due.length ? "Explain soon" : "Nothing close")}
      </div>
      ${seg([["todo", `To do (${open.length})`], ["claimed", `On claims (${claimed.length})`], ["personal", `Personal (${personal.length})`]], tab, "ccTab")}
      ${tab === "todo" && open.length ? `<p class="small muted" style="margin:10px 2px 0">Tick charges to put them on one claim, or tap one to add its receipt.</p>` : ""}
      ${tab === "personal" && personal.length ? `<p class="small muted" style="margin:10px 2px 0">${ccMoney(sum(personal))} will be recovered from your next payroll.</p>` : ""}
      <div class="cc-list">${list.length ? list.map((t) => ccRow(t, tab === "todo" ? CC_PICK : null)).join("")
        : emptyState(["wallet", "check", "receipt"], tab === "todo" ? (f ? "Nothing here" : "All caught up") : tab === "claimed" ? "No charges on claims" : "No personal charges",
          tab === "todo" ? "New card charges show up here from the bank feed." : tab === "claimed" ? "Charges you put on a claim show up here." : "Charges you mark personal show up here.")}</div>
    </div>
    ${picked.length ? `<div class="foot"><button class="btn primary block" data-act="ccClaim">${I("plus")}Put ${picked.length} on a claim · ${ccMoney(sum(picked))}</button></div>` : ""}
  </div>`;
});
act("ccTab", (b) => { CC_PICK = []; swap(`#/expenses/card?tab=${b.dataset.v}`); });
act("ccFig", (b) => { const q = parseHash().q; swap(`#/expenses/card?tab=todo${q.f === b.dataset.v ? "" : `&f=${b.dataset.v}`}`); });
act("ccPick", (b) => { const id = b.dataset.id; CC_PICK = CC_PICK.includes(id) ? CC_PICK.filter((x) => x !== id) : [...CC_PICK, id]; rerender(); });

// one charge: details, Kais check, receipt, claim or personal
act("ccOpen", (b) => {
  const t = ccTxn(b.dataset.id); if (!t) return;
  const st = ccStatus(t), biz = t.business >= 75;
  const s = openSheet({ title: esc(t.merchant),
    body: `<div class="stack">
      <div class="hrow">${ccLogo(t)}<span class="grow"><b style="display:block;font-size:22px" class="num">${ccMoney(t.amount)}</b><span class="small muted">${D.long(t.date)} · •••• ${esc(ccCard().last4)}</span></span></div>
      <div class="cc-kais ${biz ? "ok" : "warn"}"><img src="kais.svg" alt="" width="20" height="20"><span class="grow"><b>${biz ? "Looks like a business expense" : "Might be personal"}</b><small>Kais is ${t.business}% sure from the merchant and your past claims.</small></span></div>
      <div class="card"><div class="kv"><span>Category</span><span>${esc(t.cat)}</span></div><div class="kv"><span>Status</span><span>${CC_ST[st][0]}</span></div>
        ${["receipt", "ready"].includes(st) ? `<div class="kv"><span>Explain by</span><span>${D.short(D.add(t.date, CC_EXPLAIN))} · ${Math.max(0, ccDueIn(t))} days left</span></div>` : ""}
        <div class="kv"><span>Receipt</span><span>${t.receipt ? `${I("clip")}${esc(t.receipt.name)}` : t.amount > CC_RECEIPT_OVER ? `<span style="color:var(--warn,#b45309)">Needed over ${ccMoney(CC_RECEIPT_OVER)}</span>` : "Not needed"}</span></div>
        ${t.status === "personal" ? `<div class="kv"><span>Reason</span><span>${esc(t.personalReason || "Personal")}</span></div>` : ""}</div>
      ${["receipt", "ready"].includes(st) ? `<div class="cc-personal" hidden><div class="field"><label for="cc-r">Why is it personal?</label><input id="cc-r" class="inp" data-r placeholder="Ex: My subscription, charged by mistake"></div>
        <p class="tiny muted" style="margin:0">${ccMoney(t.amount)} is recovered from your next payroll.</p></div>` : ""}
    </div>`,
    foot: t.status === "personal" || t.status === "claimed"
      ? `<button class="btn outline block" data-s="undo">${I("history")}${t.status === "personal" ? "Not personal, move back" : "Take off the claim"}</button>`
      : `<div class="stack s6"><button class="btn outline block" data-s="rcpt">${I("clip")}${t.receipt ? "Replace receipt" : "Add receipt"}</button>
         <div class="row-btns"><button class="btn outline" style="flex:1" data-s="pers">Personal</button><button class="btn primary" style="flex:1" data-s="claim">${I("plus")}Put on a claim</button></div></div>`,
    onMount(el) {
      onS(el, {
        rcpt() { pickReceipts({ multiple: false, capture: true, onFiles(files) { const f = files[0]; if (!f) return; t.receipt = { name: f.name, img: f.img }; t.status = "ready"; save(); closeSheet(s); rerender(); toast("Receipt added"); } }); },
        pers(btn) {
          const box = el.querySelector(".cc-personal");
          if (box.hidden) { box.hidden = false; btn.textContent = "Mark personal"; btn.classList.replace("outline", "danger"); setTimeout(() => el.querySelector("[data-r]").focus(), 50); return; }
          const r = el.querySelector("[data-r]").value.trim(); if (!r) { el.querySelector("[data-r]").focus(); return toast("Add a short reason", "bad"); }
          const prev = t.status; t.status = "personal"; t.personalReason = r; CC_PICK = CC_PICK.filter((x) => x !== t.id); save(); closeSheet(s); rerender();
          undoToast(`${t.merchant} marked personal`, () => { t.status = prev; delete t.personalReason; save(); rerender(); });
        },
        claim() { closeSheet(s); ccMakeClaim([t]); },
        undo() {
          if (t.status === "claimed" && t.claimId) { const c = claimOf(t.claimId); if (c) { const rid = "cr-" + t.id; c.receipts = c.receipts.filter((x) => x !== rid); S.receipts = S.receipts.filter((r) => r.id !== rid); if (!c.receipts.length) S.claims = S.claims.filter((x) => x.id !== c.id); } }
          t.status = ccNeeds(t) ? "receipt" : "ready"; delete t.personalReason; delete t.claimId; save(); closeSheet(s); rerender(); toast("Moved back to To do");
        },
      });
    } });
});
act("ccClaim", () => ccMakeClaim(CC_PICK.map(ccTxn).filter(Boolean)));

// card charges → one claim (saved, to review and submit). Lines are card-paid: not reimbursed.
function ccMakeClaim(txns) {
  if (!txns.length) return;
  const missing = txns.filter(ccNeeds);
  if (missing.length) return toast(`Add the receipt for ${missing.map((t) => t.merchant).join(", ")} first`, "bad");
  const cid = uid(), rids = [];
  txns.forEach((t) => {
    const rid = "cr-" + t.id; rids.push(rid);
    S.receipts.push({ id: rid, rid: "CC" + t.id.slice(2), cur: "INR", amt: t.amount, inr: t.amount, merchant: t.merchant, cat: CC_CAT[t.cat] || t.cat, date: t.date, desc: "", pay: "Corporate card", paidBy: "Company",
      card: t.cardId, people: [], project: "", taxPct: 0, file: t.receipt ? { name: t.receipt.name, img: t.receipt.img } : { name: "card-charge.pdf" }, claim: cid });
    t.status = "claimed"; t.claimId = cid;
  });
  S.claims.unshift({ id: cid, code: nextCode(), name: txns.length > 1 ? `Card charges – ${D.f(D.today(), { day: "numeric", month: "short" })}` : txns[0].merchant, status: "saved", cc: "", approver: "pr", entity: ENTITIES[0],
    billing: "Billable", desc: "Corporate card charges", cur: "INR", receipts: rids, created: Date.now(), submitted: null, paid: 0, note: "", card: true });
  CC_PICK = []; save();
  swap(`#/expenses/claim/${cid}`); toast(`${txns.length > 1 ? `${txns.length} charges` : txns[0].merchant} on a claim · review and submit`);
}

// entry point on My expenses (demo workspace; live KEBS cards come later)
ROUTES.forEach((r) => {
  if (r.re.source !== "^expenses$") return;
  const prev = r.render;
  r.render = (m, q, ...rest) => {
    const out = prev(m, q, ...rest);
    if (typeof out !== "string" || (typeof klOn === "function" && klOn()) || (q && q.tab && q.tab !== "claims")) return out;
    const c = ccCard(), open = ccOpen(), need = open.filter((t) => ccStatus(t) === "receipt").length;
    const strip = `<button class="card hrow cc-entry" data-go="#/expenses/card"><span class="cc-mini" aria-hidden="true">${esc(c.network)}</span><span class="grow" style="min-width:0"><b style="display:block">Corporate card •••• ${esc(c.last4)}</b>
      <span class="small muted">${open.length ? `${open.length} charge${open.length === 1 ? "" : "s"} to explain${need ? ` · ${need} need receipt${need === 1 ? "" : "s"}` : ""}` : "All charges explained"}</span></span><span class="chev">${I("chevR")}</span></button>`;
    return out.replace('<div class="scroll">', `<div class="scroll">${strip}`);
  };
});
