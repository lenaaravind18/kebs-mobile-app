// Trips & advances and Repeating claims, from the KEBS web expense module (support-dashboard: expenses/travel,
// expenses/repeating), made for a phone.
// Trips are approved before you travel (with an estimate from one city rate table); an advance is money paid up
// front. A trip's claims pay back its advance first; closing the trip recovers what is left through payroll.
// Repeating claims: a monthly bill set up once; each month's claim is drafted on the day and auto-approved while
// it stays within 10% of the approved amount.
// Data: S.travel = { trips, advances }, S.repeat = [schedule]  (demo workspace)

// ── one rate table for the estimate, per diem and the trip check ──
const TV_RATE = { Metro: { hotel: 7000, perDiem: 1800 }, "Tier 2": { hotel: 5000, perDiem: 1200 }, Other: { hotel: 3500, perDiem: 900 } };
const TV_CITY = { Mumbai: "Metro", Delhi: "Metro", Bengaluru: "Metro", Chennai: "Metro", Hyderabad: "Metro", Kolkata: "Metro",
  Pune: "Tier 2", Kochi: "Tier 2", Jaipur: "Tier 2", Ahmedabad: "Tier 2", Coimbatore: "Tier 2", Mysuru: "Other", Madurai: "Other", Vizag: "Other" };
const TV_MODES = ["Flight", "Train", "Own car"];
const TV_FARE = { Flight: 9000, Train: 2400, "Own car": 3000 };
const TV_MODE_IC = { Flight: "plane", Train: "ticket", "Own car": "pin" };
const TV_LOCAL = 600, TV_SETTLE = 15, TV_ADV_SHARE = 0.8, TV_PETTY_MAX = 10000, TV_SALARY_MAX = 100000, TV_INST = [1, 3, 6, 9, 12];
const TV_ADV_TYPE = { travel: "Travel advance", petty: "Petty cash", salary: "Salary advance" };
const TV_COL = { blue: "#2a78d6", ok: "var(--ok, #15803d)", warn: "var(--warn, #b45309)", bad: "var(--bad, #d14343)", mute: "var(--ink-3)" };
const TV_TRIP_ST = { requested: ["Awaiting approval", "blue"], approved: ["Approved", "ok"], rejected: ["Rejected", "bad"], closed: ["Closed", "mute"] };
const TV_ADV_ST = { requested: ["Awaiting approval", "blue"], approved: ["With Finance to pay", "blue"], rejected: ["Rejected", "bad"], paid: ["Paid to you", "ok"], settled: ["Settled", "mute"] };

const tvRate = (city) => TV_RATE[TV_CITY[city] || "Other"];
const tvNights = (a, b) => Math.max(0, D.diff(a, b));
function tvEstimate(to, mode, start, end) {
  const r = tvRate(to), days = start && end ? D.days(start, end) : 1;
  return { fare: TV_FARE[mode] || 0, hotel: r.hotel * (start && end ? tvNights(start, end) : 0), perDiem: r.perDiem * days, local: TV_LOCAL * days };
}
const tvEstTotal = (e) => e.fare + e.hotel + e.perDiem + e.local;
const tvMoney = (n) => fmtCur(Math.round(n));
const tvTxt = (label, tone) => `<small style="color:${TV_COL[tone]}">${label}</small>`;

function seedTravelData() {
  const day = (n) => D.add(D.today(), n), at = (n) => D.parse(day(n)).getTime() + 10 * 36e5, me = "You", ap = person("pr").name;
  const E = (n, who, text, snip) => ({ at: at(n), who, text, ...(snip ? { snip } : {}) });
  const trip = (t) => ({ ...t, estimate: tvEstimate(t.to, t.mode, t.start, t.end) });
  return {
    trips: [
      trip({ id: "tr115", code: "TR-115", purpose: "Northwind site visit", from: "Bengaluru", to: "Chennai", start: day(-5), end: day(-4), mode: "Flight", cc: "CKTKEBS25-IMP", billable: true, status: "approved", spent: 14320, events: [E(-12, me, "requested the trip"), E(-11, ap, "approved it")] }),
      trip({ id: "tr118", code: "TR-118", purpose: "Zifo lab audit", from: "Bengaluru", to: "Pune", start: day(6), end: day(9), mode: "Flight", cc: "CKTZIFO-INT", billable: true, status: "approved", spent: 0, events: [E(-3, me, "requested the trip"), E(-2, ap, "approved it")] }),
      trip({ id: "tr121", code: "TR-121", purpose: "Contoso quarterly review", from: "Bengaluru", to: "Mumbai", start: day(20), end: day(22), mode: "Flight", cc: "CKTKEBS25-PRJ", billable: true, status: "requested", spent: 0, events: [E(-1, me, "requested the trip")] }),
      trip({ id: "tr112", code: "TR-112", purpose: "Client visit", from: "Chennai", to: "Bengaluru", start: day(-27), end: day(-26), mode: "Flight", cc: "CKTKEBS25-IMP", billable: true, status: "closed", spent: 9100, closedAt: at(-10), events: [E(-34, me, "requested the trip"), E(-33, ap, "approved it"), E(-10, me, "closed the trip", "Advance settled")] }),
    ],
    advances: [
      { id: "ad201", code: "AD-201", type: "travel", amount: 15000, reason: "Northwind visit: hotel and local travel", tripId: "tr115", status: "paid", requested: at(-12), paidAt: at(-9), settleBy: day(-4 + TV_SETTLE), settled: 0, events: [E(-12, me, "requested the advance"), E(-11, ap, "approved it"), E(-9, "Finance", "paid it", "₹15,000 · NEFT")] },
      { id: "ad202", code: "AD-202", type: "travel", amount: 12000, reason: "Pune audit: hotel for three nights", tripId: "tr118", status: "requested", requested: at(-2), settled: 0, events: [E(-2, me, "requested the advance")] },
      { id: "ad190", code: "AD-190", type: "travel", amount: 8000, reason: "Bengaluru client visit", tripId: "tr112", status: "settled", requested: at(-34), paidAt: at(-31), settleBy: day(-26 + TV_SETTLE), settled: 8000, events: [E(-34, me, "requested the advance"), E(-31, "Finance", "paid it"), E(-10, "", "settled it", "₹8,000 offset against the trip’s claims")] },
      { id: "ad185", code: "AD-185", type: "salary", amount: 30000, reason: "Medical expenses", status: "paid", requested: at(-75), paidAt: at(-70), instalments: 6, settled: 0, events: [E(-75, me, "requested the advance", "6 monthly instalments"), E(-73, ap, "approved it"), E(-70, "Finance", "paid it")] },
      { id: "ad199", code: "AD-199", type: "petty", amount: 5000, reason: "Office pantry and courier for the Chennai team", status: "approved", requested: at(-4), settled: 0, events: [E(-4, me, "requested the advance"), E(-3, ap, "approved it")] },
    ],
  };
}

// ── repeating claims ──
const RP_TOL = 0.1;
const RP_ST = { active: ["Active", "ok"], pending: ["Awaiting approval", "blue"], paused: ["Paused", "mute"], stopped: ["Stopped", "mute"] };
const RP_STEPS = [["drafted", "Drafted"], ["bill", "Bill added"], ["submitted", "Sent"], ["approved", "Approved"], ["paid", "Paid"]];
const RP_RUNS = [[6, "6 mo"], [12, "12 mo"], [24, "24 mo"], [0, "No end date"]];
const RP_LOGO = { jio: "jio.svg", act: "act.svg", airtel: "airtel.svg", linkedin: "linkedin.svg", microsoft: "microsoft.svg", zoom: "zoom.svg", vi: "", netflix: "netflix.svg", amazon: "amazon.svg" };
const rpCap = (s) => Math.round(s.amount * (1 + RP_TOL));
const ymOf = (iso) => iso.slice(0, 7);
function rpMonthDay(n, day) { const d = D.parse(D.today()); return D.iso(new Date(d.getFullYear(), d.getMonth() - n, day)); }

function seedRepeatData() {
  const past = (n, day, amount, code, sampled = false) => { const d = rpMonthDay(n, day), s = (k) => D.add(d, k);
    return { month: ymOf(d), amount, code, approvedBy: "auto", sampled, steps: { drafted: s(0), bill: s(1), submitted: s(1), approved: s(1), paid: s(7) } }; };
  const start = (n, day) => rpMonthDay(n, day);
  const S6 = (o) => ({ cat: "Internet", cc: "CKTKEBS25-IMP", fixed: true, months: 12, ...o, validUntil: o.approvedOn ? D.addMonths(o.approvedOn, 12) : null });
  return [
    S6({ id: "rp1", name: "Mobile: Jio postpaid", vendor: "Jio", amount: 599, day: 8, start: start(4, 8), status: "active", approvedOn: start(4, 8), history: [past(1, 8, 599, "CL-8994"), past(2, 8, 599, "CL-8961", true), past(3, 8, 599, "CL-8930"), past(4, 8, 599, "CL-8902")] }),
    S6({ id: "rp2", name: "Home internet: ACT Fibernet", vendor: "ACT Fibernet", fixed: false, amount: 1179, day: 3, start: start(2, 3), status: "active", approvedOn: start(2, 3),
      history: [{ month: ymOf(D.today()), steps: { drafted: rpMonthDay(0, 3) } }, past(1, 3, 1179, "CL-8990"), past(2, 3, 1162, "CL-8957")] }),
    S6({ id: "rp3", name: "LinkedIn Learning", vendor: "LinkedIn", cat: "Software", amount: 1650, day: 1, months: 0, start: start(6, 1), status: "paused", approvedOn: start(6, 1), pausedOn: rpMonthDay(1, 1),
      history: [past(2, 1, 1650, "CL-8950"), past(3, 1, 1650, "CL-8921"), past(4, 1, 1650, "CL-8899")] }),
    S6({ id: "rp4", name: "Office phone: Airtel postpaid", vendor: "Airtel", cc: "CKTKEBS25-PRJ", amount: 799, day: 12, start: start(3, 12), status: "active", approvedOn: start(3, 12), history: [past(1, 12, 799, "CL-8998"), past(2, 12, 799, "CL-8966"), past(3, 12, 799, "CL-8934", true)] }),
    S6({ id: "rp5", name: "Microsoft 365 Business", vendor: "Microsoft", cat: "Software", amount: 1450, day: 5, start: start(5, 5), status: "active", approvedOn: start(5, 5), history: [past(1, 5, 1450, "CL-8992"), past(2, 5, 1450, "CL-8959"), past(3, 5, 1450, "CL-8927", true)] }),
    S6({ id: "rp6", name: "Zoom Pro", vendor: "Zoom", cat: "Software", cc: "CKTKEBS25-PRJ", amount: 1300, day: 20, start: D.today(), status: "pending", history: [] }),
  ];
}
if (!S.travel) { S.travel = seedTravelData(); save(); }
if (!S.repeat) { S.repeat = seedRepeatData(); save(); }
{ const base = resetDemo; resetDemo = function () { base(); S.travel = seedTravelData(); S.repeat = seedRepeatData(); save(); }; }

// ── travel helpers ──
const tvTrip = (id) => S.travel.trips.find((t) => t.id === id);
const tvAdv = (id) => S.travel.advances.find((a) => a.id === id);
const tvTripAdv = (t) => S.travel.advances.find((a) => a.tripId === t.id && a.status !== "rejected");
const tvSpent = (t) => (t.spent || 0) + S.claims.filter((c) => c.trip === t.id && c.status !== "withdrawn").reduce((a, c) => a + claimTotal(c), 0);
function tvBalance(a) {
  if (a.status !== "paid") return 0;
  if (a.type === "salary" && a.instalments && a.paidAt) { const m = Math.min(a.instalments, Math.floor((Date.now() - a.paidAt) / (30 * 864e5))); return Math.max(0, a.amount - Math.round((a.amount / a.instalments) * m)); }
  return Math.max(0, a.amount - a.settled);
}
function tvAgeing(a) {
  if (a.status !== "paid" || !a.settleBy || a.type === "salary") return null;
  const left = D.diff(D.today(), a.settleBy);
  return left < 0 ? [`Overdue ${-left} d`, "bad"] : left <= 7 ? [`Due in ${left} d`, "warn"] : [`Settle by ${D.short(a.settleBy)}`, "mute"];
}
const tvToClose = (t) => t.status === "approved" && t.end < D.today();
const tvIc = (icon, tone = "") => `<span class="cc-logo tv-ic ${tone}">${I(icon)}</span>`;

function tvTripRow(t) {
  const [label, tone] = tvToClose(t) ? ["To close", "warn"] : TV_TRIP_ST[t.status];
  return `<div class="cc-row"><button class="cc-open" data-act="tvTrip" data-id="${t.id}">${tvIc(TV_MODE_IC[t.mode] || "plane", t.status === "closed" ? "mute" : "")}
    <span class="grow" style="min-width:0"><b class="ell">${esc(t.purpose)}</b><span class="small muted ell">${esc(t.to)} · ${D.range(t.start, t.end)}</span></span>
    <span class="cc-amt"><b class="num">${tvMoney(tvEstTotal(t.estimate))}</b>${tvTxt(label, tone)}</span></button></div>`;
}
function tvAdvRow(a) {
  const age = tvAgeing(a), [label, tone] = age || TV_ADV_ST[a.status], bal = tvBalance(a);
  return `<div class="cc-row"><button class="cc-open" data-act="tvAdv" data-id="${a.id}">${tvIc(a.type === "salary" ? "rupee" : "wallet", a.status === "settled" ? "mute" : "")}
    <span class="grow" style="min-width:0"><b class="ell">${TV_ADV_TYPE[a.type]}</b><span class="small muted ell">${esc(a.reason)}</span></span>
    <span class="cc-amt"><b class="num">${tvMoney(a.amount)}</b>${bal && bal < a.amount ? tvTxt(`${tvMoney(bal)} left`, tone) : tvTxt(label, tone)}</span></button></div>`;
}

route("expenses/travel", (_, q) => {
  const tab = q.tab === "advances" ? "advances" : "trips", T = S.travel;
  const trips = T.trips.slice().sort((a, b) => (tvToClose(b) - tvToClose(a)) || (a.status === "closed") - (b.status === "closed") || (a.start < b.start ? -1 : 1));
  const advs = T.advances.slice().sort((a, b) => (a.status === "settled") - (b.status === "settled") || b.requested - a.requested);
  const toSettle = T.advances.reduce((s, a) => s + tvBalance(a), 0);
  const upcoming = T.trips.filter((t) => ["approved", "requested"].includes(t.status) && t.start >= D.today());
  const toClose = T.trips.filter(tvToClose);
  const fig = (label, n, sub) => `<div class="cc-fig"><b class="num">${n}</b><span>${label}</span><small>${sub}</small></div>`;
  return `<div class="screen has-foot">${topbar("Trips & advances")}
    <div class="scroll">
      <div class="cc-figs">
        ${fig("Upcoming trips", upcoming.length, upcoming.length ? `Next ${D.short(upcoming.sort((a, b) => (a.start < b.start ? -1 : 1))[0].start)}` : "None planned")}
        ${fig("To close", toClose.length, toClose.length ? "Trip is over" : "Nothing open")}
        ${fig("To settle", toSettle ? tvMoney(toSettle) : "₹0", toSettle ? "From advances" : "All settled")}
      </div>
      ${seg([["trips", `Trips (${T.trips.length})`], ["advances", `Advances (${T.advances.length})`]], tab, "tvTab")}
      <p class="small muted" style="margin:10px 2px 0">${tab === "trips" ? "Get a trip approved before you go. Its claims are checked against the estimate." : "Money paid up front. A trip’s claims pay its advance back first; the rest is recovered through payroll."}</p>
      <div class="cc-list">${(tab === "trips" ? trips.map(tvTripRow) : advs.map(tvAdvRow)).join("") || emptyState(["plane"], tab === "trips" ? "No trips yet" : "No advances", tab === "trips" ? "Trips you request show up here." : "Advances you ask for show up here.")}</div>
    </div>
    <div class="foot"><button class="btn primary block" data-${tab === "trips" ? 'go="#/expenses/travel/new"' : 'act="tvAdvNew"'}>${I("plus")}${tab === "trips" ? "Request a trip" : "Request an advance"}</button></div>
  </div>`;
}, { parent: "#/expenses" });
act("tvTab", (b) => swap(`#/expenses/travel?tab=${b.dataset.v}`));

const tvActivity = (events) => events?.length ? `<div class="card tv-log"><span class="lbl">Activity</span>${events.slice().reverse().map((e) => `<div class="tv-ev"><i></i><span class="grow"><b>${esc(e.who || "KEBS")}</b> ${esc(e.text)}${e.snip ? `<small>${esc(e.snip)}</small>` : ""}</span><small>${D.short(D.iso(e.at))}</small></div>`).join("")}</div>` : "";

// one trip: estimate vs spent, its advance, close it
act("tvTrip", (b) => {
  const t = tvTrip(b.dataset.id); if (!t) return;
  const est = tvEstTotal(t.estimate), spent = tvSpent(t), adv = tvTripAdv(t), [label, tone] = tvToClose(t) ? ["Trip is over, close it", "warn"] : TV_TRIP_ST[t.status];
  const pct = Math.min(100, est ? (spent / est) * 100 : 0), over = spent > est * 1.1;
  const line = (k, v) => `<div class="kv"><span>${k}</span><span class="num">${tvMoney(v)}</span></div>`;
  const s = openSheet({ title: esc(t.purpose),
    body: `<div class="stack">
      <div class="hrow">${tvIc(TV_MODE_IC[t.mode] || "plane")}<span class="grow"><b style="display:block;font-size:17px">${esc(t.from)} → ${esc(t.to)}</b><span class="small muted">${D.range(t.start, t.end)} · ${D.days(t.start, t.end)} day${D.days(t.start, t.end) === 1 ? "" : "s"} · ${esc(t.mode)}</span></span></div>
      <p class="small" style="margin:0;color:${TV_COL[tone]};font-weight:600">${label}${t.status === "requested" ? ` · ${esc(person("pr").name)}` : ""}</p>
      ${t.status !== "requested" && t.status !== "rejected" ? `<div class="card"><div class="hrow" style="justify-content:space-between"><span class="lbl" style="margin:0">Spent so far</span><b class="num">${tvMoney(spent)} <span class="small muted">of ${tvMoney(est)}</span></b></div>
        <div class="tv-bar"><i style="width:${pct}%;background:${over ? TV_COL.warn : "var(--accent)"}"></i></div>
        <p class="tiny muted" style="margin:6px 0 0">${over ? "Over the estimate by more than 10%: claims need a reason." : "Up to 10% over the estimate is fine without a reason."}</p></div>` : ""}
      <div class="card"><span class="lbl">Estimate · ${esc(TV_CITY[t.to] || "Other")} rates</span>${line(t.mode === "Own car" ? "Mileage" : "Fare", t.estimate.fare)}${line(`Hotel · ${tvNights(t.start, t.end)} night${tvNights(t.start, t.end) === 1 ? "" : "s"}`, t.estimate.hotel)}${line("Meals (per diem)", t.estimate.perDiem)}${line("Local travel", t.estimate.local)}
        <div class="kv"><span><b>Total</b></span><span class="num"><b>${tvMoney(est)}</b></span></div></div>
      <div class="card"><div class="kv"><span>Trip</span><span>${esc(t.code)}</span></div><div class="kv"><span>Cost centre</span><span>${esc(ccName(t.cc))}</span></div><div class="kv"><span>Billing</span><span>${t.billable ? "Billable to the customer" : "Internal"}</span></div>
        <div class="kv"><span>Advance</span><span>${adv ? `${tvMoney(adv.amount)} · ${TV_ADV_ST[adv.status][0]}` : "None"}</span></div></div>
      ${tvActivity(t.events)}
    </div>`,
    foot: t.status === "requested" ? `<button class="btn outline block" data-s="withdraw">Withdraw request</button>`
      : tvToClose(t) ? `<button class="btn primary block" data-s="close">${I("checkCircle")}Close trip</button>`
      : t.status === "approved" ? `<div class="row-btns">${adv ? "" : `<button class="btn outline" style="flex:1" data-s="adv">${I("wallet")}Advance</button>`}<button class="btn primary" style="flex:1" data-s="claim">${I("plus")}Add a claim</button></div>` : "",
    onMount(el) {
      onS(el, {
        withdraw() { S.travel.trips = S.travel.trips.filter((x) => x !== t); S.travel.advances = S.travel.advances.filter((a) => !(a.tripId === t.id && a.status === "requested")); save(); closeSheet(s); rerender(); toast("Trip request withdrawn"); },
        adv() { closeSheet(s); tvAdvNew({ type: "travel", tripId: t.id }); },
        claim() { closeSheet(s); TV_CLAIM_TRIP = t.id; go("#/expenses/new"); toast(`New claim for ${t.purpose}`); },
        close() {
          const paidAdv = adv && adv.status === "paid" ? adv : null, offset = paidAdv ? Math.min(paidAdv.amount, spent) : 0, left = paidAdv ? paidAdv.amount - offset : 0;
          t.status = "closed"; t.closedAt = Date.now(); t.events.push({ at: Date.now(), who: "You", text: "closed the trip", snip: paidAdv ? (left ? `${tvMoney(left)} recovered through payroll` : "Advance settled") : "" });
          if (paidAdv) { paidAdv.settled = paidAdv.amount; paidAdv.status = "settled"; paidAdv.events.push({ at: Date.now(), who: "", text: "settled it", snip: `${tvMoney(offset)} offset against the trip’s claims${left ? ` · ${tvMoney(left)} from payroll` : ""}` }); }
          save(); closeSheet(s); rerender(); toast(left ? `Trip closed · ${tvMoney(left)} recovered from payroll` : "Trip closed and settled");
        },
      });
    } });
});

// a new claim started from a trip is linked to it when it's created
let TV_CLAIM_TRIP = null;
window.addEventListener("hashchange", () => {
  if (!TV_CLAIM_TRIP) return;
  const m = /^#\/expenses\/claim\/([^/?]+)$/.exec(location.hash), c = m && claimOf(m[1]);
  if (c && !c.trip && Date.now() - c.created < 60000) { c.trip = TV_CLAIM_TRIP; TV_CLAIM_TRIP = null; save(); }
  else if (!location.hash.startsWith("#/expenses")) TV_CLAIM_TRIP = null;
});

// one advance: balance, settle by, instalments
act("tvAdv", (b) => {
  const a = tvAdv(b.dataset.id); if (!a) return;
  const bal = tvBalance(a), age = tvAgeing(a), [label, tone] = TV_ADV_ST[a.status], trip = a.tripId && tvTrip(a.tripId);
  const inst = a.type === "salary" && a.instalments ? Math.round(a.amount / a.instalments) : 0, done = inst ? Math.round((a.amount - bal) / inst) : 0;
  const s = openSheet({ title: TV_ADV_TYPE[a.type],
    body: `<div class="stack">
      <div class="hrow">${tvIc(a.type === "salary" ? "rupee" : "wallet")}<span class="grow"><b style="display:block;font-size:22px" class="num">${tvMoney(a.amount)}</b><span class="small" style="color:${TV_COL[tone]};font-weight:600">${label}</span></span></div>
      ${a.status === "paid" ? `<div class="card"><div class="hrow" style="justify-content:space-between"><span class="lbl" style="margin:0">${a.type === "salary" ? "Still to recover" : "Still to settle"}</span><b class="num">${tvMoney(bal)}</b></div>
        <div class="tv-bar"><i style="width:${Math.round(((a.amount - bal) / a.amount) * 100)}%;background:var(--ok,#15803d)"></i></div>
        <p class="tiny muted" style="margin:6px 0 0">${inst ? `${done} of ${a.instalments} instalments of ${tvMoney(inst)} taken from payroll.` : age ? `${age[0]}. Add the claims for it; anything left is recovered through payroll.` : ""}</p></div>` : ""}
      <div class="card"><div class="kv"><span>Advance</span><span>${esc(a.code)}</span></div><div class="kv"><span>Reason</span><span>${esc(a.reason)}</span></div>
        ${trip ? `<div class="kv"><span>Trip</span><span>${esc(trip.purpose)}</span></div>` : ""}
        ${a.settleBy ? `<div class="kv"><span>Settle by</span><span>${D.long(a.settleBy)}</span></div>` : ""}
        ${a.instalments ? `<div class="kv"><span>Repay in</span><span>${a.instalments} monthly instalment${a.instalments === 1 ? "" : "s"}</span></div>` : ""}</div>
      ${tvActivity(a.events)}
    </div>`,
    foot: a.status === "requested" ? `<button class="btn outline block" data-s="withdraw">Withdraw request</button>` : "",
    onMount(el) { onS(el, { withdraw() { S.travel.advances = S.travel.advances.filter((x) => x !== a); save(); closeSheet(s); rerender(); toast("Advance request withdrawn"); } }); } });
});

// request an advance (travel: up to 80% of the trip's estimate · petty cash: ₹10,000 · salary: ₹1,00,000 in instalments)
act("tvAdvNew", () => tvAdvNew({}));
function tvAdvNew(init) {
  const F = { type: init.type || "travel", tripId: init.tripId || "", amount: "", reason: "", inst: 6 };
  const tripsFor = () => S.travel.trips.filter((t) => ["approved", "requested"].includes(t.status) && !tvTripAdv(t));
  if (F.type === "travel" && !F.tripId) F.tripId = tripsFor()[0]?.id || "";
  const limit = () => F.type === "petty" ? TV_PETTY_MAX : F.type === "salary" ? TV_SALARY_MAX : (tvTrip(F.tripId) ? Math.floor((tvEstTotal(tvTrip(F.tripId).estimate) * TV_ADV_SHARE) / 100) * 100 : 0);
  const s = openSheet({ title: "Request an advance", body: `<div class="stack" data-f></div>`, foot: `<button class="btn primary block" data-s="send">Send for approval</button>`,
    onMount(el) {
      const box = el.querySelector("[data-f]");
      const draw = () => {
        const trip = tvTrip(F.tripId), lim = limit();
        box.innerHTML = `<div class="field"><span class="lbl">Type</span><div class="choices">${Object.entries(TV_ADV_TYPE).map(([v, l]) => `<button class="choice ${F.type === v ? "on" : ""}" data-s="type" data-v="${v}">${l.replace(" advance", "")}</button>`).join("")}</div></div>
          ${F.type === "travel" ? `<div class="field"><span class="lbl">Trip</span><button class="inp sel" data-s="trip"><span class="${trip ? "" : "muted"}">${trip ? `${esc(trip.purpose)} <span class="tiny muted">${D.range(trip.start, trip.end)}</span>` : tripsFor().length ? "Choose a trip" : "No trip without an advance"}</span>${I("chevD")}</button></div>` : ""}
          <div class="field"><label for="tv-amt">Amount</label><input id="tv-amt" class="inp num" inputmode="numeric" data-k="amount" value="${esc(F.amount)}" placeholder="₹0"><span class="tiny muted">${lim ? `Up to ${tvMoney(lim)}${F.type === "travel" ? " (80% of the estimate)" : ""}. ${F.type === "salary" ? "Recovered from payroll." : `Settle it with claims within ${F.type === "petty" ? "30 days" : `${TV_SETTLE} days of the trip`}.`}` : "Pick a trip first."}</span></div>
          ${F.type === "salary" ? `<div class="field"><span class="lbl">Repay in</span><div class="choices">${TV_INST.map((n) => `<button class="choice ${F.inst === n ? "on" : ""}" data-s="inst" data-v="${n}">${n} mo</button>`).join("")}</div></div>` : ""}
          <div class="field"><label for="tv-r">Reason</label><input id="tv-r" class="inp" data-k="reason" value="${esc(F.reason)}" placeholder="${F.type === "petty" ? "Ex: Pantry and couriers for the team" : F.type === "salary" ? "Ex: Medical expenses" : "Ex: Hotel and local travel"}"></div>`;
      };
      box.addEventListener("input", (e) => { const k = e.target.dataset.k; if (k) F[k] = k === "amount" ? e.target.value.replace(/[^\d]/g, "") : e.target.value; if (k === "amount" && e.target.value !== F.amount) e.target.value = F.amount; });
      draw();
      onS(el, {
        type(b) { F.type = b.dataset.v; if (F.type === "travel" && !F.tripId) F.tripId = tripsFor()[0]?.id || ""; draw(); },
        inst(b) { F.inst = +b.dataset.v; draw(); },
        trip() { const list = tripsFor(); if (!list.length) return toast("Every trip already has an advance", "bad"); pickOption({ title: "Trip", value: F.tripId, options: list.map((t) => ({ v: t.id, label: t.purpose, sub: `${t.to} · ${D.range(t.start, t.end)}`, icon: "plane" })), onPick(v) { F.tripId = v; draw(); } }); },
        send() {
          const amt = +F.amount || 0, lim = limit();
          if (F.type === "travel" && !F.tripId) return toast("Pick the trip", "bad");
          if (!amt) { el.querySelector("#tv-amt").focus(); return toast("Add the amount", "bad"); }
          if (amt > lim) return toast(`That’s over the limit of ${tvMoney(lim)}`, "bad");
          if (!F.reason.trim()) { el.querySelector("#tv-r").focus(); return toast("Add a short reason", "bad"); }
          const n = 204 + S.travel.advances.length;
          S.travel.advances.unshift({ id: "ad" + uid(), code: "AD-" + n, type: F.type, amount: amt, reason: F.reason.trim(), ...(F.type === "travel" ? { tripId: F.tripId } : {}), ...(F.type === "salary" ? { instalments: F.inst } : {}),
            status: "requested", requested: Date.now(), settled: 0, events: [{ at: Date.now(), who: "You", text: "requested the advance", ...(F.type === "salary" ? { snip: `${F.inst} monthly instalment${F.inst === 1 ? "" : "s"}` } : {}) }] });
          save(); closeSheet(s);
          if (location.hash.startsWith("#/expenses/travel")) swap("#/expenses/travel?tab=advances"); else rerender();
          toast(`Advance of ${tvMoney(amt)} sent to ${person("pr").name}`);
        },
      });
    } });
}

// request a trip, with its estimate worked out as you fill it in
route("expenses/travel/new", () => {
  const F = draft("tvNew", { purpose: "", from: "Bengaluru", to: "", start: "", end: "", mode: "Flight", cc: "", billable: true, adv: false, advAmt: "" });
  const est = F.to && F.start ? tvEstimate(F.to, F.mode, F.start, F.end || F.start) : null, tot = est ? tvEstTotal(est) : 0, advMax = Math.floor((tot * TV_ADV_SHARE) / 100) * 100;
  const sel = (act, icon, val, ph) => `<button class="inp sel" data-act="${act}"><span class="hrow">${I(icon)}<span class="${val ? "" : "muted"}">${val || ph}</span></span>${I("chevD")}</button>`;
  const line = (k, v) => `<div class="kv"><span>${k}</span><span class="num">${tvMoney(v)}</span></div>`;
  return `<div class="screen has-foot">${topbar("Request a trip", { sub: "Approved before you travel" })}<div class="scroll"><div class="stack s16" style="padding-top:6px">
    <div class="field"><label for="tv-p">Purpose</label><input id="tv-p" class="inp" data-bind="purpose" value="${esc(F.purpose)}" maxlength="60" placeholder="Ex: Client workshop at Contoso"></div>
    <div class="grid2"><div class="field"><span class="lbl">From</span>${sel("tvFrom", "pin", esc(F.from), "City")}</div><div class="field"><span class="lbl">To</span>${sel("tvTo", "pin", esc(F.to), "City")}</div></div>
    <div class="field"><span class="lbl">Dates</span>${sel("tvDates", "calendar", F.start ? `${D.range(F.start, F.end || F.start)} · ${D.days(F.start, F.end || F.start)} day${D.days(F.start, F.end || F.start) === 1 ? "" : "s"}` : "", "When are you going?")}</div>
    <div class="field"><span class="lbl">Travel by</span><div class="choices">${TV_MODES.map((m) => `<button class="choice ${F.mode === m ? "on" : ""}" data-act="tvMode" data-v="${m}">${m}</button>`).join("")}</div></div>
    <div class="field"><span class="lbl">Cost centre</span>${sel("tvCc", "building", F.cc ? esc(ccName(F.cc)) : "", "Choose a cost centre")}</div>
    <div class="field"><span class="lbl">Billing</span><div class="choices">${[[true, "Billable to the customer"], [false, "Internal"]].map(([v, l]) => `<button class="choice ${F.billable === v ? "on" : ""}" data-act="tvBill" data-v="${v}">${l}</button>`).join("")}</div></div>
    ${est ? `<div class="card"><span class="lbl">Estimate · ${esc(TV_CITY[F.to] || "Other")} rates</span>${line(F.mode === "Own car" ? "Mileage" : "Fare", est.fare)}${line(`Hotel · ${tvNights(F.start, F.end || F.start)} night${tvNights(F.start, F.end || F.start) === 1 ? "" : "s"}`, est.hotel)}${line("Meals (per diem)", est.perDiem)}${line("Local travel", est.local)}<div class="kv"><span><b>Total</b></span><span class="num"><b>${tvMoney(tot)}</b></span></div></div>
      <button class="card hrow tv-adv-t" data-act="tvAdvT" aria-pressed="${F.adv}"><span class="grow"><b style="display:block">Ask for an advance</b><span class="small muted">Up to ${tvMoney(advMax)}, paid before you go</span></span><span class="tv-sw ${F.adv ? "on" : ""}" aria-hidden="true"><i></i></span></button>
      ${F.adv ? `<div class="field"><label for="tv-aa">Advance amount</label><input id="tv-aa" class="inp num" inputmode="numeric" data-bind="advAmt" value="${esc(F.advAmt)}" placeholder="${tvMoney(Math.round(advMax / 2 / 100) * 100)}"></div>` : ""}`
      : `<p class="small muted" style="margin:0">Pick where and when, and the estimate is worked out from the company’s city rates.</p>`}
  </div></div><div class="foot"><button class="btn primary block" data-act="tvSend" data-cta>${I("send")}Send for approval${tot ? ` · ${tvMoney(tot)}` : ""}</button></div></div>`;
}, { parent: "#/expenses/travel", mount() { FORM_CHECK = () => { const b = $("[data-cta]"); if (b && DRAFT) b.disabled = !(DRAFT.purpose.trim() && DRAFT.to && DRAFT.start && DRAFT.cc); }; FORM_CHECK(); } });
const tvCities = (title, key) => pickOption({ title, value: DRAFT[key], options: Object.keys(TV_CITY).filter((c) => key === "from" || c !== DRAFT.from).map((c) => ({ v: c, label: c, sub: TV_CITY[c] })), onPick(v) { DRAFT[key] = v; if (DRAFT.from === DRAFT.to) DRAFT.to = ""; rerender(); } });
act("tvFrom", () => tvCities("From", "from"));
act("tvTo", () => tvCities("To", "to"));
act("tvDates", () => pickDates({ title: "Trip dates", mode: "range", start: DRAFT.start || null, end: DRAFT.end || null, min: D.today(), onDone({ start, end }) { DRAFT.start = start; DRAFT.end = end || start; rerender(); } }));
act("tvMode", (b) => { DRAFT.mode = b.dataset.v; rerender(); });
act("tvBill", (b) => { DRAFT.billable = b.dataset.v === "true"; rerender(); });
act("tvCc", () => pickOption({ title: "Cost centre", value: DRAFT.cc, options: COST_CENTRES.map((c) => ({ v: c.id, label: c.name, sub: c.id, icon: "building" })), onPick(v) { DRAFT.cc = v; rerender(); } }));
act("tvAdvT", () => { DRAFT.adv = !DRAFT.adv; rerender(); });
act("tvSend", (b) => {
  if (b.disabled) return;
  const F = DRAFT, end = F.end || F.start, estimate = tvEstimate(F.to, F.mode, F.start, end), tot = tvEstTotal(estimate), advMax = Math.floor((tot * TV_ADV_SHARE) / 100) * 100;
  const advAmt = F.adv ? +String(F.advAmt).replace(/[^\d]/g, "") || Math.round(advMax / 2 / 100) * 100 : 0;
  if (advAmt > advMax) return toast(`The advance can be up to ${tvMoney(advMax)}`, "bad");
  const id = "tr" + uid(), code = "TR-" + (125 + S.travel.trips.length);
  S.travel.trips.unshift({ id, code, purpose: F.purpose.trim(), from: F.from, to: F.to, start: F.start, end, mode: F.mode, cc: F.cc, billable: F.billable, status: "requested", spent: 0, estimate, events: [{ at: Date.now(), who: "You", text: "requested the trip" }] });
  if (advAmt) S.travel.advances.unshift({ id: "ad" + uid(), code: "AD-" + (204 + S.travel.advances.length), type: "travel", amount: advAmt, reason: `${F.purpose.trim()}: travel costs`, tripId: id, status: "requested", requested: Date.now(), settled: 0, events: [{ at: Date.now(), who: "You", text: "requested the advance" }] });
  save(); DRAFT = null; swap("#/expenses/travel"); toast(`Trip sent to ${person("pr").name}${advAmt ? ` with a ${tvMoney(advAmt)} advance` : ""}`);
});

// ── Repeating claims ──
const rpOf = (id) => S.repeat.find((r) => r.id === id);
const rpNext = (r) => { const t = D.today(), d = D.parse(t), x = D.iso(new Date(d.getFullYear(), d.getMonth(), r.day)); return x >= t ? x : D.iso(new Date(d.getFullYear(), d.getMonth() + 1, r.day)); };
const rpNeedsBill = (r) => r.status === "active" && r.history[0] && r.history[0].month === ymOf(D.today()) && !r.history[0].steps.bill;
const rpOrd = (n) => n + (n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th");
function rpLogo(r) {
  const k = String(r.vendor).toLowerCase().split(/\s+/)[0], f = RP_LOGO[k];
  return f ? `<span class="cc-logo"><img src="assets/vendors/${f}" alt=""></span>` : `<span class="cc-logo txt">${esc(r.vendor[0] || "?")}</span>`;
}
function rpSchedRow(r) {
  const need = rpNeedsBill(r), [label, tone] = need ? ["Bill needed", "warn"] : RP_ST[r.status];
  return `<div class="cc-row"><button class="cc-open" data-go="#/expenses/repeating/${r.id}">${rpLogo(r)}
    <span class="grow" style="min-width:0"><b class="ell">${esc(r.name)}</b><span class="small muted ell">${r.fixed ? "" : "About "}${tvMoney(r.amount)} a month · on the ${rpOrd(r.day)}</span></span>
    <span class="cc-amt">${tvTxt(label, tone)}</span></button></div>`;
}

route("expenses/repeating", () => {
  const L = S.repeat, act_ = L.filter((r) => r.status === "active"), need = L.filter(rpNeedsBill);
  const order = { active: 0, pending: 1, paused: 2, stopped: 3 }, list = L.slice().sort((a, b) => rpNeedsBill(b) - rpNeedsBill(a) || order[a.status] - order[b.status]);
  const next = act_.map((r) => [rpNext(r), r]).sort((a, b) => (a[0] < b[0] ? -1 : 1))[0];
  const fig = (label, n, sub) => `<div class="cc-fig"><b class="num">${n}</b><span>${label}</span><small>${sub}</small></div>`;
  return `<div class="screen has-foot">${topbar("Repeating claims")}
    <div class="scroll">
      <div class="cc-figs">
        ${fig("Active", act_.length, tvMoney(act_.reduce((a, r) => a + r.amount, 0)) + " a month")}
        ${fig("Need a bill", need.length, need.length ? "This month" : "All in")}
        ${fig("Next claim", next ? D.short(next[0]) : "–", next ? esc(next[1].vendor) : "Nothing active")}
      </div>
      <p class="small muted" style="margin:12px 2px 0">Set up a monthly bill once. Each month’s claim is drafted for you and approved automatically while it stays within 10% of the approved amount.</p>
      <div class="cc-list">${list.map(rpSchedRow).join("") || emptyState(["receipt"], "No repeating claims", "Phone, internet or a subscription you claim every month.")}</div>
    </div>
    <div class="foot"><button class="btn primary block" data-go="#/expenses/repeating/new">${I("plus")}Set up a repeating claim</button></div>
  </div>`;
}, { parent: "#/expenses" });

route("expenses/repeating/new", () => {
  const F = draft("rpNew", { name: "", vendor: "", cat: "Internet", cc: "", fixed: true, amount: "", day: 1, months: 12 });
  const sel = (act, icon, val, ph) => `<button class="inp sel" data-act="${act}"><span class="hrow">${I(icon)}<span class="${val ? "" : "muted"}">${val || ph}</span></span>${I("chevD")}</button>`;
  return `<div class="screen has-foot">${topbar("Repeating claim", { sub: "Approved once, claimed every month" })}<div class="scroll"><div class="stack s16" style="padding-top:6px">
    <div class="field"><label for="rp-n">Name</label><input id="rp-n" class="inp" data-bind="name" value="${esc(F.name)}" maxlength="50" placeholder="Ex: Mobile: Jio postpaid"></div>
    <div class="field"><label for="rp-v">Vendor</label><input id="rp-v" class="inp" data-bind="vendor" value="${esc(F.vendor)}" maxlength="40" placeholder="Ex: Jio"></div>
    <div class="grid2"><div class="field"><span class="lbl">Category</span>${sel("rpCat", catIcon(F.cat), esc(F.cat), "Category")}</div><div class="field"><span class="lbl">Day of the month</span>${sel("rpDay", "calendar", `The ${rpOrd(F.day)}`, "")}</div></div>
    <div class="field"><span class="lbl">Cost centre</span>${sel("rpCc", "building", F.cc ? esc(ccName(F.cc)) : "", "Choose a cost centre")}</div>
    <div class="field"><span class="lbl">The amount is</span><div class="choices">${[[true, "Same every month"], [false, "Changes each month"]].map(([v, l]) => `<button class="choice ${F.fixed === v ? "on" : ""}" data-act="rpFixed" data-v="${v}">${l}</button>`).join("")}</div></div>
    <div class="field"><label for="rp-a">${F.fixed ? "Monthly amount" : "Usual monthly amount"}</label><input id="rp-a" class="inp num" inputmode="numeric" data-bind="amount" value="${esc(F.amount)}" placeholder="₹0"><span class="tiny muted">Each month’s claim is auto-approved up to 10% over this.</span></div>
    <div class="field"><span class="lbl">Runs for</span><div class="choices">${RP_RUNS.map(([v, l]) => `<button class="choice ${F.months === v ? "on" : ""}" data-act="rpRuns" data-v="${v}">${l}</button>`).join("")}</div></div>
  </div></div><div class="foot"><button class="btn primary block" data-act="rpSend" data-cta>${I("send")}Send for approval</button></div></div>`;
}, { parent: "#/expenses/repeating", mount() { FORM_CHECK = () => { const b = $("[data-cta]"); if (b && DRAFT) b.disabled = !(DRAFT.name.trim() && DRAFT.vendor.trim() && DRAFT.cc && +String(DRAFT.amount).replace(/[^\d.]/g, "") > 0); }; FORM_CHECK(); } });
act("rpCat", () => pickOption({ title: "Category", value: DRAFT.cat, options: EXP_CATS.map((c) => ({ v: c.id, label: c.id, icon: c.icon })), onPick(v) { DRAFT.cat = v; rerender(); } }));
act("rpDay", () => pickOption({ title: "Draft the claim on", value: String(DRAFT.day), options: [1, 3, 5, 8, 10, 12, 15, 20, 25, 28].map((n) => ({ v: String(n), label: `The ${rpOrd(n)}`, sub: "of each month" })), onPick(v) { DRAFT.day = +v; rerender(); } }));
act("rpCc", () => pickOption({ title: "Cost centre", value: DRAFT.cc, options: COST_CENTRES.map((c) => ({ v: c.id, label: c.name, sub: c.id, icon: "building" })), onPick(v) { DRAFT.cc = v; rerender(); } }));
act("rpFixed", (b) => { DRAFT.fixed = b.dataset.v === "true"; rerender(); });
act("rpRuns", (b) => { DRAFT.months = +b.dataset.v; rerender(); });
act("rpSend", (b) => {
  if (b.disabled) return;
  const F = DRAFT, amount = Math.round(+String(F.amount).replace(/[^\d.]/g, ""));
  S.repeat.unshift({ id: "rp" + uid(), name: F.name.trim(), vendor: F.vendor.trim(), cat: F.cat, cc: F.cc, fixed: F.fixed, amount, day: F.day, months: F.months, start: D.today(), status: "pending", validUntil: null, history: [] });
  save(); DRAFT = null; swap("#/expenses/repeating"); toast(`Sent to ${person("pr").name} to approve once`);
});

route("expenses/repeating/:id", ({ id }) => {
  const r = rpOf(id); if (!r) return `<div class="screen">${topbar("Repeating claim")}${emptyState(["receipt"], "Not found", "")}</div>`;
  const [label, tone] = RP_ST[r.status], need = rpNeedsBill(r), paid = r.history.filter((h) => h.steps.paid);
  const month = (h) => {
    const at = RP_STEPS.filter(([k]) => h.steps[k]).length, mm = D.f(h.month + "-01", { month: "long", year: "numeric" });
    return `<div class="rp-m"><span class="grow"><b>${mm}</b><small>${h.code ? esc(h.code) + " · " : ""}${h.steps.paid ? `Paid ${D.short(h.steps.paid)}` : h.steps.bill ? "On its way" : "Drafted, waiting for the bill"}${h.approvedBy === "auto" ? " · Auto-approved" : ""}${h.sampled ? " · Checked by Finance" : ""}</small>
      <span class="rp-steps" aria-label="${at} of ${RP_STEPS.length} steps">${RP_STEPS.map(([k, l], i) => `<i class="${i < at ? "on" : ""}" title="${l}"></i>`).join("")}</span></span>
      <b class="num">${h.amount ? tvMoney(h.amount) : "–"}</b></div>`;
  };
  return `<div class="screen ${r.status === "stopped" ? "" : "has-foot"}">${topbar(r.vendor, { sub: r.name })}<div class="scroll"><div class="stack s16" style="padding-top:6px">
    <div class="card rp-head">${rpLogo(r)}<span class="grow"><b class="num" style="display:block;font-size:24px">${r.fixed ? "" : "~"}${tvMoney(r.amount)}<span class="small muted" style="font-weight:500"> / month</span></b>
      <span class="small" style="color:${TV_COL[need ? "warn" : tone]};font-weight:600">${need ? "This month’s bill is needed" : label}${r.status === "pending" ? ` · ${esc(person("pr").name)}` : ""}</span></span></div>
    <div class="card"><div class="kv"><span>Claim drafted</span><span>On the ${rpOrd(r.day)} of each month</span></div>
      <div class="kv"><span>Amount</span><span>${r.fixed ? "Same every month" : "Changes each month"}</span></div>
      <div class="kv"><span>Auto-approves up to</span><span class="num">${tvMoney(rpCap(r))}</span></div>
      <div class="kv"><span>Category</span><span>${esc(r.cat)}</span></div><div class="kv"><span>Cost centre</span><span>${esc(ccName(r.cc))}</span></div>
      <div class="kv"><span>Runs for</span><span>${r.months ? `${r.months} months` : "Until you stop it"}</span></div>
      ${r.validUntil ? `<div class="kv"><span>Approval valid until</span><span>${D.long(r.validUntil)}</span></div>` : ""}
      ${r.status === "active" ? `<div class="kv"><span>Next claim</span><span>${D.long(rpNext(r))}</span></div>` : ""}
      ${r.pausedOn ? `<div class="kv"><span>Paused on</span><span>${D.long(r.pausedOn)}</span></div>` : ""}</div>
    <div class="card"><div class="hrow" style="justify-content:space-between"><span class="lbl" style="margin:0">Month by month</span><span class="small muted">${paid.length ? `${tvMoney(paid.reduce((a, h) => a + (h.amount || 0), 0))} paid` : ""}</span></div>
      ${r.history.length ? r.history.map(month).join("") : `<p class="small muted" style="margin:8px 0 0">The first claim is drafted on the ${rpOrd(r.day)} once it’s approved.</p>`}</div>
  </div></div>
  ${r.status === "stopped" ? "" : `<div class="foot">${r.status === "pending" ? `<button class="btn outline block" data-act="rpDo" data-do="withdraw" data-id="${r.id}">Withdraw request</button>`
    : need ? `<div class="row-btns"><button class="btn outline" style="flex:1" data-act="rpDo" data-do="manage" data-id="${r.id}">${I("dots")}Manage</button><button class="btn primary" style="flex:1.4" data-act="rpBill" data-id="${r.id}">${I("clip")}Add the bill</button></div>`
    : `<div class="row-btns">${r.status === "paused" ? `<button class="btn primary" style="flex:1" data-act="rpDo" data-do="resume" data-id="${r.id}">${I("play")}Resume</button>` : `<button class="btn outline" style="flex:1" data-act="rpDo" data-do="pause" data-id="${r.id}">Pause</button>`}<button class="btn outline" style="flex:1" data-act="rpDo" data-do="stop" data-id="${r.id}">Stop</button></div>`}</div>`}
  </div>`;
}, { parent: "#/expenses/repeating" });

act("rpDo", (b) => {
  const r = rpOf(b.dataset.id); if (!r) return;
  const d = b.dataset.do;
  if (d === "manage") return pickOption({ title: r.name, options: [{ v: "pause", label: "Pause", sub: "No claims until you resume", icon: "stop" }, { v: "stop", label: "Stop", sub: "Ends it for good", icon: "x" }], onPick(v) { ACTIONS.rpDo({ dataset: { id: r.id, do: v } }); } });
  if (d === "withdraw") { S.repeat = S.repeat.filter((x) => x !== r); save(); swap("#/expenses/repeating"); return toast("Request withdrawn"); }
  if (d === "pause") { r.status = "paused"; r.pausedOn = D.today(); save(); rerender(); return undoToast(`${r.vendor} paused`, () => { r.status = "active"; delete r.pausedOn; save(); rerender(); }); }
  if (d === "resume") { r.status = "active"; delete r.pausedOn; save(); rerender(); return toast(`Resumed · next claim ${D.short(rpNext(r))}`); }
  if (d === "stop") return confirmSheet({ eyebrow: "No more claims are drafted", text: `Stop ${esc(r.vendor)}?`, ok: "Stop it", danger: true, onOk() { r.status = "stopped"; delete r.pausedOn; save(); rerender(); toast(`${r.vendor} stopped`); } });
});
// this month's bill: attach it (and the amount when it changes); within 10% it's approved straight away
act("rpBill", (b) => {
  const r = rpOf(b.dataset.id), h = r && r.history[0]; if (!h) return;
  pickReceipts({ multiple: false, capture: true, onFiles(files) {
    const f = files[0]; if (!f) return;
    const finish = (amt) => {
      const t = D.today(), auto = amt <= rpCap(r), cid = uid(), rid = uid();
      S.receipts.push({ id: rid, rid: "RP" + rid.slice(0, 4).toUpperCase(), cur: "INR", amt, inr: amt, merchant: r.vendor, cat: r.cat, date: t, desc: r.name, pay: "Personal card", people: [], project: "", taxPct: 0, file: { name: f.name, img: f.img }, claim: cid });
      S.claims.unshift({ id: cid, code: nextCode(), name: `${r.name} – ${D.f(t, { month: "short" })}`, status: auto ? "approved" : "pending", cc: r.cc, approver: "pr", entity: ENTITIES[0], billing: "Non-billable", desc: `Repeating claim: ${r.name}`, cur: "INR", receipts: [rid], created: Date.now(), submitted: Date.now(), paid: 0, note: "", repeat: r.id });
      Object.assign(h, { amount: amt, code: S.claims[0].code, claimId: cid, approvedBy: auto ? "auto" : "approver", steps: { ...h.steps, bill: t, submitted: t, ...(auto ? { approved: t } : {}) } });
      save(); rerender(); toast(auto ? `${tvMoney(amt)} claimed and auto-approved` : `Over ${tvMoney(rpCap(r))}, so it went to ${person("pr").name}`);
    };
    if (r.fixed) return finish(r.amount);
    const s = openSheet({ title: "This month’s amount", body: `<div class="field"><label for="rp-a">Amount on the bill</label><input id="rp-a" class="inp num" inputmode="numeric" data-a value="${r.amount}"><span class="tiny muted">Up to ${tvMoney(rpCap(r))} is approved straight away.</span></div>`,
      foot: `<button class="btn primary block" data-s="ok">Claim it</button>`,
      onMount(el) { onS(el, { ok() { const a = +el.querySelector("[data-a]").value.replace(/[^\d.]/g, ""); if (!a) return toast("Add the amount", "bad"); closeSheet(s); finish(Math.round(a)); } }); } });
  } });
});

// entry points on My expenses (demo workspace): two tiles under the corporate card
ROUTES.forEach((r) => {
  if (r.re.source !== "^expenses$") return;
  const prev = r.render;
  r.render = (m, q, ...rest) => {
    const out = prev(m, q, ...rest);
    if (typeof out !== "string" || (typeof klOn === "function" && klOn()) || (q && q.tab && q.tab !== "claims")) return out;
    const upcoming = S.travel.trips.filter((t) => ["approved", "requested"].includes(t.status) && t.start >= D.today()).length, toClose = S.travel.trips.filter(tvToClose).length;
    const active = S.repeat.filter((x) => x.status === "active").length, need = S.repeat.filter(rpNeedsBill).length;
    const tile = (go, icon, title, sub, warn) => `<button class="card tv-tile" data-go="${go}"><span class="tv-ms">${msIcon(icon)}</span><b>${title}</b><small${warn ? ' class="warn"' : ""}>${sub}</small></button>`;
    const tiles = `<div class="tv-tiles">${tile("#/expenses/travel", "travel", "Trips & advances", toClose ? `${toClose} trip${toClose === 1 ? "" : "s"} to close` : upcoming ? `${upcoming} upcoming` : "Plan a trip", toClose)}
      ${tile("#/expenses/repeating", "repeat", "Repeating claims", need ? `${need} bill${need === 1 ? "" : "s"} needed` : `${active} active`, need)}</div>`;
    return out.replace('<div class="scroll">', `<div class="scroll">${tiles}`);
  };
});
