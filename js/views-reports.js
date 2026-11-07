// Reports, built for mobile: not the 49 web reports, but the handful of answers people check on the go, picked by role.
// Each one follows a KEBS web report's data points (sample data where KEBS has none): glanceable numbers, a Kais
// read-out, one or two charts, a short "top" list with See all, row taps into the app, and actions where useful.
// Periods use KEBS's presets plus a custom range. Offline / no-data states are handled.

const RPT = {
  utilization: { name: "Utilization", kebs: "Utilization Report", icon: "users", ms: "attend", sub: "Available vs allocated vs billed hours", roles: ["super", "pm", "csuite", "admin"] },
  timesheet: { name: "Timesheets", kebs: "Timesheet Dashboard", icon: "clipboard", ms: "timesheet", sub: "Hours booked, billable mix and who hasn’t submitted", roles: ["super", "employee", "pm", "csuite", "admin"] },
  project: { name: "Projects", kebs: "Project Efficiency · Project Margin", icon: "briefcase", ms: "onduty", sub: "Health, budget burn and margin", roles: ["super", "pm", "am", "csuite"] },
  sales: { name: "Sales", kebs: "Sales dashboard · Lead Conversion", icon: "target", ms: "crm", sub: "Pipeline, conversion and top deals", roles: ["super", "rep", "sales", "am", "csuite"] },
  revenue: { name: "Revenue", kebs: "Revenue Analysis · Revenue Forecast", icon: "chart", ms: "insights", sub: "Actual vs forecast by account", roles: ["super", "sales", "am", "csuite"], forward: true },
  billing: { name: "Billing & collections", kebs: "Billing Tracker · UBR Aging", icon: "receipt", ms: "bills", sub: "Billed, collected, unbilled revenue ageing", roles: ["super", "am", "csuite", "admin"] },
  bench: { name: "Bench & allocation", kebs: "People Allocation · Bench Aging", icon: "user", ms: "leads", sub: "Who’s on the bench and upcoming roll-offs", roles: ["super", "pm", "csuite", "admin"], forward: true },
};
const rptAllowed = (id) => RPT[id].roles.includes(typeof role === "function" ? role() : "super");

// ── periods (KEBS presets + custom) ──
const FY_START = 3; // April
function rpPreset(key) {
  const t = D.parse(D.today()), y = t.getFullYear(), m = t.getMonth(), iso = (d) => D.iso(d), first = (yy, mm) => new Date(yy, mm, 1), last = (yy, mm) => new Date(yy, mm + 1, 0);
  const fy = m >= FY_START ? y : y - 1, q0 = Math.floor(m / 3) * 3;
  return {
    "this-month": ["This month", iso(first(y, m)), iso(last(y, m))],
    "last-month": ["Last month", iso(first(y, m - 1)), iso(last(y, m - 1))],
    "this-quarter": ["This quarter", iso(first(y, q0)), iso(last(y, q0 + 2))],
    "next-3": ["Upcoming 3 months", iso(first(y, m + 1)), iso(last(y, m + 3))],
    "this-year": ["This year", `${y}-01-01`, `${y}-12-31`],
    "this-fy": [`Current FY ${String(fy).slice(2)}–${String(fy + 1).slice(2)}`, iso(first(fy, FY_START)), iso(last(fy + 1, FY_START - 1))],
    "prev-fy": [`Previous FY ${String(fy - 1).slice(2)}–${String(fy).slice(2)}`, iso(first(fy - 1, FY_START)), iso(last(fy, FY_START - 1))],
  }[key];
}
const RP_KEYS = ["this-month", "last-month", "this-quarter", "this-year", "this-fy", "prev-fy"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function rpR(q, id) {
  let key = q.p || (id === "utilization" || id === "timesheet" || id === "bench" ? "this-month" : "this-quarter"), label, from, to;
  if (q.from && q.to) { key = "custom"; from = q.from; to = q.to; label = D.range(from, to); }
  else { const p = rpPreset(key) || rpPreset((key = "this-month")); [label, from, to] = p; }
  const days = D.days(from, to), weeks = days <= 45, td = D.today();
  let labels;
  if (weeks) labels = Array.from({ length: Math.max(1, Math.ceil(days / 7)) }, (_, i) => `Wk ${i + 1}`);
  else { labels = []; const a = D.parse(from), b = D.parse(to); for (let yy = a.getFullYear(), mm = a.getMonth(); yy < b.getFullYear() || (yy === b.getFullYear() && mm <= b.getMonth()); ) { labels.push(MONTHS[mm]); if (++mm > 11) { mm = 0; yy++; } if (labels.length > 24) break; } }
  return { key, label, from, to, days, weeks, labels, k: days / 30, seed: `${id}|${from}|${to}`, future: from > td, partial: to > td && from <= td };
}

// ── helpers ──
const rpL = (n) => (n >= 1e7 ? `₹${+(n / 1e7).toFixed(2)}Cr` : n >= 1e5 ? `₹${+(n / 1e5).toFixed(1)}L` : n >= 1e3 ? `₹${Math.round(n / 1e3)}K` : `₹${Math.round(n)}`);
const rpH = (n) => `${Math.round(n).toLocaleString("en-IN")}h`;
const rpRand = (seed) => { let h = 2166136261; for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return ((h >>> 0) % 10000) / 10000; };
const rpBetween = (seed, a, b) => a + rpRand(seed) * (b - a);
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const rpDelta = (v, good = "up") => { if (v == null) return ""; const up = v >= 0, ok = good === "up" ? up : !up; return `<span class="rp-delta ${ok ? "ok" : "bad"}">${up ? "▲" : "▼"} ${Math.abs(v)}%</span>`; };
// an icon for each number, picked from its label
const RP_KIC = [[/pipeline|revenue|forecast|per month|recognised/i, "rupee", "#3b82f6"], [/win rate/i, "award", "#16a34a"], [/lead/i, "target", "#8b5cf6"], [/closing/i, "calendar", "#0ea5e9"],
  [/overdue|at risk|not submitted/i, "alert", "#ef4444"], [/unbilled/i, "receipt", "#f59e0b"], [/^billed/i, "receipt", "#3b82f6"], [/collected/i, "wallet", "#16a34a"],
  [/available/i, "users", "#3b82f6"], [/billable|allocated vs|margin/i, "percent", "#16a34a"], [/un-allocated/i, "clock", "#f59e0b"], [/logged|hours/i, "clock", "#3b82f6"],
  [/on time/i, "checkCircle", "#16a34a"], [/my status/i, "clipboard", "#8b5cf6"], [/^active/i, "briefcase", "#3b82f6"], [/over budget/i, "flame", "#f97316"],
  [/account/i, "building", "#64748b"], [/bench/i, "users", "#f59e0b"], [/rolling/i, "history", "#8b5cf6"], [/demand/i, "target", "#16a34a"], [/^allocated/i, "users", "#16a34a"]];
const rpKic = (label) => { const m = RP_KIC.find(([re]) => re.test(label)) || [0, "chart", "#64748b"]; return `<i class="rp-kic" style="--k:${m[2]}">${I(m[1])}</i>`; };
const rpKpi = (label, value, delta, good, sub) => `<div class="rp-kpi"><small>${rpKic(label)}<span>${label}</span></small><b class="num">${value}</b><span class="rp-kpi-f">${rpDelta(delta, good)}${sub ? `<span>${sub}</span>` : ""}</span></div>`;
function rpHbars(rows, { fmt = (v) => v } = {}) {
  const max = Math.max(...rows.map((r) => r.v), 1);
  return `<div class="rp-hbars">${rows.map((r) => `<div class="rp-hb"><span class="rp-hb-l"><span class="ell">${esc(r.l)}</span><b>${fmt(r.v)}</b></span><span class="rp-hb-t"><i style="width:${r.v ? Math.max(3, (r.v / max) * 100) : 0}%;background:${r.c || "color-mix(in srgb, var(--accent) 72%, var(--panel))"}"></i></span>${r.s ? `<small class="muted">${r.s}</small>` : ""}</div>`).join("")}</div>`;
}
let RP_N = 0;
function rpDonut(parts, center, sub) {
  const shown = parts.filter((p) => p.v > 0), tot = shown.reduce((a, p) => a + p.v, 0) || 1, R = 46, SW = 15, C = 2 * Math.PI * R, GAP = shown.length > 1 ? 3 : 0;
  let off = 0;
  const segs = shown.map((p, i) => {
    const L = (p.v / tot) * C, s0 = off + (GAP ? SW / 2 + GAP / 2 : 0), a = ((off + L / 2) / C) * 2 * Math.PI - Math.PI / 2; off += L;
    const x = (50 + Math.cos(a) * 44).toFixed(1), y = (50 + Math.sin(a) * 44).toFixed(1), side = Math.cos(a) >= 0 ? "r" : "l";
    return `<circle class="rp-seg${i ? "" : " on"}" data-act="rpSeg" data-i="${i}" data-x="${x}" data-y="${y}" data-side="${side}" data-l="${esc(p.l)}" data-f="${esc(String(p.f ?? p.v))}" data-p="${Math.round((p.v / tot) * 100)}" data-c="${p.c}" cx="60" cy="60" r="${R}" fill="none" stroke-width="${SW}" stroke-linecap="round" style="stroke:${p.c}" stroke-dasharray="${Math.max(0.1, GAP ? L - SW - GAP : L).toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-s0).toFixed(2)}" transform="rotate(-90 60 60)"/>`;
  }).join("");
  const first = shown[0], a0 = first ? ((first.v / tot) * Math.PI) - Math.PI / 2 : 0;
  const call = first ? rpCallout({ x: (50 + Math.cos(a0) * 44).toFixed(1), y: (50 + Math.sin(a0) * 44).toFixed(1), side: Math.cos(a0) >= 0 ? "r" : "l", l: esc(first.l), f: esc(String(first.f ?? first.v)), p: Math.round((first.v / tot) * 100), c: first.c }) : "";
  return `<div class="rp-donut"><div class="rp-donut-c"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="${R}" fill="none" stroke-width="${SW}" style="stroke:var(--panel-2)"/>${segs}</svg><span><b>${center}</b><small>${sub}</small></span>${call}</div>
    <div class="rp-legend">${parts.map((p) => { const i = shown.indexOf(p); return `<button type="button" class="${i === 0 ? "on" : ""}" ${i < 0 ? "disabled" : `data-act="rpSeg" data-i="${i}"`}><i style="background:${p.c}"></i><span class="ell">${esc(p.l)}</span><b>${p.f ?? p.v}</b></button>`; }).join("")}</div></div>`;
}
const rpCallout = (d) => `<span class="rp-call ${d.side}" style="left:${d.x}%;top:${d.y}%"><span><i style="background:${d.c}"></i>${d.l}</span><b>${d.f}</b><small>${d.p}%</small></span>`;
act("rpSeg", (b) => {
  const box = b.closest(".rp-donut"), i = b.dataset.i, seg = box && box.querySelector(`.rp-seg[data-i="${i}"]`); if (!seg) return;
  box.querySelectorAll(".on").forEach((e) => e.classList.remove("on"));
  seg.classList.add("on"); box.querySelector(`.rp-legend [data-i="${i}"]`)?.classList.add("on");
  box.querySelector(".rp-call")?.remove(); box.querySelector(".rp-donut-c").insertAdjacentHTML("beforeend", rpCallout(seg.dataset));
  try { navigator.vibrate?.(6); } catch {}
});
// smooth line chart (KEBS reports): series [{ v: [..|null], c, dash, label, area }]
const rpNice = (x) => { const p = 10 ** Math.floor(Math.log10(x || 1)), f = x / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };
function rpLine({ series, labels, fmt = (v) => v, height = 160 }) {
  const id = "rpl" + ++RP_N, W = 320, H = height, L = 40, Rt = 12, T = 14, B = 24, iw = W - L - Rt, ih = H - T - B, n = labels.length;
  const all = series.flatMap((x) => x.v.filter((v) => v != null)), step = rpNice((Math.max(...all, 1) || 1) / 4), max = step * Math.max(1, Math.ceil(Math.max(...all, 1) / step));
  const X = (i) => L + (n > 1 ? (i * iw) / (n - 1) : iw / 2), Y = (v) => T + ih - (v / max) * ih;
  const curve = (pts) => pts.map((p, i) => { if (!i) return `M${p[0].toFixed(1)} ${p[1].toFixed(1)}`; const p0 = pts[i - 2] || pts[i - 1], p1 = pts[i - 1], p3 = pts[i + 1] || p;
    const c1 = [p1[0] + (p[0] - p0[0]) / 6, Math.min(T + ih, p1[1] + (p[1] - p0[1]) / 6)], c2 = [p[0] - (p3[0] - p1[0]) / 6, Math.min(T + ih, p[1] - (p3[1] - p1[1]) / 6)];
    return `C${c1.map((v) => v.toFixed(1)).join(" ")} ${c2.map((v) => v.toFixed(1)).join(" ")} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`; }).join(" ");
  const grid = [0, 1, 2, 3, 4].map((k) => { const v = (max / 4) * k, y = Y(v).toFixed(1); return `<line x1="${L}" x2="${W - Rt}" y1="${y}" y2="${y}"/><text x="${L - 6}" y="${(+y + 3.5).toFixed(1)}" text-anchor="end">${fmt(v)}</text>`; }).join("");
  const every = Math.ceil(n / 6), xl = labels.map((l, i) => (i % every === 0 || i === n - 1) && !(i === n - 1 && i % every && i - Math.floor(i / every) * every < every / 2) ? `<text x="${X(i).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(l)}</text>` : "").join("");
  const lines = series.map((sr, si) => {
    const pts = sr.v.map((v, i) => (v == null ? null : [X(i), Y(v)])).filter(Boolean); if (!pts.length) return "";
    const d = curve(pts), last = pts[pts.length - 1];
    const area = sr.area ? `<path class="rp-ln-a" d="${d} L${last[0].toFixed(1)} ${T + ih} L${pts[0][0].toFixed(1)} ${T + ih} Z" fill="url(#${id}g${si})"/>` : "";
    const dots = sr.dash ? "" : pts.map((p, i) => `<circle class="rp-ln-d${i === pts.length - 1 ? " last" : ""}" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i === pts.length - 1 ? 4.5 : 2.6}" style="--c:${sr.c}"/>`).join("");
    return `<defs><linearGradient id="${id}g${si}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sr.c}" stop-opacity=".26"/><stop offset="1" stop-color="${sr.c}" stop-opacity="0"/></linearGradient></defs>${area}<path class="rp-ln${sr.dash ? " dash" : ""}" d="${d}" style="stroke:${sr.c}"/>${dots}`;
  }).join("");
  const lastS = series.find((x) => !x.dash) || series[0], lv = [...lastS.v].reverse().find((v) => v != null);
  const legend = series.length > 1 ? `<div class="rp-lg">${series.map((x) => `<span><i class="${x.dash ? "dash" : ""}" style="--c:${x.c}"></i>${esc(x.label)}</span>`).join("")}</div>` : "";
  return `<div class="rp-line"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(lastS.label || "Trend")}, latest ${esc(String(fmt(lv ?? 0)))}"><g class="rp-ln-g">${grid}${xl}</g>${lines}</svg>${legend}</div>`;
}
// an icon for each card title
const RP_CIC = [[/bench|rolling/i, "users", "#f59e0b"], [/billable|utilisation|capacity/i, "chart", "#3b82f6"], [/budget/i, "wallet", "#f97316"], [/collected|overdue invoice/i, "wallet", "#16a34a"],
  [/funnel|lead/i, "target", "#8b5cf6"], [/hours/i, "clock", "#3b82f6"], [/leave/i, "calendar", "#0ea5e9"], [/pipeline|deals/i, "briefcase", "#3b82f6"], [/timesheet status|not submitted/i, "clipboard", "#8b5cf6"],
  [/unbilled|ubr/i, "receipt", "#f59e0b"], [/forecast|actual|account/i, "rupee", "#16a34a"], [/projects/i, "briefcase", "#0d9488"]];
const rpCic = (t) => { const m = RP_CIC.find(([re]) => re.test(t)); return m ? `<i class="rp-kic" style="--k:${m[2]}">${I(m[1])}</i>` : ""; };
const rpCard = (title, body, aside = "") => `<div class="card rp-card"><div class="rp-ch"><h3>${rpCic(title)}${title}</h3>${aside}</div>${body}</div>`;
const rpInsight = (lines) => `<div class="rp-insight"><img src="kais.svg" alt=""><div><b>Kais read-out</b>${lines.filter(Boolean).map((l) => `<p>${l}</p>`).join("")}</div></div>`;
// a short list (top 5) with "See all" opening the full list in a sheet
const RP_LISTS = {};
function rpList(key, title, rows, { empty = "Nothing here for this period.", emptyIcon = "checkCircle", action = "" } = {}) {
  RP_LISTS[key] = { title, rows };
  const body = rows.length ? `<div class="rp-rows">${rows.slice(0, 5).map(rpRow).join("")}</div>${action}` : emptyMini(emptyIcon, empty);
  return rpCard(title, body, rows.length > 5 ? `<button class="link" data-act="rpAll" data-k="${key}">See all (${rows.length})</button>` : "");
}
const rpRow = (r) => `<${r.go ? `button data-go="${r.go}"` : "div"} class="rp-row">${r.lead || ""}<span class="grow" style="min-width:0"><b class="ell">${r.t}</b>${r.s ? `<small class="ell">${r.s}</small>` : ""}</span>${r.v != null ? `<span class="rp-row-v">${r.v}</span>` : ""}${r.go ? I("chevR") : ""}</${r.go ? "button" : "div"}>`;
act("rpAll", (b) => { const l = RP_LISTS[b.dataset.k]; if (l) openSheet({ title: l.title, body: `<div class="rp-rows">${l.rows.map(rpRow).join("")}</div>` }); });
const rpAv = (id) => (typeof avatar === "function" && S.people.some((p) => p.id === id) || id === "me" ? avatar(id, "sm") : `<span class="av sm crm-av t-slate">${esc(initials(id))}</span>`);

// export: CSV of the main list
let RP_EXPORT = null;
const plain = (s) => String(s ?? "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();
act("rpExport", () => {
  const x = RP_EXPORT; if (!x) return;
  const csv = [x.cols, ...x.rows].map((r) => r.map((c) => `"${plain(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const text = `${x.name}\n\n${[x.cols, ...x.rows].map((r) => r.map(plain).join(" · ")).join("\n")}`;
  const s = openSheet({ title: "Export report", body: `<div class="list">
      <button class="opt-row" data-s="csv"><span class="ic">${I("download")}</span><span class="grow"><span class="b">Download CSV</span><span class="small muted" style="display:block">Opens in Excel, Sheets or Numbers</span></span></button>
      <button class="opt-row" data-s="share"><span class="ic">${I("send")}</span><span class="grow"><span class="b">Share summary</span><span class="small muted" style="display:block">Send the list as text</span></span></button></div>`,
    onMount(el) { onS(el, {
      csv() { closeSheet(s); try { const a = document.createElement("a"); a.href = "data:text/csv;charset=utf-8," + encodeURIComponent("﻿" + csv); a.download = x.name.replace(/[^\w ]+/g, "").replace(/\s+/g, "-") + ".csv"; a.click(); toast("CSV downloaded"); } catch { toast("Couldn’t download here — try Share", "bad"); } },
      share() { closeSheet(s); if (navigator.share) navigator.share({ title: x.name, text }).catch(() => {}); else navigator.clipboard?.writeText(text).then(() => toast("Copied to clipboard"), () => toast("Couldn’t copy", "bad")); },
    }); } });
});

// page frame: period filter, offline / no-data handling
function rpFrame(id, q, r, build) {
  const def = RPT[id], keys = def.forward ? [...RP_KEYS.slice(0, 3), "next-3", ...RP_KEYS.slice(3)] : RP_KEYS;
  const head = `<div class="screen">${topbar(def.name, { sub: r.label, right: `<button class="ib" data-act="rpExport" aria-label="Export report">${I("download")}</button>` })}<div class="scroll"><div class="stack" style="padding-top:4px">
    ${filterHead(r.key === "custom" ? "Custom period" : "Overview", "rpPer", r.key, [...keys.map((k) => [k, rpPreset(k)[0], "calendar", D.range(rpPreset(k)[1], rpPreset(k)[2])]), ["custom", r.key === "custom" ? r.label : "Custom range…", "calendar", r.key === "custom" ? `${plural(r.days, "day")} · tap to change` : "Pick any start and end date"]], "Period")}`;
  const tail = `<p class="tiny muted rp-src">From KEBS · ${esc(def.kebs)}${typeof NET !== "undefined" && NET.state !== "online" && S.rpSeen?.[id] ? ` · saved ${D.ago(S.rpSeen[id]) === "now" ? "just now" : D.ago(S.rpSeen[id]) + " ago"}` : ""}</p></div></div></div>`;
  // offline and never loaded: nothing to show
  if (typeof NET !== "undefined" && NET.state === "offline" && !S.rpSeen?.[id]) { RP_EXPORT = null; return head + netOfflineState("Connect to load this report", "Reports need a connection the first time. Once loaded, they stay available offline.") + tail; }
  // a period with no data yet
  if (r.future && !def.forward) { RP_EXPORT = null; return head + emptyState(["calendar"], "No data for this period yet", `${r.label} hasn’t started. Pick a period that has already begun.`, `<button class="btn primary" data-act="rpPer" data-v="this-month">Show this month</button>`) + tail; }
  (S.rpSeen ||= {})[id] = Date.now(); save();
  const out = build();
  RP_EXPORT = { name: `${def.name} report – ${r.label}`, cols: out.cols, rows: out.rows };
  return head + `<div class="rp-kpis">${out.kpis.join("")}</div>${out.insight ? rpInsight(out.insight) : ""}${out.body.join("")}` + tail;
}
act("rpPer", (b) => {
  const { path, q } = parseHash();
  if (b.dataset.v !== "custom") return swap(`#/${path}?p=${b.dataset.v}`);
  pickDates({ title: "Report period", mode: "range", start: q.from || D.add(D.today(), -29), end: q.to || D.today(), onDone: ({ start, end }) => swap(`#/${path}?from=${start}&to=${end}`) });
});
const rpLocked = (id) => `<div class="screen">${topbar(RPT[id].name)}<div class="scroll">${emptyState(["chart"], "This report isn’t part of your role", `You’re viewing KEBS as ${roleDef().name}. Ask your admin for access, or switch role to try it.`, `<button class="btn primary" data-act="pickRole">Switch role</button>`)}</div></div>`;

// ── hub: the reports for your role, each with its headline number ──
route("reports", () => {
  const ids = Object.keys(RPT).filter(rptAllowed);
  const off = typeof NET !== "undefined" && NET.state === "offline";
  return `<div class="screen">${topbar("Reports")}
    <div class="scroll"><div class="stack" style="padding-top:4px">
      <p class="small muted" style="margin:0 4px 2px">The numbers that matter for ${typeof roleDef === "function" && role() !== "super" ? `a ${roleDef().name.toLowerCase()}` : "your work"}. Tap one for detail.</p>
      ${ids.length ? `<div class="rp-hub">${ids.map((id) => { const h = rpHeadline(id); return `<button class="card rp-tile" data-go="#/reports/${id}"><span class="tico ms">${msIcon(RPT[id].ms)}</span><span class="grow" style="min-width:0"><b>${RPT[id].name}</b><small class="muted">${RPT[id].sub}</small>${off && !S.rpSeen?.[id] ? `<span class="rp-peek muted">${I("wifiOff")}Needs a connection</span>` : `<span class="rp-peek">${h}</span>`}</span>${I("chevR")}</button>`; }).join("")}</div>`
        : emptyState(["chart"], "No reports for your role", "Reports appear here when your role includes them.", `<button class="btn primary" data-act="pickRole">Switch role</button>`)}
      <div class="rp-web">${I("globe")}<span class="grow">Need something else? <b>49 detailed reports</b> are on KEBS web — logs, pivots, Gantt views and more.</span></div>
    </div></div></div>`;
});
function rpHeadline(id) {
  const q = {}, r = rpR(q, id);
  try {
    if (id === "utilization") { const u = rpUtilData(r); return `${pct(u.billed, u.avail)}% billed · ${pct(u.alloc, u.avail)}% allocated`; }
    if (id === "timesheet") { const t = rpTsData(r); return `${t.unsub.length} not submitted · ${pct(t.bill, t.booked)}% billable`; }
    if (id === "project") { const a = pjList().filter((p) => p.status === "active"); return `${a.length} active · ${a.filter((p) => typeof pjRisk === "function" && pjRisk(p)).length} at risk`; }
    if (id === "sales") return `${rpL(crmOpenDeals().reduce((a, d) => a + d.value, 0))} open pipeline`;
    if (id === "revenue") { const v = rpRevData(r); return `${rpL(v.actual)} · ${pct(v.actual, v.forecast)}% of forecast`; }
    if (id === "billing") { const b = rpBillData(); return `${rpL(b.out)} outstanding · ${rpL(b.ubr)} unbilled`; }
    if (id === "bench") { const b = rpBenchData(r); return `${b.bench.length} on bench · ${b.rolloff.length} rolling off soon`; }
  } catch { return ""; }
  return "";
}
route("reports/:id", ({ id }, q) => {
  if (!RPT[id]) return `<div class="screen">${topbar("Report")}${emptyState(["chart"], "Report not found", "It may have moved.", `<button class="btn primary" data-go="#/reports">All reports</button>`)}</div>`;
  if (!rptAllowed(id)) return rpLocked(id);
  const r = rpR(q, id);
  return rpFrame(id, q, r, () => ({ utilization: rpUtil, timesheet: rpTs, project: rpProj, sales: rpSales, revenue: rpRev, billing: rpBill, bench: rpBench }[id](r)));
}, { parent: "#/reports" });

// ── 1. Utilization (KEBS Utilization Report) ──
const RP_REGIONS = [["India", 96], ["US", 22], ["UK", 9], ["Canada", 7], ["Netherlands", 5], ["Costa Rica", 6], ["Chile", 4], ["El Salvador", 3], ["Australia", 4]];
function rpUtilData(r) {
  const wd = Math.max(1, Math.round(r.days * 5 / 7));
  const regions = RP_REGIONS.map(([name, hc]) => { const s = r.seed + name, avail = hc * 8 * wd, alloc = avail * rpBetween(s + "a", 0.68, 0.94), logged = alloc * rpBetween(s + "l", 0.86, 1.02), billed = logged * rpBetween(s + "b", 0.7, 0.93);
    return { name, hc, avail, alloc, logged, billed, un: avail - alloc }; });
  const sum = (k) => regions.reduce((a, x) => a + x[k], 0);
  return { regions, avail: sum("avail"), alloc: sum("alloc"), logged: sum("logged"), billed: sum("billed"), un: sum("un") };
}
function rpUtil(r) {
  const u = rpUtilData(r), low = [...u.regions].sort((a, b) => a.billed / a.avail - b.billed / b.avail)[0];
  return {
    kpis: [rpKpi("Available vs allocated", `${pct(u.alloc, u.avail)}%`, Math.round(rpBetween(r.seed + "d1", -4, 7)), "up", `${rpH(u.alloc)} of ${rpH(u.avail)}`),
      rpKpi("Allocated vs billed", `${pct(u.billed, u.alloc)}%`, Math.round(rpBetween(r.seed + "d2", -3, 6)), "up", `${rpH(u.billed)} billed`),
      rpKpi("Un-allocated", rpH(u.un), Math.round(rpBetween(r.seed + "d3", -8, 5)), "down", `${pct(u.un, u.avail)}% of capacity`),
      rpKpi("Logged", rpH(u.logged), null, "up", `${pct(u.logged, u.alloc)}% of allocated`)],
    insight: [`<b>${pct(u.billed, u.avail)}%</b> of available hours were billed.`, `${esc(low.name)} has the lowest billed utilisation (${pct(low.billed, low.avail)}%) — ${rpH(low.un)} un-allocated.`],
    body: [rpCard("Capacity", rpDonut([{ l: "Billed", v: u.billed, c: "var(--ok)", f: rpH(u.billed) }, { l: "Allocated, not billed", v: u.alloc - u.billed, c: "#3b82f6", f: rpH(u.alloc - u.billed) }, { l: "Un-allocated", v: u.un, c: "#94a3b8", f: rpH(u.un) }], `${pct(u.billed, u.avail)}%`, "billed")),
      rpCard("Billed utilisation trend", rpLine({ labels: r.labels, fmt: (v) => `${Math.round(v)}%`, series: [{ label: "Billed", c: "var(--accent)", area: true, v: r.labels.map((l, i) => Math.round(rpBetween(r.seed + l + "ut", 58, 78))) }] })),
      rpCard("Billed utilisation by region", rpHbars([...u.regions].sort((a, b) => b.billed / b.avail - a.billed / a.avail).map((x) => ({ l: x.name, v: pct(x.billed, x.avail), c: rangeColor(x.billed / x.avail / 0.8), s: `${x.hc} people · ${rpH(x.un)} un-allocated` })), { fmt: (v) => `${v}%` }))],
    cols: ["Region", "Available", "Allocated", "Logged", "Billed", "Un-allocated"], rows: u.regions.map((x) => [x.name, rpH(x.avail), rpH(x.alloc), rpH(x.logged), rpH(x.billed), rpH(x.un)]),
  };
}

// ── 2. Timesheets (KEBS Timesheet Dashboard) ──
function rpTsData(r) {
  const mine = typeof role === "function" && role() === "employee";
  const team = mine ? ["me"] : ["me", "jh", "rb", "al", "pb", "sl", "vi", "as", "dr", "ww", "jr", "jre", "sj", "pr", "vj"];
  const wd = Math.max(1, Math.round(r.days * 5 / 7)), now = r.partial ? Math.max(1, Math.round(D.days(r.from, D.today()) * 5 / 7)) : wd;
  const people = team.map((id, i) => { const s = r.seed + id, booked = Math.round(now * 8 * rpBetween(s + "h", 0.82, 1.02)), bill = Math.round(booked * rpBetween(s + "b", 0.55, 0.92));
    const st = ["Approved", "Approved", "Approved", "Submitted", "Submitted", "Draft", "Rejected", "Not submitted"][Math.floor(rpRand(s + "st") * 8)];
    return { id, aid: `AG${1040 + i * 7}`, booked, bill, status: st, emp: ["Full-time", "Full-time", "Full-time", "Contract", "Intern"][Math.floor(rpRand(s + "e") * 5)] }; });
  const unsub = people.filter((p) => p.status === "Draft" || p.status === "Not submitted");
  const booked = people.reduce((a, p) => a + p.booked, 0), bill = people.reduce((a, p) => a + p.bill, 0);
  const statuses = ["Approved", "Submitted", "Draft", "Rejected", "Not submitted"].map((s) => [s, people.filter((p) => p.status === s).length]);
  const leave = [["Casual", "t-blue"], ["Sick", "t-red"], ["Earned", "t-green"], ["Comp off", "t-amber"]].map(([l, t]) => ({ l, v: Math.round(rpBetween(r.seed + l, 1, 9) * r.k * (mine ? 0.2 : 1)), c: `var(--c-${t})` }));
  // weeks / months already past get bars; the rest are shown as still to come
  const done = r.future ? 0 : r.partial ? Math.max(1, Math.ceil(r.labels.length * D.days(r.from, D.today()) / r.days)) : r.labels.length;
  const perLabel = (team.length * wd * 8) / r.labels.length;
  const trend = r.labels.map((_, i) => (i < done ? Math.round(perLabel * rpBetween(r.seed + "t" + i, 0.8, 1.02)) : 0));
  return { mine, people, unsub, booked, bill, statuses, leave, trend, done, perLabel, cap: team.length * now * 8 };
}
function rpTs(r) {
  const t = rpTsData(r), ontime = pct(t.people.length - t.unsub.length - t.statuses.find((s) => s[0] === "Rejected")[1], t.people.length);
  const SC = { Approved: "var(--ok)", Submitted: "#3b82f6", Draft: "#e9b44c", Rejected: "var(--danger)", "Not submitted": "#94a3b8" };
  return {
    kpis: [rpKpi("Hours booked", rpH(t.booked), Math.round(rpBetween(r.seed + "k1", -3, 8)), "up", `of ${rpH(t.cap)} capacity${r.partial ? " so far" : ""}`), rpKpi("Billable", `${pct(t.bill, t.booked)}%`, Math.round(rpBetween(r.seed + "k2", -2, 6)), "up", rpH(t.bill)),
      rpKpi("Submitted on time", `${ontime}%`, Math.round(rpBetween(r.seed + "k3", -5, 5)), "up"), rpKpi(t.mine ? "My status" : "Not submitted", t.mine ? t.people[0].status : t.unsub.length, null, "down", t.mine ? "" : plural(t.people.length, "person"))],
    insight: t.mine ? [`You booked <b>${rpH(t.booked)}</b>, ${pct(t.bill, t.booked)}% billable.`] : [t.unsub.length ? `<b>${plural(t.unsub.length, "person")}</b> haven’t submitted — you can remind them below.` : "Everyone has submitted their timesheets.", `Billable mix is ${pct(t.bill, t.booked)}%.`],
    body: [rpCard("Hours booked", rpLine({ labels: r.labels, fmt: (v) => rpH(v), series: [{ label: "Booked", c: "var(--accent)", area: true, v: t.trend.map((v, i) => (i < t.done ? v : null)) }, { label: "Capacity", c: "#94a3b8", dash: true, v: r.labels.map(() => Math.round(t.perLabel)) }] })),
      rpCard("Timesheet status", rpDonut(t.statuses.map(([l, v]) => ({ l, v, c: SC[l] })), t.people.length, t.mine ? "timesheet" : "people")),
      t.mine ? "" : rpList("unsub", "Not submitted", t.unsub.map((p) => ({ lead: rpAv(p.id), t: esc(p.id === "me" ? "You" : person(p.id).name), s: `${p.aid} · ${p.status}`, v: rpH(p.booked) })), { empty: "Everyone has submitted — nice.", action: t.unsub.length ? `<button class="btn primary block rp-act" data-act="rpRemind" data-n="${t.unsub.length}">${I("bell")}Remind ${plural(t.unsub.length, "person")}</button>` : "" }),
      rpCard("Billable vs non-billable", rpDonut([{ l: "Billable", v: t.bill, c: "var(--ok)", f: rpH(t.bill) }, { l: "Non-billable", v: t.booked - t.bill, c: "#94a3b8", f: rpH(t.booked - t.bill) }], `${pct(t.bill, t.booked)}%`, "billable")),
      rpCard("Leave taken by type", rpHbars(t.leave, { fmt: (v) => plural(v, "day") }))],
    cols: ["Associate ID", "Name", "Status", "Booked", "Billable"], rows: t.people.map((p) => [p.aid, p.id === "me" ? "You" : person(p.id).name, p.status, rpH(p.booked), `${pct(p.bill, p.booked)}%`]),
  };
}
act("rpRemind", (b) => { try { navigator.vibrate?.(12); } catch {} toast(`Reminder sent to ${plural(Number(b.dataset.n), "person")}`); b.disabled = true; b.innerHTML = `${I("check")}Reminded`; });

// ── 3. Projects (KEBS Project Efficiency / Margin) ──
function rpProj(r) {
  const rows = pjList().map((x) => { const hrs = Math.round(pjMins(x) / 60), used = x.budget ? hrs / x.budget : null, risk = typeof pjRisk === "function" && pjRisk(x), margin = /internal/i.test(x.client) || x.internal ? null : Math.round(rpBetween(r.seed + x.id, 8, 42)); return { x, hrs, used, risk, margin, prog: pjProg(x) }; });
  const act = rows.filter((v) => v.x.status === "active"), risky = act.filter((v) => v.risk), withM = rows.filter((v) => v.margin != null);
  const avgM = withM.length ? Math.round(withM.reduce((a, v) => a + v.margin, 0) / withM.length) : 0;
  return {
    kpis: [rpKpi("Active", act.length, null, "up", `${rows.filter((v) => v.x.status === "done").length} completed`), rpKpi("At risk", risky.length, null, "down", risky.length ? "need attention" : "all on track"),
      rpKpi("Avg margin", `${avgM}%`, Math.round(rpBetween(r.seed + "m", -4, 5)), "up", "client projects"), rpKpi("Over budget", rows.filter((v) => v.used > 1).length, null, "down", `${rows.filter((v) => v.used != null).length} with budgets`)],
    insight: risky.length ? [`<b>${risky.length}</b> project${risky.length > 1 ? "s are" : " is"} at risk: ${risky.map((v) => esc(pjName(v.x))).slice(0, 2).join(", ")}.`, withM.length ? `Lowest margin: ${esc(pjName(withM.sort((a, b) => a.margin - b.margin)[0].x))} (${withM[0].margin}%).` : ""] : ["Every active project is on track."],
    body: [rpCard("Budget used", rpHbars(rows.filter((v) => v.used != null).sort((a, b) => b.used - a.used).map((v) => ({ l: pjName(v.x), v: Math.round(v.used * 100), c: rangeColor(v.used, "low"), s: `${v.hrs}h of ${v.x.budget}h` })), { fmt: (v) => `${v}%` })),
      rpList("proj", "Projects", rows.sort((a, b) => (b.risk ? 1 : 0) - (a.risk ? 1 : 0)).map((v) => ({ lead: `<span class="pj-ic tint ${v.x.tint}">${I(pjIcon(v.x))}</span>`, t: esc(pjName(v.x)), s: `${Math.round(v.prog * 100)}% done · ${v.margin != null ? `${v.margin}% margin` : "internal"}`, v: v.x.status === "done" ? "Done" : v.x.status === "hold" ? "On hold" : v.risk ? `<span class="rp-bad">At risk</span>` : "On track", go: `#/projects/${v.x.id}` })))],
    cols: ["Project", "Progress", "Hours", "Margin", "Status"], rows: rows.map((v) => [pjName(v.x), `${Math.round(v.prog * 100)}%`, `${v.hrs}h`, v.margin != null ? `${v.margin}%` : "—", v.x.status === "done" ? "Completed" : v.x.status === "hold" ? "On hold" : v.risk ? "At risk" : "On track"]),
  };
}

// ── 4. Sales (KEBS Sales dashboard / Lead Conversion) ──
function rpSales(r) {
  const open = crmOpenDeals(), deals = S.crm.deals, won = deals.filter((d) => d.stage === "won"), lost = deals.filter((d) => d.stage === "lost"), leads = S.crm.leads;
  const qual = leads.filter((l) => ["qualified", "converted"].includes(l.status)).length, conv = leads.filter((l) => l.status === "converted").length + won.length;
  const funnel = [["Leads", leads.length + deals.length], ["Qualified", qual + deals.length], ["Proposal+", deals.filter((d) => ["proposal", "negotiation", "won"].includes(d.stage)).length], ["Won", won.length]];
  const winRate = won.length + lost.length ? pct(won.length, won.length + lost.length) : 0;
  return {
    kpis: [rpKpi("Open pipeline", rpL(open.reduce((a, d) => a + d.value, 0)), Math.round(rpBetween(r.seed + "s1", -4, 14)), "up", plural(open.length, "deal")), rpKpi("Win rate", `${winRate}%`, Math.round(rpBetween(r.seed + "s2", -4, 8)), "up", `${won.length} won · ${lost.length} lost`),
      rpKpi("Lead → deal", `${pct(deals.length, leads.length + deals.length)}%`, null, "up", "conversion"), rpKpi("Closing in 30 days", rpL(open.filter((d) => d.close <= D.add(D.today(), 30)).reduce((a, d) => a + d.value, 0)), null, "up", plural(open.filter((d) => d.close <= D.add(D.today(), 30)).length, "deal"))],
    insight: [`Biggest drop-off is from <b>${funnel[1][1] - funnel[2][1] > funnel[2][1] - funnel[3][1] ? "Qualified to Proposal" : "Proposal to Won"}</b>.`, `${plural(open.filter((d) => d.close < D.today()).length, "deal")} are past their close date.`],
    body: [rpCard("Conversion funnel", `<div class="rp-funnel">${funnel.map(([l, v], i) => `<div class="rp-fn"><span class="rp-fn-bar" style="width:${Math.max(18, pct(v, funnel[0][1]))}%"><b>${v}</b></span><span class="rp-fn-l">${l}${i ? `<small>${pct(v, funnel[i - 1][1])}% of previous</small>` : ""}</span></div>`).join("")}</div>`),
      rpCard("Lead conversion", rpLine({ labels: r.labels, fmt: (v) => `${Math.round(v)}%`, series: [{ label: "Conversion", c: "#14b8a6", area: true, v: r.labels.map((l, i) => Math.round(rpBetween(r.seed + l + "cv", 8, 22) + i * 0.8)) }] }), `<span class="tiny muted">lead → deal</span>`),
      rpCard("Pipeline by stage", rpHbars(CRM_OPEN.map((s) => { const ds = open.filter((d) => d.stage === s); return { l: stageName(s), v: ds.reduce((a, d) => a + d.value, 0), c: STAGE_C[s], s: plural(ds.length, "deal") }; }), { fmt: rpL })),
      rpList("deals", "Top open deals", [...open].sort((a, b) => b.value - a.value).map((d) => ({ lead: `<i class="crm-sdot" style="background:${STAGE_C[d.stage]};margin:0 9px"></i>`, t: esc(d.name), s: `${esc(d.company)} · ${stageName(d.stage)}`, v: rpL(d.value), go: `#/crm/deal/${d.id}` })), { empty: "No open deals.", emptyIcon: "target" })],
    cols: ["Deal", "Company", "Stage", "Value", "Close"], rows: deals.map((d) => [d.name, d.company, stageName(d.stage), rpL(d.value), D.short(d.close)]),
  };
}

// ── 5. Revenue (KEBS Revenue Analysis / Forecast) ──
const RP_ACCOUNTS = ["Zifo Technologies", "Prima Technologies", "Northwind Retail", "Bluepeak Logistics", "Lumen Healthcare", "NextGen Corp", "Helio Pharma"];
function rpRevData(r) {
  const per = r.weeks ? 0.25 : 1, td = D.today();
  const forecastSeries = r.labels.map((l, i) => Math.round((4000000 + i * 110000 + rpBetween(r.seed + l + "f", 0, 600000)) * per));
  const done = r.future ? 0 : r.partial ? Math.max(1, Math.ceil(r.labels.length * D.days(r.from, td) / r.days)) : r.labels.length;
  const actualSeries = forecastSeries.map((f, i) => (i < done ? Math.round(f * rpBetween(r.seed + i + "a", 0.86, 1.08)) : 0));
  const actual = actualSeries.reduce((a, v) => a + v, 0), forecast = forecastSeries.reduce((a, v) => a + v, 0);
  const accounts = RP_ACCOUNTS.map((c) => ({ l: c, v: rpBetween(r.seed + c, 0.05, 0.3) })); const tw = accounts.reduce((a, x) => a + x.v, 0);
  accounts.forEach((x) => { x.v = Math.round((x.v / tw) * (actual || forecast)); x.f = Math.round(x.v * rpBetween(r.seed + x.l + "fc", 0.9, 1.15)); });
  return { forecastSeries, actualSeries, done, actual, forecast, accounts: accounts.sort((a, b) => b.v - a.v), recognized: Math.round(actual * 0.88) };
}
function rpRev(r) {
  const v = rpRevData(r), ahead = v.actual >= v.forecast * (v.done / v.forecastSeries.length || 1);
  return {
    kpis: r.future ? [rpKpi("Forecast", rpL(v.forecast), null, "up", r.label), rpKpi("Accounts", v.accounts.length, null, "up", "in forecast"), rpKpi("Largest", rpL(v.accounts[0].f), null, "up", esc(v.accounts[0].l)), rpKpi("Per month", rpL(v.forecast / v.forecastSeries.length), null, "up", "average")]
      : [rpKpi("Revenue", rpL(v.actual), Math.round(rpBetween(r.seed + "g", -3, 14)), "up", "vs last period"), rpKpi("vs forecast", `${pct(v.actual, v.forecast)}%`, null, "up", `of ${rpL(v.forecast)}`),
        rpKpi("Recognised", rpL(v.recognized), null, "up", `${rpL(v.actual - v.recognized)} not yet`), rpKpi("Top account", `${pct(v.accounts[0].v, v.actual)}%`, null, "down", esc(v.accounts[0].l))],
    insight: r.future ? [`<b>${rpL(v.forecast)}</b> forecast for ${esc(r.label.toLowerCase())}.`] : [`Revenue is ${ahead ? "on or ahead of" : "behind"} forecast so far (${pct(v.actual, v.forecast)}% of the period’s forecast).`, `${esc(v.accounts[0].l)} brings ${pct(v.accounts[0].v, v.actual)}% of revenue.`],
    body: [rpCard(r.future ? "Forecast" : "Actual vs forecast", rpLine({ labels: r.labels, fmt: rpL, series: r.future ? [{ label: "Forecast", c: "var(--accent)", area: true, v: v.forecastSeries }] : [{ label: "Actual", c: "var(--accent)", area: true, v: v.actualSeries.map((x, i) => (i < v.done ? x : null)) }, { label: "Forecast", c: "#94a3b8", dash: true, v: v.forecastSeries }] })),
      rpList("acc", "By account", v.accounts.map((x) => ({ lead: `<span class="av sm crm-av t-slate">${esc(initials(x.l))}</span>`, t: esc(x.l), s: r.future ? "forecast" : `${pct(x.v, x.f)}% of forecast`, v: rpL(r.future ? x.f : x.v) })))],
    cols: ["Account", r.future ? "Forecast" : "Revenue", "Forecast"], rows: v.accounts.map((x) => [x.l, rpL(r.future ? x.f : x.v), rpL(x.f)]),
  };
}

// ── 6. Billing & collections (KEBS Billing Tracker / UBR Aging) ──
function rpBillData() {
  const td = D.today();
  const inv = RP_ACCOUNTS.flatMap((c, ci) => [0, 1].map((k) => {
    const s = c + k, issued = D.add(td, -Math.round(rpBetween(s + "i", 3, 75))), due = D.add(issued, 30), amt = Math.round(rpBetween(s + "a", 180, 1600)) * 1000;
    const paid = rpRand(s + "p") > 0.55 ? amt : rpRand(s + "q") > 0.6 ? Math.round(amt * 0.4) : 0;
    return { no: `INV-2026-${String(140 + ci * 2 + k).padStart(4, "0")}`, client: c, issued, due, amt, paid, left: amt - paid, overdue: amt > paid && due < td, age: Math.max(0, D.diff(due, td)) };
  }));
  const ubrB = [["0–30 days", 0.42], ["31–60 days", 0.27], ["61–90 days", 0.18], ["90+ days", 0.13]], ubr = 4380000;
  return { inv, billed: inv.reduce((a, i) => a + i.amt, 0), collected: inv.reduce((a, i) => a + i.paid, 0), out: inv.reduce((a, i) => a + i.left, 0), ubr, ubrAging: ubrB.map(([l, f], i) => ({ l, v: Math.round(ubr * f), c: ["#94a3b8", "#e9b44c", "#f97316", "var(--danger)"][i] })) };
}
function rpBill(r) {
  const b = rpBillData(), od = b.inv.filter((i) => i.overdue).sort((x, y) => y.age - x.age);
  return {
    kpis: [rpKpi("Billed", rpL(b.billed), Math.round(rpBetween(r.seed + "b1", 0, 12)), "up", plural(b.inv.length, "invoice")), rpKpi("Collected", rpL(b.collected), null, "up", `${pct(b.collected, b.billed)}% of billed`),
      rpKpi("Overdue", rpL(od.reduce((a, i) => a + i.left, 0)), null, "down", plural(od.length, "invoice")), rpKpi("Unbilled (UBR)", rpL(b.ubr), Math.round(rpBetween(r.seed + "b4", -6, 6)), "down", `${pct(b.ubrAging[3].v, b.ubr)}% over 90 days`)],
    insight: [od.length ? `<b>${plural(od.length, "invoice")}</b> overdue — the oldest is ${esc(od[0].client)} at ${od[0].age} days.` : "No overdue invoices.", `${rpL(b.ubrAging[3].v)} of revenue has been unbilled for over 90 days.`],
    body: [rpCard("Collected vs outstanding", rpDonut([{ l: "Collected", v: b.collected, c: "var(--ok)", f: rpL(b.collected) }, { l: "Outstanding", v: b.out, c: "#e9b44c", f: rpL(b.out) }], `${pct(b.collected, b.billed)}%`, "collected")),
      rpList("od", "Overdue invoices", od.map((i) => ({ lead: `<span class="av sm crm-av t-red">${esc(initials(i.client))}</span>`, t: esc(i.client), s: `${i.no} · ${i.age} days overdue`, v: rpL(i.left) })), { empty: "Nothing overdue — collections are on track.", action: od.length ? `<button class="btn outline block rp-act" data-act="rpChase" data-n="${od.length}">${I("mail")}Send payment reminders</button>` : "" }),
      rpCard("Unbilled revenue ageing (UBR)", rpHbars(b.ubrAging, { fmt: rpL }))],
    cols: ["Invoice", "Client", "Amount", "Paid", "Status"], rows: b.inv.map((i) => [i.no, i.client, rpL(i.amt), rpL(i.paid), i.left === 0 ? "Paid" : i.overdue ? `Overdue ${i.age}d` : "Due"]),
  };
}
act("rpChase", (b) => { toast(`Payment reminders queued for ${plural(Number(b.dataset.n), "client")}`); b.disabled = true; b.innerHTML = `${I("check")}Reminders queued`; });

// ── 7. Bench & allocation (KEBS People Allocation / Bench Aging / Demobilization) ──
const RP_SKILLS = ["React", "Java", "Data engineering", "QA automation", "SAP ABAP", "UI/UX", ".NET", "DevOps"];
function rpBenchData(r) {
  const pool = ["vi", "jr", "jre", "sj", "ww", "dr", "sl", "pb", "al"].map((id, i) => ({ id, skill: RP_SKILLS[i % RP_SKILLS.length], days: Math.round(rpBetween(r.seed + id, 2, 75)) }));
  const bench = pool.slice(0, 5).sort((a, b) => b.days - a.days);
  const rolloff = pool.slice(5).map((p) => ({ ...p, date: D.add(D.today(), Math.round(rpBetween(r.seed + p.id + "r", 3, 28))), project: pjName(pjList()[Math.floor(rpRand(p.id) * pjList().length)]) })).sort((a, b) => a.date.localeCompare(b.date));
  const total = 152, allocated = total - bench.length * 4 - 3;
  return { total, allocated, bench, rolloff, demand: 7, aging: [["0–15 days", "var(--ok)"], ["16–30 days", "#e9b44c"], ["31–60 days", "#f97316"], ["60+ days", "var(--danger)"]].map(([l, c], i) => ({ l, c, v: bench.filter((b) => (i === 0 ? b.days <= 15 : i === 1 ? b.days > 15 && b.days <= 30 : i === 2 ? b.days > 30 && b.days <= 60 : b.days > 60)).length })) };
}
function rpBench(r) {
  const b = rpBenchData(r);
  return {
    kpis: [rpKpi("Allocated", `${pct(b.allocated, b.total)}%`, Math.round(rpBetween(r.seed + "a", -3, 5)), "up", `${b.allocated} of ${b.total} people`), rpKpi("On bench", b.bench.length, null, "down", `avg ${Math.round(b.bench.reduce((a, x) => a + x.days, 0) / b.bench.length)} days`),
      rpKpi("Rolling off", b.rolloff.length, null, "down", "next 30 days"), rpKpi("Open demand", b.demand, null, "up", "resource requests")],
    insight: [`<b>${b.bench.length}</b> people on the bench; ${b.bench.filter((x) => x.days > 30).length} for over a month.`, `Open demand (${b.demand}) could absorb the bench — ${esc(b.bench[0].skill)} is the longest-waiting skill.`],
    body: [rpCard("Bench ageing", rpHbars(b.aging, { fmt: (v) => plural(v, "person") })),
      rpList("bench", "On the bench", b.bench.map((x) => ({ lead: rpAv(x.id), t: esc(person(x.id).name), s: `${x.skill} · ${x.days} days on bench`, v: x.days > 30 ? `<span class="rp-bad">${x.days}d</span>` : `${x.days}d`, go: `#/people/${x.id}` })), { empty: "Nobody is on the bench." }),
      rpList("roll", "Rolling off soon", b.rolloff.map((x) => ({ lead: rpAv(x.id), t: esc(person(x.id).name), s: `${esc(x.project)} · ${x.skill}`, v: D.short(x.date), go: `#/people/${x.id}` })), { empty: "No one rolls off in the next 30 days." })],
    cols: ["Person", "Skill", "Days on bench"], rows: b.bench.map((x) => [person(x.id).name, x.skill, x.days]),
  };
}

// ── entry points ──
MS_STYLE.reports = ["chart", "#6366F1", "#3730A3", "#CDCEFB", "#9497F5"];
TILE_MS.reports = "reports";
