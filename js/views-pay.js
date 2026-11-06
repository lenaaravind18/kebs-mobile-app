// Payroll: Salary slips (list · slip detail · PDF) and Tax (regime, projection, declarations, Form 16).
// Built from the app's own pieces: card / card.accent, .kv rows, list rows with tinted Fluent icons,
// Microsoft 365-style tiles for entry points, sheets for edits, banners and chips for status.

const fmtD = (s, o) => D.f(s, o).replace(/Sept/, "Sep");

// ── salary structure (monthly, INR) ──
const PAY = {
  bank: "HDFC Bank ••4821", pan: "ABCPS1234K", uan: "1012 3456 7890", pfNo: "TN/MAS/0041235/041",
  earn: [["Basic", 60000], ["House rent allowance", 30000], ["Special allowance", 39250], ["Leave travel allowance", 5000]],
  pf: 7200, pt: 208, employerPf: 7200, gratuity: 2886, bonusMonth: 10, bonus: 15000, lopMonth: 9, lopDays: 1,
};
const GROSS = PAY.earn.reduce((a, [, v]) => a + v, 0);
const DECL = [
  { id: "80c", name: "Section 80C", sub: "PF, ELSS, PPF, life insurance", icon: "shield", tint: "t-blue", max: 150000 },
  { id: "80d", name: "Section 80D", sub: "Health insurance premium", icon: "heartPulse", tint: "t-red", max: 25000 },
  { id: "hra", name: "House rent (HRA)", sub: "Rent you pay for your home", icon: "home", tint: "t-orange", max: null },
  { id: "nps", name: "NPS · 80CCD(1B)", sub: "Your extra NPS contribution", icon: "briefcase", tint: "t-violet", max: 50000 },
];
S.tax ||= {
  regime: "new",
  decl: { "80c": { amt: 150000, proof: "verified", file: "ELSS_statement_2026.pdf" }, "80d": { amt: 18000, proof: "pending" }, hra: { amt: 264000, proof: "submitted", file: "Rent_receipts_Apr-Sep.pdf" }, nps: { amt: 0, proof: "none" } },
};
if (S.settings.payHide === undefined) S.settings.payHide = false;

// ── tax maths (FY 2026-27 slabs) ──
const slabTax = (x, slabs) => { let t = 0, prev = 0; for (const [cap, r] of slabs) { if (x > prev) t += (Math.min(x, cap) - prev) * r; prev = cap; } return t; };
const NEW_SLABS = [[400000, 0], [800000, 0.05], [1200000, 0.1], [1600000, 0.15], [2000000, 0.2], [2400000, 0.25], [Infinity, 0.3]];
const OLD_SLABS = [[250000, 0], [500000, 0.05], [1000000, 0.2], [Infinity, 0.3]];
const annualIncome = () => GROSS * 12 + PAY.bonus;
function oldDeductions() {
  const d = S.tax.decl, basic = PAY.earn[0][1] * 12, hraRecv = PAY.earn[1][1] * 12;
  const hraEx = Math.max(0, Math.min(hraRecv, d.hra.amt - basic * 0.1, basic * 0.5));
  return Math.min(d["80c"].amt, 150000) + Math.min(d["80d"].amt, 25000) + Math.min(d.nps.amt, 50000) + hraEx;
}
function taxFor(regime) {
  const inc = annualIncome();
  if (regime === "new") { const x = Math.max(0, inc - 75000); return x <= 1200000 ? 0 : Math.round(slabTax(x, NEW_SLABS) * 1.04); }
  const x = Math.max(0, inc - 50000 - oldDeductions()); return x <= 500000 ? 0 : Math.round(slabTax(x, OLD_SLABS) * 1.04);
}

// ── slips: April (FY start) to last month ──
function fyStart(d = D.today()) { const [y, m] = d.split("-").map(Number); return m >= 4 ? y : y - 1; }
function slipMonths() {
  const out = [], fy = fyStart(), [ty, tm] = D.today().split("-").map(Number);
  for (let y = fy, m = 4; y < ty || (y === ty && m < tm); m === 12 ? (y++, m = 1) : m++) out.push(`${y}-${String(m).padStart(2, "0")}`);
  return out;
}
const monthName = (k, o = { month: "long", year: "numeric" }) => { const t = fmtD(k + "-01", o); return o.month === "short" ? t.replace(/^Sept/, "Sep").replace(/ Sept /, " Sep ") : t; };
function slip(k) {
  const [y, m] = k.split("-").map(Number), days = new Date(y, m, 0).getDate();
  const baseTds = Math.round(taxFor(S.tax.regime) / 12 - (PAY.bonus * 0.15 * 1.04) / 12);
  const earn = PAY.earn.map(([l, v]) => [l, v]);
  if (m === PAY.bonusMonth) earn.push(["Performance bonus", PAY.bonus]);
  const ded = [["Provident fund (PF)", PAY.pf], ["Professional tax", PAY.pt], ["Income tax (TDS)", baseTds + (m === PAY.bonusMonth ? Math.round(PAY.bonus * 0.15 * 1.04) : 0)]];
  if (m === PAY.lopMonth) ded.push([`Loss of pay (${plural(PAY.lopDays, "day")})`, Math.round((GROSS / days) * PAY.lopDays)]);
  const gross = earn.reduce((a, [, v]) => a + v, 0), deductions = ded.reduce((a, [, v]) => a + v, 0);
  let pay = new Date(y, m, 0); while (pay.getDay() === 0 || pay.getDay() === 6) pay.setDate(pay.getDate() - 1);
  return { k, earn, ded, gross, deductions, net: gross - deductions, paidOn: D.iso(pay), days, paid: m === PAY.lopMonth ? days - PAY.lopDays : days, lop: m === PAY.lopMonth ? PAY.lopDays : 0 };
}
function slipDiff(a, b) {
  if (!b) return [];
  const map = (s) => Object.fromEntries([...s.earn.map(([l, v]) => [l, v]), ...s.ded.map(([l, v]) => [l, -v])]);
  const A = map(a), B = map(b), keys = [...new Set([...Object.keys(A), ...Object.keys(B)])];
  // a loss-of-pay line that only existed last month reads as "no loss of pay this month"
  return keys.map((l) => [l, (A[l] || 0) - (B[l] || 0)]).filter(([, d]) => d)
    .map(([l, d]) => (/^Loss of pay/.test(l) && !(l in A) ? [`No loss of pay (last month ${l.replace(/^Loss of pay \((.*)\)$/, "$1")})`, d] : [l, d]));
}
const m$ = (n) => (S.settings.payHide ? "INR ••••••" : money(n));
const sign$ = (n) => (S.settings.payHide ? "••••" : (n > 0 ? "+" : "−") + money(Math.abs(n)).replace("INR ", "INR "));
const eyeBtn = () => `<button class="ib" data-act="payHide" aria-label="${S.settings.payHide ? "Show amounts" : "Hide amounts"}" aria-pressed="${S.settings.payHide}">${I(S.settings.payHide ? "eyeOff" : "eye")}</button>`;
act("payHide", () => { S.settings.payHide = !S.settings.payHide; save(); rerender(); });

// ── Salary slips ──
route("pay", () => {
  const months = slipMonths(), slips = months.map(slip), last = slips[slips.length - 1], prev = slips[slips.length - 2];
  if (!last) return `<div class="screen">${topbar("Salary slips", { right: eyeBtn() })}${emptyState(["file"], "No salary slips yet", "Your first slip shows up after payday.")}</div>`;
  const ytd = (f) => slips.reduce((a, s) => a + f(s), 0);
  const tds = (s) => s.ded.find(([l]) => /TDS/.test(l))[1];
  const delta = last.net - (prev?.net || last.net);
  const max = Math.max(...slips.slice(-6).map((s) => s.net));
  return `<div class="screen">${topbar("Salary slips", { right: eyeBtn() })}
  <div class="scroll"><div class="stack">
    <button class="paycard ph" data-go="#/pay/${last.k}" aria-label="${esc(monthName(last.k))} take-home ${m$(last.net)}, view salary slip">
      <div class="pc-top"><span class="pc-ic">${I("wallet")}</span><span class="pc-lbl">${esc(monthName(last.k, { month: "long" }))} take-home</span><span class="ph-paid">Paid ${fmtD(last.paidOn, { day: "numeric", month: "short" })}</span></div>
      <div class="pc-amt">${S.settings.payHide ? "₹ ••••••" : `<span class="pc-cur">₹</span>${Number(last.net).toLocaleString("en-IN")}`}</div>
      ${prev && delta ? `<span class="ph-delta ${delta > 0 ? "up" : "down"}">${I(delta > 0 ? "arrowUp" : "arrowDown")}${S.settings.payHide ? "••••" : `₹${Math.abs(delta).toLocaleString("en-IN")}`} ${delta > 0 ? "more" : "less"} than ${esc(monthName(prev.k, { month: "short" }))}</span>` : ""}
      <div class="ph-bar" aria-hidden="true"><i style="width:${Math.round((last.net / last.gross) * 100)}%"></i></div>
      <div class="ph-legend"><span><i class="w"></i>Take-home <b>${S.settings.payHide ? "••••" : Math.round((last.net / last.gross) * 100) + "%"}</b></span><span><i></i>Deductions <b>${m$(last.deductions)}</b></span></div>
      <div class="pc-foot"><span class="pc-sub">${I("building")}<span>${esc(PAY.bank)}</span><em>· Gross ${m$(last.gross)}</em></span><span class="pc-go">${I("chevR")}</span></div>
    </button>
    <div class="sec"><h2>Take-home, last 6 months</h2></div>
    <div class="card ch-card">${areaChart({ values: slips.slice(-6).map((s) => s.net), labels: slips.slice(-6).map((s) => monthName(s.k, { month: "short" })), fmt: (v) => (S.settings.payHide ? "INR ••••" : money(v)) })}</div>
    <div class="sec"><h2>This financial year</h2><span class="tiny muted">FY ${fyStart()}-${String(fyStart() + 1).slice(2)}</span></div>
    <div class="card">
      <div class="kv"><span>Gross earned</span><span>${m$(ytd((s) => s.gross))}</span></div>
      <div class="kv"><span>Income tax deducted</span><span>${m$(ytd(tds))}</span></div>
      <div class="kv"><span>Provident fund</span><span>${m$(ytd(() => PAY.pf))}</span></div>
      <div class="kv"><span>Take-home</span><span><b>${m$(ytd((s) => s.net))}</b></span></div>
    </div>
    <button class="card hrow" data-go="#/tax"><span class="tico ms">${msIcon("tax")}</span><span class="grow"><b style="display:block">Tax &amp; declarations</b><span class="small muted">Regime, TDS projection, proofs, Form 16</span></span>${I("chevR")}</button>
    <div class="sec"><h2>Monthly slips</h2></div>
    <div class="stack s8" data-lazy="6">${slips.slice().reverse().map((s, i, a) => { const d = a[i + 1] ? s.net - a[i + 1].net : 0; return `<button class="card hrow" data-go="#/pay/${s.k}">${fileIcon(`Payslip_${monthName(s.k, { month: "short" })}_${s.k.slice(0, 4)}.pdf`)}<span class="grow"><b style="display:block">${monthName(s.k)}</b><span class="tiny muted">${s.lop ? `${plural(s.lop, "day")} loss of pay · ` : ""}Paid ${fmtD(s.paidOn, { day: "numeric", month: "short" })}</span></span><span class="pay-amt"><b>${m$(s.net)}</b>${d ? `<small class="${d > 0 ? "up" : "down"}">${sign$(d)}</small>` : ""}</span></button>`; }).join("")}</div>
  </div></div></div>`;
});

route("pay/:k", ({ k }) => {
  const months = slipMonths(), i = months.indexOf(k);
  if (i < 0) return `<div class="screen">${topbar("Salary slip")}${emptyState(["file"], "Slip not found", "It may not be released yet.")}</div>`;
  const s = slip(k), p = i > 0 ? slip(months[i - 1]) : null, diff = slipDiff(s, p);
  const rows = (list, total, label) => `<div class="card">${list.map(([l, v]) => `<div class="kv"><span>${esc(l)}</span><span>${m$(v)}</span></div>`).join("")}<div class="kv total"><span>${label}</span><span>${m$(total)}</span></div></div>`;
  return `<div class="screen has-foot">${topbar(`${monthName(k, { month: "short", year: "numeric" })} salary slip`, { right: `<button class="ib" data-act="payShare" data-k="${k}" aria-label="Share">${I("share")}</button>` })}
  <div class="scroll"><div class="stack">
    <div class="card accent">
      <span class="eyebrow">Take-home pay</span>
      <div class="hrow" style="margin-top:6px"><b class="timer grow">${m$(s.net)}</b>${eyeBtn()}</div>
      <span class="small muted">Paid ${fmtD(s.paidOn, { weekday: "short", day: "numeric", month: "short" })} to ${PAY.bank}</span>
      <div class="pay-days"><span><b>${s.paid}</b>/${s.days}</span> paid days${s.lop ? ` · <span style="color:var(--danger)">${plural(s.lop, "day")} loss of pay</span>` : ""}</div>
    </div>
    ${diff.length ? `<div class="card pay-why"><div class="hrow"><span class="i" style="color:var(--accent)">${I("sparkles")}</span><b class="grow">What changed from ${monthName(p.k, { month: "long" })}</b></div>
      ${diff.map(([l, d]) => `<div class="kv"><span>${esc(l)}</span><span class="${d > 0 ? "up" : "down"}">${sign$(d)}</span></div>`).join("")}
      <div class="kv total"><span>Take-home</span><span class="${s.net - p.net >= 0 ? "up" : "down"}">${sign$(s.net - p.net)}</span></div>
      <button class="link" data-act="payAsk" data-k="${k}" style="margin-top:8px">${I("sparkles")}Ask Kais to explain</button></div>` : ""}
    <div class="sec"><h2>Earnings</h2></div>${rows(s.earn, s.gross, "Gross earnings")}
    <div class="sec"><h2>Deductions</h2></div>${rows(s.ded, s.deductions, "Total deductions")}
    <div class="sec"><h2>Paid by your employer</h2></div>
    <div class="card"><div class="kv"><span>Employer PF</span><span>${m$(PAY.employerPf)}</span></div><div class="kv"><span>Gratuity</span><span>${m$(PAY.gratuity)}</span></div></div>
    <div class="card"><div class="kv"><span>Employee ID</span><span>${esc(S.me.empId)}</span></div><div class="kv"><span>PAN</span><span>${PAY.pan}</span></div><div class="kv"><span>UAN</span><span>${PAY.uan}</span></div><div class="kv"><span>Tax regime</span><span>${S.tax.regime === "new" ? "New" : "Old"}</span></div></div>
  </div></div>
  <div class="foot"><div class="hrow" style="gap:10px"><button class="btn ghost" data-act="payAsk" data-k="${k}">${I("sparkles")}Ask Kais</button><button class="btn primary grow" data-act="payPdf" data-k="${k}">${I("download")}Download PDF</button></div></div></div>`;
});
act("payAsk", (b) => openKais(`Why did my pay change in ${monthName(b.dataset.k, { month: "long" })}?`));
act("payShare", async (b) => {
  const s = slip(b.dataset.k), text = `${monthName(s.k)} salary slip · Take-home ${money(s.net)}`;
  try { if (navigator.share) { await navigator.share({ title: "Salary slip", text }); return; } await navigator.clipboard.writeText(text); toast("Slip summary copied"); } catch {}
});
act("payPdf", (b) => {
  const s = slip(b.dataset.k), name = `Payslip_${monthName(s.k, { month: "short" })}_${s.k.slice(0, 4)}.pdf`;
  const blob = payslipPdf(s);
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(`${name} downloaded`);
});

// ── a real, minimal PDF (A4, Helvetica) built by hand ──
function pdfDoc(draw) {
  const ops = [];
  const esc2 = (t) => String(t).replace(/[\\()]/g, (c) => "\\" + c).replace(/[^\x20-\x7e]/g, "");
  const api = {
    text(x, y, t, size = 10, bold = false, color = "0 0 0") { ops.push(`BT ${color} rg /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${esc2(t)}) Tj ET`); },
    right(x, y, t, size = 10, bold = false, color) { api.text(x - String(t).length * size * (bold ? 0.56 : 0.52), y, t, size, bold, color); },
    rect(x, y, w, h, color) { ops.push(`${color} rg ${x} ${y} ${w} ${h} re f`); },
    line(x1, y1, x2, y2, color = "0.85 0.87 0.9") { ops.push(`${color} RG 0.8 w ${x1} ${y1} m ${x2} ${y2} l S`); },
  };
  draw(api);
  const stream = ops.join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let out = "%PDF-1.4\n"; const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const x = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  return new Blob([out], { type: "application/pdf" });
}
function payslipPdf(s) {
  const amt = (n) => "INR " + Number(n).toLocaleString("en-IN");
  return pdfDoc((p) => {
    p.rect(0, 762, 595, 80, "1 0.25 0.07");
    p.text(40, 805, S.me.company, 18, true, "1 1 1");
    p.text(40, 785, `Salary slip for ${monthName(s.k)}`, 11, false, "1 1 1");
    p.right(555, 805, "KEBS", 18, true, "1 1 1");
    let y = 730;
    const info = [["Employee", fullName()], ["Employee ID", S.me.empId], ["Designation", S.me.role], ["Department", S.me.dept], ["PAN", PAY.pan], ["UAN", PAY.uan]];
    const info2 = [["Pay date", fmtD(s.paidOn, { day: "numeric", month: "short", year: "numeric" })], ["Paid days", `${s.paid} of ${s.days}`], ["Loss of pay", `${s.lop} day(s)`], ["Bank", PAY.bank.replace("••", "XX")], ["Tax regime", S.tax.regime === "new" ? "New" : "Old"], ["Location", S.me.loc]];
    info.forEach(([k, v], i) => { p.text(40, y - i * 18, k, 9, false, "0.42 0.45 0.54"); p.text(130, y - i * 18, v, 10, true); });
    info2.forEach(([k, v], i) => { p.text(320, y - i * 18, k, 9, false, "0.42 0.45 0.54"); p.text(410, y - i * 18, v, 10, true); });
    y = 600;
    p.rect(40, y - 6, 515, 24, "0.96 0.97 0.99");
    p.text(50, y + 2, "EARNINGS", 9, true, "0.3 0.33 0.42"); p.right(290, y + 2, "AMOUNT", 9, true, "0.3 0.33 0.42");
    p.text(318, y + 2, "DEDUCTIONS", 9, true, "0.3 0.33 0.42"); p.right(545, y + 2, "AMOUNT", 9, true, "0.3 0.33 0.42");
    const n = Math.max(s.earn.length, s.ded.length);
    for (let i = 0; i < n; i++) {
      const yy = y - 26 - i * 22;
      if (s.earn[i]) { p.text(50, yy, s.earn[i][0], 10); p.right(290, yy, amt(s.earn[i][1]), 10); }
      if (s.ded[i]) { p.text(318, yy, s.ded[i][0], 10); p.right(545, yy, amt(s.ded[i][1]), 10); }
      p.line(40, yy - 8, 555, yy - 8);
    }
    const ty = y - 26 - n * 22 - 6;
    p.text(50, ty, "Gross earnings", 10, true); p.right(290, ty, amt(s.gross), 10, true);
    p.text(318, ty, "Total deductions", 10, true); p.right(545, ty, amt(s.deductions), 10, true);
    p.rect(40, ty - 60, 515, 38, "1 0.94 0.91");
    p.text(56, ty - 45, "Take-home pay", 12, true); p.right(540, ty - 45, amt(s.net), 14, true, "1 0.25 0.07");
    p.text(40, ty - 90, `Employer contributions: PF ${amt(PAY.employerPf)} · Gratuity ${amt(PAY.gratuity)}`, 9, false, "0.42 0.45 0.54");
    p.text(40, 60, "This is a system-generated salary slip and does not need a signature.", 8, false, "0.55 0.58 0.65");
    p.text(40, 46, `Generated from the KEBS app on ${fmtD(D.today(), { day: "numeric", month: "short", year: "numeric" })}.`, 8, false, "0.55 0.58 0.65");
  });
}

// ── Tax ──
const PROOF = { verified: ["ok", "Verified"], submitted: ["acc", "Under review"], pending: ["warn", "Proof due"], none: ["", "Not declared"] };
route("tax", () => {
  const fy = fyStart(), cur = S.tax.regime, tNew = taxFor("new"), tOld = taxFor("old"), tax = cur === "new" ? tNew : tOld;
  const slips = slipMonths().map(slip), paid = slips.reduce((a, s) => a + s.ded.find(([l]) => /TDS/.test(l))[1], 0);
  const left = Math.max(0, tax - paid), monthsLeft = 12 - slips.length, better = tNew <= tOld ? "new" : "old", save$ = Math.abs(tNew - tOld);
  const pct = tax ? Math.min(100, Math.round((paid / tax) * 100)) : 100;
  return `<div class="screen">${topbar("Tax &amp; declarations", { right: eyeBtn() })}
  <div class="scroll"><div class="stack">
    <div class="card accent">
      <span class="eyebrow">Estimated tax · FY ${fy}-${String(fy + 1).slice(2)}</span>
      <b class="timer" style="display:block;margin-top:6px">${m$(tax)}</b>
      <span class="small muted">On a projected income of ${m$(annualIncome())}</span>
      <div class="pay-bar"><i style="width:${pct}%"></i></div>
      <div class="pay-split"><span><i class="dot ok"></i>Deducted <b>${m$(paid)}</b></span><span><i class="dot"></i>Remaining <b>${m$(left)}</b></span></div>
      <span class="tiny muted">About ${m$(monthsLeft ? Math.round(left / monthsLeft) : 0)} a month for the next ${plural(monthsLeft, "month")}</span>
    </div>
    <div class="sec"><h2>Tax regime</h2></div>
    <button class="card hrow" data-act="taxRegime"><span class="li" style="padding:0;border:0"><span class="ic tint t-blue">${I("percent")}</span></span><span class="grow"><b style="display:block">${cur === "new" ? "New regime" : "Old regime"}</b><span class="small muted">${cur === better ? `Best for you · saves ${m$(save$)} a year` : `Switching to the ${better} regime could save ${m$(save$)}`}</span></span><span class="chip ${cur === better ? "ok" : "warn"}">${cur === better ? "Best" : "Compare"}</span></button>
    <div class="sec"><h2>Declarations &amp; proofs</h2><span class="tiny muted">Proofs due 15 Jan</span></div>
    ${cur === "new" ? `<div class="banner info">${I("info")}On the new regime these don’t lower your tax. They count only if you switch to the old regime.</div>` : ""}
    <div class="card list">${DECL.map((d) => { const v = S.tax.decl[d.id], [cls, label] = PROOF[v.proof]; return `<button class="li" data-act="taxDecl" data-id="${d.id}"><span class="ic tint ${d.tint}">${I(d.icon)}</span><span class="grow"><b style="display:block">${d.name}</b><span class="tiny muted">${v.amt ? m$(v.amt) + (d.max ? ` of ${money(d.max)}` : "") : d.sub}</span></span>${v.amt ? `<span class="chip ${cls}">${label}</span>` : ""}${I("chevR")}</button>`; }).join("")}</div>
    <div class="sec"><h2>Form 16</h2></div>
    <div class="stack s8">${[[fy - 1, "15 Jun " + fy], [fy - 2, "14 Jun " + (fy - 1)]].map(([y, d]) => `<div class="card hrow">${fileIcon(`Form16_FY${y}-${String(y + 1).slice(2)}.pdf`)}<span class="grow"><b style="display:block">FY ${y}-${String(y + 1).slice(2)}</b><span class="tiny muted">Issued ${d} · Part A &amp; B</span></span><button class="ib sm" data-act="form16" data-y="${y}" aria-label="Download Form 16">${I("download")}</button></div>`).join("")}
      <div class="card hrow" style="opacity:.75"><span class="li" style="padding:0;border:0"><span class="ic tint t-slate">${I("clock")}</span></span><span class="grow"><b style="display:block">FY ${fy}-${String(fy + 1).slice(2)}</b><span class="tiny muted">Available after the year closes, by 15 Jun ${fy + 1}</span></span></div></div>
    <button class="card hrow" data-act="taxAsk"><span class="ic tint t-orange" style="flex:none">${I("sparkles")}</span><span class="grow"><b style="display:block">Ask Kais about tax</b><span class="small muted">“Which regime is better for me?”</span></span>${I("chevR")}</button>
  </div></div></div>`;
});
act("taxAsk", () => openKais("Which tax regime is better for me?"));
act("form16", (b) => {
  const y = Number(b.dataset.y), name = `Form16_FY${y}-${String(y + 1).slice(2)}.pdf`;
  const blob = pdfDoc((p) => {
    p.rect(0, 762, 595, 80, "0.1 0.34 0.77"); p.text(40, 805, "FORM No. 16", 18, true, "1 1 1"); p.text(40, 785, `Certificate of tax deducted at source · FY ${y}-${String(y + 1).slice(2)}`, 11, false, "1 1 1");
    [["Employer", S.me.company], ["Employee", fullName()], ["PAN of employee", PAY.pan], ["Assessment year", `${y + 1}-${String(y + 2).slice(2)}`], ["Gross salary", "INR " + annualIncome().toLocaleString("en-IN")], ["Tax deducted", "INR " + taxFor("new").toLocaleString("en-IN")]].forEach(([k, v], i) => { p.text(40, 720 - i * 22, k, 10, false, "0.42 0.45 0.54"); p.text(200, 720 - i * 22, v, 11, true); });
    p.text(40, 60, "Sample certificate generated by the KEBS demo app.", 8, false, "0.55 0.58 0.65");
  });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove();
  toast(`${name} downloaded`);
});
act("taxRegime", () => {
  const tNew = taxFor("new"), tOld = taxFor("old");
  let pick = S.tax.regime;
  const opt = (id, name, t, sub) => `<button class="choice-card ${pick === id ? "on" : ""}" data-s="pick" data-v="${id}"><span class="grow"><b style="display:block">${name}</b><span class="tiny muted">${sub}</span></span><b class="num">${m$(t)}</b></button>`;
  const s = openSheet({
    title: "Compare tax regimes",
    body: `<div class="stack s8" data-o>${opt("new", "New regime", tNew, "Lower slabs, INR 75,000 standard deduction, few exemptions")}${opt("old", "Old regime", tOld, `Counts 80C, 80D, HRA and NPS · ${m$(oldDeductions())} in deductions`)}</div>
      <div class="banner ${tNew <= tOld ? "ok" : "warn"}" style="margin-top:12px">${I(tNew <= tOld ? "checkCircle" : "info")}The ${tNew <= tOld ? "new" : "old"} regime saves you ${m$(Math.abs(tNew - tOld))} this year.</div>
      <p class="tiny muted" style="margin-top:10px">Estimates use this year’s slabs and your declarations. You can change regime until proofs close on 15 Jan.</p>`,
    foot: `<button class="btn primary block" data-s="save">Use this regime</button>`,
    onMount(el) {
      onS(el, {
        pick(b) { pick = b.dataset.v; el.querySelectorAll(".choice-card").forEach((c) => c.classList.toggle("on", c.dataset.v === pick)); },
        save() { const changed = pick !== S.tax.regime; S.tax.regime = pick; save(); closeSheet(s); rerender(); if (changed) toast(`Switched to the ${pick} regime`); },
      });
    },
  });
});
act("taxDecl", (b) => {
  const d = DECL.find((x) => x.id === b.dataset.id), v = S.tax.decl[d.id];
  let file = v.file || "";
  const s = openSheet({
    title: d.name,
    body: `<p class="small muted" style="margin:-4px 0 14px">${d.sub}${d.max ? ` · limit ${money(d.max)} a year` : ""}</p>
      <div class="field"><label for="tx-a">${d.id === "hra" ? "Rent paid this year" : "Amount declared"}</label><input id="tx-a" class="inp" inputmode="numeric" data-a value="${v.amt || ""}" placeholder="0"></div>
      <div class="field" style="margin-top:14px"><span class="lbl">Proof</span><div data-f>${file ? `<div class="card hrow">${fileIcon(file)}<span class="grow ell">${esc(file)}</span><span class="chip ${PROOF[v.proof][0]}">${PROOF[v.proof][1]}</span></div>` : ""}</div>
        <label class="btn ghost block" style="margin-top:8px;cursor:pointer">${I("upload")}${file ? "Replace proof" : "Upload proof"}<input type="file" accept=".pdf,image/*" data-up hidden></label></div>`,
    foot: `<button class="btn primary block" data-s="save">Save declaration</button>`,
    onMount(el) {
      el.querySelector("[data-up]").addEventListener("change", (e) => {
        const f = e.target.files[0]; if (!f) return; file = f.name;
        el.querySelector("[data-f]").innerHTML = `<div class="card hrow">${fileIcon(file)}<span class="grow ell">${esc(file)}</span><span class="chip acc">Ready to submit</span></div>`;
      });
      onS(el, {
        save() {
          let amt = Math.max(0, Number(String(el.querySelector("[data-a]").value).replace(/[^\d]/g, "")) || 0);
          if (d.max && amt > d.max) { amt = d.max; toast(`Capped at the ${money(d.max)} limit`, "info"); }
          const fileChanged = file && file !== v.file;
          Object.assign(v, { amt, file, proof: !amt ? "none" : fileChanged ? "submitted" : v.proof === "none" ? "pending" : v.proof });
          save(); closeSheet(s); rerender(); toast(fileChanged ? "Declaration saved · proof sent for review" : "Declaration saved");
        },
      });
    },
  });
});

// ── Kais knows payroll ──
const PAY_FOLLOW = ["Why did my pay change?", "Which tax regime is better for me?", "Show my latest salary slip"];
function payAnswer(q) {
  const t = q.toLowerCase(), months = slipMonths();
  if (!months.length) return null;
  const pick = () => { const m = months.find((k) => t.includes(monthName(k, { month: "long" }).toLowerCase()) || t.includes(monthName(k, { month: "short" }).toLowerCase() + " ")); return m || months[months.length - 1]; };
  if (/(pay|salary|take.?home|net).*(change|differ|more|less|drop|increase|higher|lower)|why .*(pay|salary)/.test(t)) {
    const k = pick(), i = months.indexOf(k), s = slip(k), p = i > 0 ? slip(months[i - 1]) : null;
    if (!p) return { text: `${monthName(k)} is your first slip this year, so there’s nothing to compare yet.`, card: { type: "link", label: "Open salary slip", go: `#/pay/${k}`, icon: "file" }, follow: PAY_FOLLOW.slice(1) };
    const d = slipDiff(s, p), net = s.net - p.net;
    return {
      text: `Your ${monthName(k, { month: "long" })} take-home was **${money(s.net)}**, ${net === 0 ? "the same as" : `**${money(Math.abs(net))} ${net > 0 ? "more" : "less"}**`} than ${monthName(p.k, { month: "long" })}.${d.length ? `\n${d.map(([l, v]) => `- **${l}** ${/^No loss/.test(l) ? "gave back" : v > 0 ? "added" : "took off"} ${money(Math.abs(v))}`).join("\n")}` : ""}${d.some(([l]) => /bonus/i.test(l)) ? "\nThe bonus also raised this month’s TDS, so part of it went to tax." : ""}`,
      card: { type: "link", label: `Open ${monthName(k, { month: "short" })} salary slip`, go: `#/pay/${k}`, icon: "file" }, follow: ["Download my salary slip", "Which tax regime is better for me?"],
    };
  }
  if (/regime|old or new|new or old/.test(t)) {
    const tNew = taxFor("new"), tOld = taxFor("old"), b = tNew <= tOld ? "new" : "old";
    return { text: `For this year the **${b} regime** is better for you: **${money(Math.min(tNew, tOld))}** in tax vs **${money(Math.max(tNew, tOld))}** on the ${b === "new" ? "old" : "new"} one, a saving of **${money(Math.abs(tNew - tOld))}**. You’re on the **${S.tax.regime}** regime now.`, card: { type: "link", label: "Compare regimes", go: "#/tax", icon: "percent" }, follow: ["How much tax is left this year?", "Show my latest salary slip"] };
  }
  if (/form ?16/.test(t)) return { text: `Form 16 for **FY ${fyStart() - 1}-${String(fyStart()).slice(2)}** is ready to download. This year’s comes after March.`, card: { type: "link", label: "Open Form 16", go: "#/tax", icon: "download" }, follow: PAY_FOLLOW };
  if (/tax|tds|80c|80d|declar|proof|hra/.test(t)) {
    const tax = taxFor(S.tax.regime), paid = months.map(slip).reduce((a, s) => a + s.ded.find(([l]) => /TDS/.test(l))[1], 0);
    const due = DECL.filter((d) => S.tax.decl[d.id].proof === "pending");
    return { text: `Your estimated tax this year is **${money(tax)}**. **${money(paid)}** has been deducted so far, so **${money(Math.max(0, tax - paid))}** is left.${due.length ? `\nProof still due for: ${due.map((d) => `**${d.name}**`).join(", ")} (by 15 Jan).` : ""}`, card: { type: "link", label: "Open tax & declarations", go: "#/tax", icon: "percent" }, follow: ["Which tax regime is better for me?", "Download my Form 16"] };
  }
  if (/pay ?slip|salary|net pay|take.?home|ctc|my pay\b/.test(t)) {
    const k = pick(), s = slip(k);
    return { text: `Your **${monthName(k)}** take-home was **${money(s.net)}**: ${money(s.gross)} earned and ${money(s.deductions)} deducted. It was paid on ${fmtD(s.paidOn, { day: "numeric", month: "short" })} to ${PAY.bank}.`, card: { type: "link", label: /download|pdf/.test(t) ? "Download from the slip" : "Open salary slip", go: `#/pay/${k}`, icon: "file" }, follow: ["Why did my pay change?", "How much tax is left this year?"] };
  }
  return null;
}
const _kaisAnswer = kaisAnswer;
kaisAnswer = function (q) { return payAnswer(q) || _kaisAnswer(q); };
if (typeof PROMPTS !== "undefined") PROMPTS.push(["Payroll", ["Show my latest salary slip", "Why did my pay change?", "Which tax regime is better for me?", "How much tax is left this year?"]]);
