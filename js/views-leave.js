// Leave: apply, balances, comp-off (balance + credit request), holidays

route("leave/apply", (_, q) => {
  const F = draft("leave", { from: null, to: null, dayType: "full", quick: null, leaveType: q.type || null, reason: "", notify: [] });
  const bal = leaveBalances();
  const lt = bal.find((b) => b.id === F.leaveType);
  const today = D.today(), tmr = D.add(today, 1);
  const days = F.from ? (F.dayType === "half" ? 0.5 : D.workdays(F.from, F.to)) : 0;
  return `<div class="screen has-foot">${topbar("Apply leave", { left: `<button class="ib" data-act="back" aria-label="Close">${I("x")}</button>` })}
  <div class="scroll"><div class="stack s16" style="padding-top:6px">
    <div class="choices">
      <button class="choice ${F.quick === "today" ? "on" : ""}" data-act="leaveQuick" data-v="today">Today</button>
      <button class="choice ${F.quick === "tomorrow" ? "on" : ""}" data-act="leaveQuick" data-v="tomorrow">Tomorrow</button>
      <button class="choice ${F.quick === "custom" ? "on" : ""}" data-act="leaveDates">Select dates</button>
    </div>
    ${F.from ? rangeField("leaveDates", F.from, F.to, { dayType: F.dayType }) : ""}
    ${F.from && days === 0 ? `<div class="banner warn">${I("info")}These dates fall on weekly offs — no leave will be deducted.</div>` : ""}
    <div class="field"><span class="lbl">Leave type</span><button class="inp sel ${lt ? "" : "ph"}" data-act="leaveType"><span>${lt ? `${esc(lt.name)} · ${lt.available} available` : "Select leave type"}</span>${I("chevD")}</button></div>
    ${lt && days > lt.available ? `<div class="banner bad">${I("alert")}Only ${lt.available} ${lt.name.toLowerCase()} day(s) left — you’re requesting ${days}.</div>` : ""}
    <div class="field"><label for="lv-n">Note to approver</label><textarea id="lv-n" class="inp" data-bind="reason" placeholder="Ex: Need to attend a family function.">${esc(F.reason)}</textarea></div>
    <div class="stack s6"><span class="lbl">Also on leave during this period</span>${alsoAway(F.from, F.to, "leave")}</div>
    ${notifyField(F.notify, "leaveNotify", "An email with leave details will be sent to your teammates.")}
  </div></div>
  <div class="foot"><button class="btn primary block" data-act="leaveSubmit" data-cta>Request leave${days ? ` · ${plural(days, "day")}` : ""}</button></div></div>`;
}, {
  mount() {
    FORM_CHECK = () => {
      const F = DRAFT, b = $("[data-cta]"); if (!F || !b) return;
      const lt = leaveBalances().find((x) => x.id === F.leaveType);
      const days = F.from ? (F.dayType === "half" ? 0.5 : D.workdays(F.from, F.to)) : 0;
      b.disabled = !(F.from && lt && days > 0 && days <= lt.available);
    };
    FORM_CHECK();
  },
});
act("leaveQuick", (b) => { const d = b.dataset.v === "today" ? D.today() : D.add(D.today(), 1); Object.assign(DRAFT, { from: d, to: d, quick: b.dataset.v, dayType: "full" }); rerender(); });
act("leaveDates", () => { const F = DRAFT; pickDates({ title: "Select dates", start: F.from, end: F.to, dayType: F.dayType, half: true, onDone({ start, end, dayType }) { Object.assign(F, { from: start, to: end, dayType, quick: "custom" }); rerender(); } }); });
act("leaveType", () => pickOption({ title: "Leave type", value: DRAFT.leaveType, options: leaveBalances().map((b) => ({ v: b.id, label: b.name, sub: `${b.available} of ${b.total} available` })), onPick(v) { DRAFT.leaveType = v; rerender(); } }));
act("leaveNotify", () => pickPeople({ selected: DRAFT.notify, onDone(ids) { DRAFT.notify = ids; rerender(); } }));
act("leaveSubmit", (b) => {
  if (b.disabled) return;
  const F = DRAFT;
  if (S.requests.some((r) => r.type === "leave" && ["pending", "approved"].includes(r.status) && r.from <= F.to && r.to >= F.from)) return toast("You already have leave on these dates", "bad");
  const r = { id: uid(), type: "leave", leaveType: F.leaveType, from: F.from, to: F.to, dayType: F.dayType, reason: F.reason.trim(), notify: F.notify, attachments: [], comments: [], status: "pending", created: Date.now(), activity: [{ text: "Request raised by you", ts: Date.now(), kind: "on" }] };
  S.requests.push(r); save(); swap(`#/request/${r.id}?new=1`);
});

route("leave/balances", (_, q) => {
  const bal = leaveBalances().filter((b) => b.total > 0);
  const avail = bal.reduce((a, b) => a + b.available, 0), total = bal.reduce((a, b) => a + b.total, 0), used = total - avail;
  const today = D.today(), tab = q.tab || "upcoming";
  const reqs = S.requests.filter((r) => r.type === "leave" && r.status !== "withdrawn");
  const list = (tab === "upcoming" ? reqs.filter((r) => r.to >= today).sort((x, y) => (x.from > y.from ? 1 : -1)) : reqs.filter((r) => r.to < today).sort((x, y) => (x.from < y.from ? 1 : -1)));
  // donut: continuous segments (hairline gaps, like the original) with rounded caps on the two outer ends
  function donutSvg(list, tot) {
    const R = 52, SW = 13, C = 2 * Math.PI * R, GAP = 1.6, items = list.filter((b) => b.available > 0);
    const pt = (len) => { const a = (len / C) * Math.PI * 2; return [62 + R * Math.cos(a), 62 + R * Math.sin(a)]; };
    let off = 0;
    const segs = items.map((b, i) => {
      const L = (b.available / tot) * C, len = Math.max(0.5, L - (i < items.length - 1 ? GAP : 0));
      const seg = `<circle cx="62" cy="62" r="${R}" fill="none" stroke-width="${SW}" stroke-dasharray="${len.toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" style="stroke:var(--c-${b.tint})"/>`;
      off += L; return seg;
    }).join("");
    if (!items.length) return `<svg viewBox="0 0 124 124" aria-hidden="true"><circle cx="62" cy="62" r="${R}" fill="none" stroke-width="${SW}" style="stroke:var(--panel-2)"/></svg>`;
    const [sx, sy] = pt(0), [ex, ey] = pt(off);
    const caps = `<circle cx="${sx.toFixed(2)}" cy="${sy.toFixed(2)}" r="${SW / 2}" style="fill:var(--c-${items[0].tint})"/><circle cx="${ex.toFixed(2)}" cy="${ey.toFixed(2)}" r="${SW / 2}" style="fill:var(--c-${items[items.length - 1].tint})"/>`;
    return `<svg viewBox="0 0 124 124" aria-hidden="true"><circle cx="62" cy="62" r="${R}" fill="none" stroke-width="${SW}" style="stroke:var(--panel-2)"/>${segs}${caps}</svg>`;
  }
  let acc = 0;
  const arcs = bal.map((b) => { const from = (acc / total) * 100; acc += b.available; return `${b.tint} ${from}% ${(acc / total) * 100}%`; });
  const grad = bal.map((b, i) => { const [t, f, to] = arcs[i].split(" "); return `var(--c-${t}) ${f} ${to}`; }).join(", ");
  const yearEnd = new Date().getFullYear() + "-12-31";
  return `<div class="screen">${topbar("Leave balances")}<div class="scroll"><div class="stack s16">
    <div class="card lb-hero">
      <div class="lb-donut modern">${donutSvg(bal, total)}<div><b>${avail}</b><small>days left</small></div></div>
      <div class="grow stack s6" style="min-width:0">
        ${bal.map((b) => `<div class="lb-leg ${b.tint}"><i></i><span class="grow ell">${esc(b.name.replace(" Leave", "").replace(" Holiday", ""))}</span><b>${b.available}</b></div>`).join("")}
      </div>
    </div>
    <div class="hrow small muted" style="justify-content:space-between;margin:-6px 4px 0"><span>${used} of ${total} days used this year</span><span>Resets ${D.short(yearEnd)}</span></div>
    <button class="btn primary block" data-go="#/leave/apply">${I("plus")}Apply leave</button>

    <div class="lb-grid">${bal.map((b) => `<button class="lb-card ${b.tint}" data-go="#/leave/apply?type=${b.id}">
        <span class="ring" style="--p:${(b.available / b.total) * 100};--t:var(--c-${b.tint})"><span class="i">${I(b.id === "compoff" ? "coffee" : b.id === "sick" ? "alert" : b.id === "floater" ? "sparkles" : "calendar")}</span></span>
        <span class="small b ell" style="display:block;margin-top:10px">${esc(b.name)}</span>
        <span class="lb-num"><b>${b.available}</b><small>of ${b.total} left</small></span>
        <span class="tiny muted">${b.used ? `${b.used} used` : "None used yet"}</span>
      </button>`).join("")}</div>

    <div class="sec" style="margin:6px 4px 0"><h2>Requests</h2><button class="link" data-go="#/requests">All requests</button></div>
    ${seg([["upcoming", "Upcoming"], ["past", "Past"]], tab, "lbTab").replace('class="seg-wrap"', 'class="seg-wrap" style="padding:0"')}
    <div class="stack">${list.map((r) => { const lt = LEAVE_TYPES.find((l) => l.id === r.leaveType);
      return `<button class="card hrow" data-go="#/request/${r.id}"><span class="daycell"><small>${D.f(r.from, { month: "short" }).toUpperCase()}</small><b>${D.parse(r.from).getDate()}</b></span><span class="grow" style="min-width:0"><b style="display:block">${esc(lt?.name || "Leave")}</b><span class="small muted">${D.range(r.from, r.to)} · ${r.dayType === "half" ? "½ day" : plural(D.days(r.from, r.to), "day")}</span></span>${statusChip(r.status)}</button>`; }).join("")
      || (tab === "upcoming" ? emptyState(["calendar", "sun", "sparkles"], "No upcoming leave", "Time for a break? Plan your next day off.", `<button class=\"btn primary sm\" data-go=\"#/leave/apply\">${I("plus")}Apply leave</button>`) : emptyMini("history", "No past leave this year."))}</div>
  </div></div></div>`;
});
act("lbTab", (b) => swap(`#/leave/balances?tab=${b.dataset.v}`));

route("compoff", () => {
  const b = leaveBalances().find((x) => x.id === "compoff");
  const reqs = S.requests.filter((r) => r.type === "compoff").sort((a, c) => c.created - a.created);
  return `<div class="screen">${topbar("Compensatory off", { left: `<button class="ib" data-act="back" aria-label="Close">${I("x")}</button>` })}
  <div class="scroll"><div class="stack">
    <div class="sec" style="margin-top:8px"><h2>Comp-off balances</h2></div>
    <div class="card"><div class="sum3" style="grid-template-columns:repeat(3,1fr)"><div><div class="v big" style="justify-content:center">${b.used}</div><div class="small muted">Consumed</div></div><div><div class="v big" style="justify-content:center">${b.total}</div><div class="small muted">Accrued so far</div></div><div><div class="v big" style="justify-content:center;color:var(--accent)">${b.available}</div><div class="small muted">Available</div></div></div></div>
    <div class="row-btns"><button class="btn outline" data-go="#/compoff/request">${I("plus")}Request comp-off</button>${b.available ? `<button class="btn primary" data-go="#/leave/apply?type=compoff">Use comp-off</button>` : ""}</div>
    <div class="sec"><h2>Past requests</h2></div>
    ${reqs.map(reqCard).join("") || emptyMini("coffee", "No comp-off requests yet.")}
  </div></div></div>`;
});

route("compoff/request", () => {
  const F = draft("compoff", { from: null, to: null, reason: "", attachments: [] });
  return `<div class="screen has-foot">${topbar("Request comp-off credit", { left: `<button class="ib" data-act="back" aria-label="Close">${I("x")}</button>` })}
  <div class="scroll"><div class="stack s16" style="padding-top:6px">
    <div class="banner bad" style="font-weight:600;color:var(--ink-body)">${I("info")}Select the dates you worked more than scheduled — comp-offs can be awarded for these.</div>
    ${rangeField("compoffDates", F.from, F.to)}
    <div class="field"><label for="co-n">Note to approver</label><textarea id="co-n" class="inp" data-bind="reason" placeholder="Ex: Supported the weekend production release">${esc(F.reason)}</textarea></div>
    <div class="stack s6">${attachList(F.attachments, "compoffDetach")}<button class="link" style="align-self:flex-start" data-act="compoffAttach">${I("clip")} Add attachments</button><span class="tiny faint">Documents up to 5 MB in PDF, JPEG or PNG.</span></div>
  </div></div>
  <div class="foot"><button class="btn primary block" data-act="compoffSubmit" data-cta>Request comp-off credit</button></div></div>`;
}, { mount() { FORM_CHECK = () => { const b = $("[data-cta]"); if (b) b.disabled = !(DRAFT.from && DRAFT.reason.trim()); }; FORM_CHECK(); } });
act("compoffDates", () => pickDates({ title: "Days you worked extra", start: DRAFT.from, end: DRAFT.to, onDone({ start, end }) { if (end > D.today()) return toast("Pick days you’ve already worked", "bad"); DRAFT.from = start; DRAFT.to = end; rerender(); } }));
act("compoffAttach", () => pickFile(".pdf,.jpg,.jpeg,.png", (f) => { if (f.bytes > 5e6) return toast(`${f.name} is over 5 MB`, "bad"); DRAFT.attachments.push({ name: f.name, size: f.size }); rerender(); }));
act("compoffDetach", (b) => { DRAFT.attachments.splice(Number(b.dataset.i), 1); rerender(); });
act("compoffSubmit", (b) => {
  if (b.disabled) return;
  const F = DRAFT, r = { id: uid(), type: "compoff", from: F.from, to: F.to, dayType: "full", reason: F.reason.trim(), attachments: F.attachments, notify: [], comments: [], status: "pending", created: Date.now(), activity: [{ text: "Request raised by you", ts: Date.now(), kind: "on" }] };
  S.requests.push(r); save(); swap(`#/request/${r.id}?new=1`);
});

route("holidays", (_, q) => {
  const y = Number(q.y) || new Date().getFullYear(), today = D.today();
  const tints = ["t-blue", "t-blue", "t-orange", "t-violet", "t-green", "t-teal", "t-pink", "t-amber", "t-red", "t-orange", "t-violet", "t-red"];
  return `<div class="screen">
    <header class="top"><div class="pill"><button class="ib" data-act="back" aria-label="Back">${I("back")}</button><div class="dateNav"><button class="ib sm acc" data-act="holYear" data-y="${y - 1}" aria-label="Previous year">${I("chevL")}</button><b>Holidays in ${y}</b><button class="ib sm acc" data-act="holYear" data-y="${y + 1}" aria-label="Next year">${I("chevR")}</button></div><span class="spacer"></span></div></header>
    <div class="scroll"><div class="card" style="padding-top:4px;padding-bottom:4px"><div class="list">${holidaysFor(y).map((h) => {
      const t = tints[D.parse(h.date).getMonth()], past = h.date < today;
      return `<div class="li" style="${past ? "opacity:.5" : ""}"><span class="daycell tint ${t}" style="background:color-mix(in srgb,var(--t) 10%,var(--panel))"><small style="color:var(--t)">${D.f(h.date, { month: "short" }).toUpperCase()}</small><b>${String(D.parse(h.date).getDate()).padStart(2, "0")}</b></span><span class="grow"><span class="t" style="display:block">${esc(h.name)}</span><span class="s">${D.dayName(h.date)}${!past && h.date >= today ? ` · in ${plural(D.diff(today, h.date), "day")}` : ""}</span></span>${h.floater ? `<span class="chip vio">Floater</span>` : ""}</div>`;
    }).join("")}</div></div>
    <p class="tiny faint" style="margin:12px 4px">Floater holidays are optional — use them from your Floater Holiday balance.</p></div></div>`;
});
act("holYear", (b) => swap(`#/holidays?y=${b.dataset.y}`));
