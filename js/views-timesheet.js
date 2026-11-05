// Timesheet: day entries, add/copy tasks, time entry, weekly submit/unsubmit, history

const tsList = (d) => S.ts.entries[d] || [];
const weekRec = (w) => S.ts.weeks[w] || { status: "draft", attachments: [] };
const ensureWeek = (w) => (S.ts.weeks[w] ||= { status: "draft", attachments: [] });
const isLocked = (d) => ["pending", "approved"].includes(weekRec(D.monday(d)).status);
const proj = (pid) => PROJECTS.find((p) => p.id === pid);
const taskName = (e) => proj(e.pid)?.tasks[e.ti] || "Task";
const liveMins = (e) => e.mins + (S.ts.running?.id === e.id ? Math.floor((Date.now() - S.ts.running.start) / 60000) : 0);
const sumMins = (list, pred = () => true) => list.filter(pred).reduce((a, e) => a + liveMins(e), 0);
const weekDays = (w) => [0, 1, 2, 3, 4, 5, 6].map((i) => D.add(w, i));
const weekMins = (w) => { const m = weekDays(w).reduce((a, d) => a + sumMins(tsList(d)), 0); return m || weekRec(w).mins || 0; };
const weekTasks = (w) => { const n = weekDays(w).reduce((a, d) => a + tsList(d).length, 0); return n || weekRec(w).tasks || 0; };
const fmtH = (m) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;

function sum3(list) {
  const b = sumMins(list, (e) => e.billable), nb = sumMins(list, (e) => !e.billable);
  return `<div class="card sum3"><div><div class="k">BILLABLE</div><div class="v"><span class="dollar">$</span>${fmtH(b)}</div></div><div><div class="k">NON-BILLABLE</div><div class="v"><span class="dollar nb">$</span>${fmtH(nb)}</div></div><div><div class="k">TOTAL HOURS</div><div class="v big">${fmtH(b + nb)}</div></div></div>`;
}
function weekBanner(w) {
  const r = weekRec(w);
  if (r.status === "pending") return `<div class="banner warn">${I("clock")}<span class="grow">Week submitted · pending approval</span><button class="link" data-go="#/ts/week?w=${w}">View</button></div>`;
  if (r.status === "approved") return `<div class="banner ok">${I("checkCircle")}Week approved — entries are locked</div>`;
  if (r.status === "rejected") return `<div class="banner bad">${I("alert")}<span class="grow">${plural(r.rejected || 1, "task")} rejected — fix and resubmit</span><button class="link danger" data-go="#/ts/week?w=${w}">Week</button></div>`;
  return "";
}

// ── Day view ──
route("ts", (_, q) => {
  const d = q.d || D.today(), w = D.monday(d), list = tsList(d), locked = isLocked(d);
  const isToday = d === D.today();
  const entries = list.map((e) => {
    const running = S.ts.running?.id === e.id;
    return `<div class="entry"><span class="dollar ${e.billable ? "" : "nb"}" style="margin-top:2px">$</span>
      <button class="grow" style="text-align:left" data-act="tsEdit" data-d="${d}" data-id="${e.id}" ${locked ? "disabled" : ""}><b style="display:block;line-height:1.35">${esc(taskName(e))}</b><span class="tiny muted">${esc(proj(e.pid)?.name)}</span>${e.comment ? `<span class="tiny faint" style="display:block">${I("msg")} ${esc(e.comment)}</span>` : `<span class="tiny faint" style="display:block">${I("info")} Add a comment</span>`}</button>
      <div class="stack s6" style="align-items:flex-end"><span class="h" ${running ? `data-live="run"` : ""}>${fmtH(liveMins(e))}</span>
      ${locked ? `<span class="tiny" style="color:var(--warn);font-weight:700">${weekRec(w).status === "approved" ? "Approved" : "Pending"}</span>` : isToday ? `<button class="play ${running ? "on" : ""}" data-act="tsTimer" data-d="${d}" data-id="${e.id}" aria-label="${running ? "Stop timer" : "Start timer"}">${I(running ? "pause" : "play")}</button>` : ""}</div></div>`;
  }).join("");
  return `<div class="screen has-foot">
    <header class="top"><div class="pill"><button class="ib" data-act="back" aria-label="Back">${I("back")}</button>
      <div class="dateNav"><button class="ib sm acc" data-act="tsDay" data-d="${D.add(d, -1)}" aria-label="Previous day">${I("chevL")}</button><div style="text-align:center;min-width:0"><span class="eyebrow" style="display:block;font-size:10px">Timesheet</span><b>${D.nice(d)}</b></div><button class="ib sm acc" data-act="tsDay" data-d="${D.add(d, 1)}" aria-label="Next day">${I("chevR")}</button></div>
      ${locked ? `<button class="ib" data-go="#/ts/history" aria-label="History">${I("history")}</button>` : `<button class="ib acc" data-act="tsAddMenu" data-d="${d}" aria-label="Add or copy tasks">${I("plus")}</button>`}</div></header>
    <div class="scroll"><div class="stack">
      ${sum3(list)}
      ${weekBanner(w)}
      ${list.length ? `<div class="hrow" style="margin:8px 2px 0"><span class="eyebrow grow">${isToday ? "Today’s" : D.f(d, { weekday: "short" }) + "’s"} entries (${list.length})</span>${locked ? "" : `<button class="link danger" data-act="tsClear" data-d="${d}">Clear entries</button>`}</div><div class="card" style="padding-top:2px;padding-bottom:2px">${entries}</div>`
        : emptyState(["clipboard", "plus", "copy"], "Your task list is empty", D.isWeekend(d) ? "It’s a weekly off — add tasks only if you worked today." : "Copy last week’s tasks or add new ones.",
          locked ? "" : `<div class="stack" style="margin-top:18px"><button class="btn primary block" data-act="tsCopy" data-d="${d}">${I("copy")}Copy last week tasks</button><button class="btn outline block" data-act="tsAdd" data-d="${d}">${I("plus")}Add tasks</button></div>`)}
    </div></div>
    <div class="foot"><button class="btn ${weekRec(w).status === "draft" || weekRec(w).status === "rejected" ? "primary" : "ghost"} block" data-go="#/ts/week?w=${w}">${weekRec(w).status === "pending" || weekRec(w).status === "approved" ? "View week" : "Review & submit week"} · ${fmtH(weekMins(w))}</button>
      <button class="link" style="align-self:center" data-go="#/ts/history">${I("history")} Timesheet history</button></div>
  </div>`;
});
act("tsDay", (b) => swap(`#/ts?d=${b.dataset.d}`));
act("tsAddMenu", (b) => {
  const s = openSheet({ title: `<span class="eyebrow">Add / copy tasks</span>`, body: `<div class="list"><button class="li" data-s="add"><span class="ic tint t-blue">${I("plus")}</span><span class="t grow">Add tasks</span></button><button class="li" data-s="copy"><span class="ic tint t-violet">${I("copy")}</span><span class="t grow">Copy tasks from a past week</span></button></div>`,
    onMount(el) { onS(el, { add() { closeSheet(s); ACTIONS.tsAdd(b); }, copy() { closeSheet(s); ACTIONS.tsCopy(b); } }); } });
});
act("tsClear", (b) => confirmSheet({ eyebrow: "Clear entries", text: `Remove all entries for <b>${D.nice(b.dataset.d)}</b>?`, ok: "Clear entries", danger: true, onOk() { if (S.ts.running && S.ts.entries[b.dataset.d]?.some((e) => e.id === S.ts.running.id)) S.ts.running = null; S.ts.entries[b.dataset.d] = []; save(); rerender(); toast("Entries cleared"); } }));
act("tsTimer", (b) => {
  const list = tsList(b.dataset.d), e = list.find((x) => x.id === b.dataset.id), r = S.ts.running;
  if (r) { const prev = Object.values(S.ts.entries).flat().find((x) => x.id === r.id); if (prev) prev.mins += Math.floor((Date.now() - r.start) / 60000); S.ts.running = null; if (r.id === e.id) { save(); rerender(); return toast("Timer stopped"); } }
  S.ts.running = { id: e.id, start: Date.now() }; save(); rerender(); toast(`Timer started · ${taskName(e)}`, "info");
});

// Add tasks sheet
act("tsAdd", (b) => {
  const d = b.dataset.d, w = D.monday(d);
  const sel = new Set(), open = new Set(["p1"]); let q = "", allDays = false;
  const recent = []; const seen = new Set();
  for (let x = d; x >= D.add(d, -21) && recent.length < 4; x = D.add(x, -1)) for (const e of tsList(x)) { const k = `${e.pid}:${e.ti}`; if (!seen.has(k)) { seen.add(k); recent.push(k); } }
  const row = (k) => { const [pid, ti] = k.split(":"); const p = proj(pid); return `<label class="li" style="cursor:pointer"><input type="checkbox" class="check" value="${k}" ${sel.has(k) ? "checked" : ""}><span class="grow"><span class="tiny muted" style="display:block">${esc(p.name)}</span><span class="t">${esc(p.tasks[ti])}</span></span></label>`; };
  const s = openSheet({
    title: `<span class="eyebrow" style="color:var(--accent)">Add tasks</span>`,
    body: `<div class="searchbox">${I("search")}<input data-q placeholder="Search by project or tasks" autofocus></div><div data-list></div>`,
    foot: `<label class="hrow" style="cursor:pointer"><input type="checkbox" class="check" data-all><span class="small b">Add tasks for all working days in this week</span></label><button class="btn primary block" data-s="add" disabled>Add tasks</button>`,
    onMount(el) {
      const draw = () => {
        let html = "";
        if (!q && recent.length) html += `<div class="sec" style="margin:16px 0 4px"><b class="small">Recently added tasks</b></div><div class="list">${recent.map(row).join("")}</div>`;
        html += `<div class="sec" style="margin:16px 0 4px"><b class="small">All projects & tasks</b></div>`;
        for (const p of PROJECTS) {
          const tasks = p.tasks.map((t, i) => [`${p.id}:${i}`, t]).filter(([, t]) => !q || (p.name + " " + t).toLowerCase().includes(q));
          if (!tasks.length) continue;
          const isOpen = q || open.has(p.id);
          html += `<div style="border-bottom:1px solid var(--line)"><button class="acc-head" data-s="tog" data-p="${p.id}"><span class="grow"><b style="display:block">${esc(p.name)}</b><span class="tiny muted">${I("clipboard")} ${plural(p.tasks.length, "task")} · ${I("user")} ${esc(p.owner)}${p.nonbill ? " · Non-billable" : ""}</span></span>${I(isOpen ? "chevU" : "chevD")}</button>${isOpen ? `<div class="list" style="padding-left:6px">${tasks.map(([k]) => row(k)).join("")}</div>` : ""}</div>`;
        }
        el.querySelector("[data-list]").innerHTML = html;
        const btn = el.querySelector("[data-s=add]");
        btn.disabled = !sel.size; btn.textContent = sel.size ? `Add ${plural(sel.size, "task")}` : "Add tasks";
      };
      el.addEventListener("input", (e) => { if (e.target.matches("[data-q]")) { q = e.target.value.toLowerCase(); draw(); } });
      el.addEventListener("change", (e) => {
        if (e.target.matches("[data-all]")) { allDays = e.target.checked; return; }
        if (e.target.matches(".check")) { e.target.checked ? sel.add(e.target.value) : sel.delete(e.target.value); draw(); }
      });
      onS(el, {
        tog(x) { const p = x.dataset.p; open.has(p) ? open.delete(p) : open.add(p); draw(); },
        add() {
          const days = allDays ? weekDays(w).filter((x) => !D.isWeekend(x)) : [d];
          let n = 0;
          for (const day of days) {
            const list = (S.ts.entries[day] ||= []);
            for (const k of sel) { const [pid, ti] = k.split(":"); if (list.some((e) => e.pid === pid && e.ti === Number(ti))) continue; list.push({ id: uid(), pid, ti: Number(ti), mins: 0, billable: !proj(pid).nonbill, comment: "" }); n++; }
          }
          ensureWeek(w); save(); closeSheet(s); rerender(); toast(n ? `${plural(n, "entry")} added — tap one to log time`.replace("entrys", "entries") : "Those tasks are already added", n ? "ok" : "info");
        },
      });
      draw();
    },
  });
});

// Copy past week sheet
act("tsCopy", (b) => {
  const d = b.dataset.d, target = D.monday(d);
  let src = D.add(target, -7);
  const sel = new Set(), open = new Set();
  const s = openSheet({
    title: `<span class="eyebrow" style="color:var(--accent)">Copy past week tasks</span>`,
    body: `<div data-body></div>`,
    foot: `<div class="row-btns"><button class="btn outline" data-s="copy" data-h="0">Copy task only</button><button class="btn primary" data-s="copy" data-h="1">Copy task & hours</button></div>`,
    onMount(el) {
      const tasksOf = (w) => { const m = new Map(); weekDays(w).forEach((day, i) => tsList(day).forEach((e) => { const k = `${e.pid}:${e.ti}`; if (!m.has(k)) m.set(k, { k, e, days: Array(7).fill(0) }); m.get(k).days[i] += e.mins; })); return [...m.values()]; };
      const draw = () => {
        const list = tasksOf(src);
        el.querySelector("[data-body]").innerHTML = `<div class="hrow" style="justify-content:center;margin-bottom:8px"><button class="ib sm" data-s="wk" data-d="-7" aria-label="Previous week">${I("chevL")}</button><b class="small">${D.range(src, D.add(src, 6))}</b><button class="ib sm" data-s="wk" data-d="7" ${D.add(src, 7) >= target ? "disabled style='opacity:.3'" : ""} aria-label="Next week">${I("chevR")}</button></div>
          ${list.length ? `<div class="list">${list.map((t) => `<div style="border-bottom:1px solid var(--line)"><div class="acc-head"><input type="checkbox" class="check" value="${t.k}" ${sel.has(t.k) ? "checked" : ""}><span class="grow"><b style="display:block">${esc(taskName(t.e))}</b><span class="tiny muted">${esc(proj(t.e.pid).name)} · ${fmtH(t.days.reduce((a, x) => a + x, 0))}</span></span><button class="ib sm" data-s="tog" data-k="${t.k}" aria-label="Show days">${I(open.has(t.k) ? "chevU" : "chevD")}</button></div>
            ${open.has(t.k) ? `<div style="padding:0 0 10px 34px">${weekDays(src).map((day, i) => `<div class="hrow small" style="padding:3px 0"><span class="grow muted">${D.nice(day)}</span><b class="num">${fmtH(t.days[i])}</b></div>`).join("")}</div>` : ""}</div>`).join("")}</div>`
            : `<p class="muted small" style="text-align:center;padding:24px 0">No entries in this week.</p>`}`;
      };
      el.addEventListener("change", (e) => { if (e.target.matches(".check")) e.target.checked ? sel.add(e.target.value) : sel.delete(e.target.value); });
      onS(el, {
        wk(x) { if (x.disabled) return; src = D.add(src, Number(x.dataset.d)); sel.clear(); draw(); },
        tog(x) { const k = x.dataset.k; open.has(k) ? open.delete(k) : open.add(k); draw(); },
        copy(x) {
          if (!sel.size) return toast("Select at least one task", "bad");
          const withHours = x.dataset.h === "1"; let n = 0;
          for (const t of tasksOf(src).filter((t) => sel.has(t.k))) {
            weekDays(target).forEach((day, i) => {
              const mins = t.days[i];
              if (withHours ? mins === 0 : D.isWeekend(day)) return;
              const list = (S.ts.entries[day] ||= []);
              const ex = list.find((e) => e.pid === t.e.pid && e.ti === t.e.ti);
              if (ex) { if (withHours && !ex.mins) { ex.mins = mins; n++; } return; }
              list.push({ id: uid(), pid: t.e.pid, ti: t.e.ti, mins: withHours ? mins : 0, billable: t.e.billable, comment: withHours ? t.e.comment : "" }); n++;
            });
          }
          ensureWeek(target); save(); closeSheet(s); rerender(); toast(n ? `Copied into ${plural(n, "day entry")}`.replace("entrys", "entries") : "Nothing new to copy", n ? "ok" : "info");
        },
      });
      draw();
    },
  });
});

// Time entry sheet (wheel pickers)
act("tsEdit", (b) => {
  const d = b.dataset.d, list = tsList(d), e = list.find((x) => x.id === b.dataset.id);
  if (!e) return;
  if (S.ts.running?.id === e.id) { e.mins = liveMins(e); S.ts.running = null; }
  let h = Math.floor(e.mins / 60), m = e.mins % 60, bill = e.billable;
  const wheel = (n, key) => `<div class="wheel" data-w="${key}">${Array.from({ length: n }, (_, i) => `<div>${String(i).padStart(2, "0")}</div>`).join("")}</div>`;
  const s = openSheet({
    title: `<span class="eyebrow">${D.f(d, { weekday: "short", day: "numeric", month: "short" })}</span><span style="display:block;font-size:15px;margin-top:2px">${esc(taskName(e))}</span>`,
    body: `<div class="stack s16"><div><span class="small muted">Enter time</span><div class="timer" data-disp style="margin-top:4px">${fmtH(h * 60 + m)}</div></div>
      <div><div class="wheel-lbl"><span>HOURS</span><span>MINUTES</span></div><div class="wheels">${wheel(17, "h")}${wheel(60, "m")}</div></div>
      <div class="field"><label for="te-c">Comment <span class="opt">(mandatory)</span></label><textarea id="te-c" class="inp" data-c rows="2" style="min-height:70px" placeholder="What did you work on?">${esc(e.comment)}</textarea></div>
      <div class="field"><span class="lbl">Billing type</span><div class="hrow" style="gap:20px"><label class="hrow" style="cursor:pointer"><input type="radio" class="radio" name="bill" value="1" ${bill ? "checked" : ""}><span class="dollar">$</span><b class="small">Billable</b></label><label class="hrow" style="cursor:pointer"><input type="radio" class="radio" name="bill" value="0" ${!bill ? "checked" : ""}><span class="dollar nb">$</span><b class="small">Non-billable</b></label></div></div>
      <div class="banner info small" style="font-weight:600">${I("info")}Billing type selected here applies to this task for the entire week.</div></div>`,
    foot: `<div class="row-btns"><button class="btn danger" data-s="del">${I("trash")}Delete</button><button class="btn primary" data-s="save">Save</button></div>`,
    onMount(el) {
      const disp = el.querySelector("[data-disp]");
      requestAnimationFrame(() => { el.querySelector("[data-w=h]").scrollTop = h * 44; el.querySelector("[data-w=m]").scrollTop = m * 44; });
      el.querySelectorAll(".wheel").forEach((w) => w.addEventListener("scroll", () => {
        const v = Math.round(w.scrollTop / 44); if (w.dataset.w === "h") h = Math.min(16, v); else m = Math.min(59, v);
        disp.textContent = fmtH(h * 60 + m);
      }, { passive: true }));
      el.addEventListener("change", (ev) => { if (ev.target.name === "bill") bill = ev.target.value === "1"; });
      onS(el, {
        save() {
          const c = el.querySelector("[data-c]").value.trim();
          if (!c) { el.querySelector("[data-c]").focus(); return toast("A comment is mandatory", "bad"); }
          const dayTotal = list.filter((x) => x.id !== e.id).reduce((a, x) => a + x.mins, 0) + h * 60 + m;
          if (dayTotal > 24 * 60) return toast("A day can’t exceed 24 hours", "bad");
          e.mins = h * 60 + m; e.comment = c;
          if (bill !== e.billable) weekDays(D.monday(d)).forEach((day) => tsList(day).forEach((x) => { if (x.pid === e.pid && x.ti === e.ti) x.billable = bill; }));
          save(); closeSheet(s); rerender(); toast(`Logged ${fmtH(e.mins)}`);
        },
        del() { S.ts.entries[d] = list.filter((x) => x.id !== e.id); save(); closeSheet(s); rerender(); toast("Entry deleted"); },
      });
    },
  });
});

// ── Week view ──
route("ts/week", (_, q) => {
  const w = q.w || D.monday(D.today()), rec = weekRec(w), editable = rec.status === "draft" || rec.status === "rejected";
  const days = weekDays(w);
  const F = draft("tsw-" + w, { sel: days.filter((d) => sumMins(tsList(d)) > 0) });
  const hol = new Set(holidays().map((h) => h.date));
  const leaveDays = S.requests.filter((r) => r.type === "leave" && r.status === "approved");
  const rows = days.map((d) => {
    const list = tsList(d), mins = sumMins(list);
    const onLeave = leaveDays.some((r) => r.from <= d && r.to >= d);
    const sub = hol.has(d) ? `${I("calendar")} Holiday` : onLeave ? `${I("calendar")} Leave` : list.length ? `${plural(list.length, "task")} ›` : D.isWeekend(d) ? `${I("calendar")} Weekly off` : "No tasks";
    const right = editable
      ? `<b class="num ${mins ? "" : "faint"}">${fmtH(mins)}</b>${mins ? `<input type="checkbox" class="check" data-day="${d}" ${F.sel.includes(d) ? "checked" : ""} aria-label="Include ${D.nice(d)}">` : `<span style="width:22px"></span>`}`
      : `<span class="stack" style="gap:0;align-items:flex-end"><b class="num">${fmtH(mins)}</b><span class="tiny b" style="color:${rec.status === "approved" ? "var(--ok)" : "var(--warn)"}">${rec.status === "approved" ? "Approved" : "Pending"}</span></span>`;
    return `<div class="li"><button class="hrow grow" style="text-align:left" data-go="#/ts?d=${d}"><span class="daycell"><small>${D.f(d, { month: "short" }).toUpperCase()}</small><b>${D.parse(d).getDate()}</b></span><span class="grow"><b style="display:block">${D.dayName(d)}</b><span class="tiny muted">${sub}</span></span></button>${right}</div>`;
  }).join("");
  const all = days.flatMap(tsList);
  let foot;
  if (editable) foot = `<button class="btn primary block" data-act="tsSubmit" data-w="${w}" ${F.sel.length ? "" : "disabled"}>Submit weekly timesheet (${plural(F.sel.length, "day")})</button>`;
  else if (rec.status === "pending") foot = `<div class="banner ok">${I("checkCircle")}Weekly timesheet submitted successfully!</div><button class="btn danger block" data-act="tsUnsubmit" data-w="${w}">Unsubmit timesheet</button>`;
  else foot = `<div class="banner ok">${I("checkCircle")}Approved by ${esc(person(S.me.manager).name)}</div>`;
  return `<div class="screen has-foot">
    <header class="top"><div class="pill"><button class="ib" data-act="back" aria-label="Back">${I("back")}</button>
      <div class="dateNav"><button class="ib sm acc" data-act="tsWeek" data-w="${D.add(w, -7)}" aria-label="Previous week">${I("chevL")}</button><div style="text-align:center;min-width:0"><span class="eyebrow" style="display:block;font-size:10px">Timesheet</span><b>${D.short(w)} – ${D.long(D.add(w, 6))}</b></div><button class="ib sm acc" data-act="tsWeek" data-w="${D.add(w, 7)}" aria-label="Next week">${I("chevR")}</button></div>
      <button class="ib" data-go="#/ts/history" aria-label="History">${I("history")}</button></div></header>
    <div class="scroll"><div class="stack">
      ${sum3(all)}
      ${rec.status === "rejected" ? `<div class="banner bad">${I("alert")}${plural(rec.rejected || 1, "task")} rejected by ${esc(person(S.me.manager).name)} — update and resubmit</div>` : ""}
      <div class="card" style="padding-top:4px;padding-bottom:4px"><div class="list">${rows}</div></div>
      <div class="stack s6"><b class="small">Attachments <span class="faint" style="font-weight:600">(mandatory)</span></b>${attachList(rec.attachments, editable ? "tsDetach" : "")}${editable ? `<button class="link" style="align-self:flex-start" data-act="tsAttach" data-w="${w}">+ Add attachments</button>` : ""}${!rec.attachments.length && !editable ? `<span class="small muted">None</span>` : ""}</div>
      <button class="link" style="align-self:flex-start;color:var(--violet)" data-act="tsTimeline" data-w="${w}">${I("clock")} View activity timeline</button>
    </div></div>
    <div class="foot">${foot}</div></div>`;
}, { mount() { FORM_CHECK = null; } });
act("tsWeek", (b) => swap(`#/ts/week?w=${b.dataset.w}`));
document.addEventListener("change", (e) => {
  if (!e.target.matches("[data-day]") || !DRAFT?.sel) return;
  const d = e.target.dataset.day; DRAFT.sel = e.target.checked ? [...new Set([...DRAFT.sel, d])] : DRAFT.sel.filter((x) => x !== d); rerender();
});
act("tsAttach", (b) => { const r = ensureWeek(b.dataset.w); pickFile(".pdf,.jpg,.jpeg,.png,.doc,.docx", (f) => { r.attachments.push({ name: f.name, size: f.size }); save(); rerender(); }); });
act("tsDetach", (b) => { const w = new URLSearchParams(location.hash.split("?")[1]).get("w") || D.monday(D.today()); ensureWeek(w).attachments.splice(Number(b.dataset.i), 1); save(); rerender(); });
act("tsSubmit", (b) => {
  const w = b.dataset.w, r = ensureWeek(w);
  if (!r.attachments.length) return toast("Add at least one attachment to submit", "bad");
  const missing = DRAFT.sel.flatMap(tsList).filter((e) => !e.comment);
  if (missing.length) return toast(`${plural(missing.length, "entry")} need a comment`.replace("entrys", "entries"), "bad");
  if (S.ts.running) { const e = Object.values(S.ts.entries).flat().find((x) => x.id === S.ts.running.id); if (e) e.mins = liveMins(e); S.ts.running = null; }
  r.status = "pending"; r.submittedAt = Date.now(); r.days = [...DRAFT.sel]; r.rejected = 0;
  (r.log ||= []).push({ text: "Submitted for approval", ts: Date.now(), kind: "on" });
  save(); rerender(); toast("Weekly timesheet submitted");
});
act("tsUnsubmit", (b) => confirmSheet({ eyebrow: "Unsubmit", text: "Are you sure you want to unsubmit this timesheet?", ok: "Yes, unsubmit", danger: true, onOk() {
  const r = ensureWeek(b.dataset.w); r.status = "draft"; (r.log ||= []).push({ text: "Unsubmitted by you", ts: Date.now(), kind: "bad" }); save(); DRAFT = null; rerender(); toast("Timesheet unsubmitted successfully!");
} }));
act("tsTimeline", (b) => {
  const r = weekRec(b.dataset.w);
  const log = [...(r.log || [])];
  if (!log.length && r.submittedAt) log.push({ text: "Submitted for approval", ts: r.submittedAt, kind: "on" });
  if (r.status === "approved") log.push({ text: `Approved by ${person(S.me.manager).name}`, ts: (r.submittedAt || Date.now()) + 864e5, kind: "ok" });
  if (r.status === "rejected") log.push({ text: `${plural(r.rejected || 1, "task")} rejected by ${person(S.me.manager).name}`, ts: Date.now() - 9 * 36e5, kind: "bad" });
  openSheet({ title: "Activity timeline", body: log.length ? `<div class="timeline">${log.reverse().map((a) => `<div class="tl ${a.kind}"><b class="small" style="display:block">${esc(a.text)}</b><span class="tiny muted">${new Date(a.ts).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span></div>`).join("")}</div>` : `<p class="muted">No activity yet — this week hasn’t been submitted.</p>` });
});

// ── History ──
route("ts/history", (_, q) => {
  const y = Number(q.y) || new Date().getFullYear(), f = q.f || "all";
  const cur = D.monday(D.today());
  const keys = Object.keys(S.ts.weeks).sort();
  const earliest = keys[0] || cur;
  const weeks = [];
  for (let w = cur; w >= earliest; w = D.add(w, -7)) if (D.parse(w).getFullYear() === y || D.parse(D.add(w, 6)).getFullYear() === y) weeks.push(w);
  const chip = (r) => ({ pending: `<span class="chip warn">Pending</span>`, approved: `<span class="chip ok">Approved</span>`, rejected: `<span class="chip bad">${plural(r.rejected || 1, "task")} rejected</span>` }[r.status] || `<span class="chip">Not submitted</span>`);
  const list = weeks.filter((w) => f === "all" || weekRec(w).status === f);
  return `<div class="screen">
    <header class="top"><div class="pill"><button class="ib" data-act="back" aria-label="Back">${I("back")}</button><div class="dateNav"><button class="ib sm acc" data-act="tsYear" data-y="${y - 1}" aria-label="Previous year">${I("chevL")}</button><div style="text-align:center"><span class="eyebrow" style="display:block;font-size:10px">Timesheet</span><b>${y}</b></div><button class="ib sm acc" data-act="tsYear" data-y="${y + 1}" aria-label="Next year">${I("chevR")}</button></div><span class="spacer"></span></div></header>
    ${seg([["all", "All"], ["pending", "Pending"], ["rejected", "Rejected"], ["approved", "Approved"]], f, "tsHistF")}
    <div class="scroll"><div class="card" style="padding-top:4px;padding-bottom:4px"><div class="list">${list.map((w) => `<button class="li" data-go="#/ts/week?w=${w}"><span class="grow"><b style="display:block">${D.range(w, D.add(w, 6))}</b><span class="small muted">${fmtH(weekMins(w))} • ${plural(weekTasks(w), "task")}</span></span>${chip(weekRec(w))}</button>`).join("") || `<p class="muted small" style="padding:20px 0;text-align:center">No timesheets here.</p>`}</div></div></div></div>`;
});
act("tsYear", (b) => swap(`#/ts/history?y=${b.dataset.y}`));
act("tsHistF", (b) => { const y = new URLSearchParams(location.hash.split("?")[1]).get("y"); swap(`#/ts/history?f=${b.dataset.v}${y ? `&y=${y}` : ""}`); });
