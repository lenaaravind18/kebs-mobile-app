// Home widgets: Kais "Needs your attention", Leave balance, Payday, This week's hours, Celebrations.
// Built from the app's own cards, rings, tinted list icons and tile icons; every widget opens its full screen.

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ── 1. Needs your attention: smart to-dos from Kais ──
function attentionItems() {
  const out = [], today = D.today(), w = D.monday(today);
  // weekdays this week (before today) with no hours logged
  const missing = weekDays(w).slice(0, 5).filter((d) => d < today && sumMins(tsList(d)) === 0);
  if (missing.length) out.push({ ic: "clipboard", tint: "t-teal", t: missing.length === 1 ? `${DAY_NAMES[D.parse(missing[0]).getDay()]} has no hours logged` : `${missing.length} days this week have no hours`, s: "Log time before you submit the week", go: `#/ts?d=${missing[0]}` });
  // approvals waiting on you
  if (S.inbox?.length) out.push({ ic: "inbox", tint: "t-blue", t: `${plural(S.inbox.length, "request")} waiting on you`, s: "Kais lined up the routine ones for bulk approve", go: "#/inbox" });
  // tax proofs due
  const due = typeof DECL !== "undefined" ? DECL.filter((d) => S.tax?.decl?.[d.id]?.proof === "pending") : [];
  if (due.length) out.push({ ic: "percent", tint: "t-violet", t: `${due.map((d) => d.name.replace("Section ", "")).join(", ")} proof due 15 Jan`, s: "Upload it so your TDS stays right", go: "#/tax" });
  // pending requests of your own
  const mine = pendingRequests();
  if (mine.length && out.length < 3) out.push({ ic: "clock", tint: "t-amber", t: `${plural(mine.length, "request")} awaiting approval`, s: "Track where each one is", go: "#/requests" });
  return out.slice(0, 3);
}
function attentionWidget() {
  const items = attentionItems();
  if (!items.length) return "";
  return `<div class="sec"><h2 class="w-h-kais"><img src="kais.svg" alt="">Needs your attention</h2></div>
    <div class="card list w-attn">${items.map((x) => `<button class="li" data-go="${x.go}"><span class="ic tint ${x.tint}">${I(x.ic)}</span><span class="grow"><b style="display:block">${esc(x.t)}</b><span class="tiny muted">${esc(x.s)}</span></span>${I("chevR")}</button>`).join("")}</div>`;
}

// ── 2. Leave balance ──
function leaveWidget() {
  const bal = leaveBalances().filter((b) => b.total), avail = bal.reduce((a, b) => a + b.available, 0), total = bal.reduce((a, b) => a + b.total, 0);
  const top = bal.filter((b) => ["casual", "sick", "earned"].includes(b.id));
  return `<button class="card w-tile" data-go="#/leave/balances">
    <span class="w-head"><span class="tico ms">${msIcon("balances")}</span><span class="w-title">Leave</span></span>
    <span class="hrow" style="gap:12px;margin-top:10px">${progressRing(total ? avail / total : 0, { size: 50, stroke: 6, color: "var(--ok)", label: avail })}<span class="w-big"><b>${avail} days</b><small>left this year</small></span></span>
    <span class="w-sub">${top.map((b) => `${b.name.split(" ")[0]} ${b.available}`).join(" · ")}</span>
  </button>`;
}

// ── 3. Payday ──
function nextPayday() {
  const t = D.parse(D.today()), last = (y, m) => { const d = new Date(y, m + 1, 0); while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1); return d; };
  let p = last(t.getFullYear(), t.getMonth()); if (p < t) p = last(t.getFullYear(), t.getMonth() + 1);
  return D.iso(p);
}
function paydayWidget() {
  if (typeof slipMonths !== "function") return "";
  const months = slipMonths(), lastSlip = months.length ? slip(months[months.length - 1]) : null, pd = nextPayday(), days = D.diff(D.today(), pd);
  return `<button class="card w-tile" data-go="#/pay">
    <span class="w-head"><span class="tico ms">${msIcon("payslip")}</span><span class="w-title">Payday</span></span>
    <span class="w-big" style="margin-top:12px"><b>${days === 0 ? "Today" : plural(days, "day")}</b><small>${days === 0 ? "Salary lands today" : `to go · ${fmtD(pd, { day: "numeric", month: "short" })}`}</small></span>
    ${lastSlip ? `<span class="w-sub">Last take-home<b class="w-amt">${m$(lastSlip.net)}</b></span>` : ""}
  </button>`;
}

// ── 4. This week's hours ──
function hoursWidget() {
  const today = D.today(), w = D.monday(today), days = weekDays(w).slice(0, 5);
  const mins = days.map((d) => sumMins(tsList(d))), total = mins.reduce((a, m) => a + m, 0), goal = 40 * 60;
  const ti = days.indexOf(today), friday = D.parse(today).getDay() >= 5;
  return `<div class="sec"><h2>This week’s hours</h2><button class="link" data-go="#/ts/week">Timesheet</button></div>
    <div class="card w-hours">
      <div class="hrow"><span class="grow"><b class="w-total">${fmtMin(total)}</b><small class="tiny muted"> of 40h</small></span><span class="chip ${total >= goal ? "ok" : friday ? "warn" : ""}">${total >= goal ? "Goal met" : friday ? "Submit today" : `${Math.round((total / goal) * 100)}%`}</span></div>
      ${capsuleBars({ values: mins.map((m) => m / 60), labels: ["Mon", "Tue", "Wed", "Thu", "Fri"], max: 10, goal: 8, goalLabel: "8h", active: ti < 0 ? 4 : ti, fmt: (h) => fmtMin(h * 60), future: days.map((d, i) => (d > today ? i : -1)).filter((i) => i >= 0), height: 120 })}
    </div>`;
}

// ── 5. Celebrations: birthdays and work anniversaries (demo dates around today) ──
function celebrations() {
  const p = S.people || [], t = D.today();
  const pick = (i) => p[i % Math.max(1, p.length)];
  return [
    pick(2) && { id: pick(2).id, kind: "birthday", age: 29, date: t },
    pick(5) && { id: pick(5).id, kind: "work", years: 3, date: D.add(t, 1) },
    pick(7) && { id: pick(7).id, kind: "birthday", age: 26, date: D.add(t, 3) },
    pick(3) && { id: pick(3).id, kind: "work", years: 5, date: D.add(t, 5) },
  ].filter(Boolean);
}
const wishKey = (c) => `${c.id}:${c.kind}:${c.date}`;

// greeting suggestions per occasion: [chip label, the message it puts in the note]
function greetings(c, first) {
  return c.kind === "birthday"
    ? [["Happy Birthday!! 🎂", `Happy Birthday @${first}!! 🎂`],
       ["B’day wishes, party hard! 🎉", `B’day wishes @${first}, party hard! 🎉`],
       ["Wishing you a fantastic day filled with joy & success.", `Wishing you a fantastic day filled with joy & success, @${first}. 🎈`]]
    : [["Happy work anniversary!! 🎉", `Happy work anniversary @${first}!! 🎉`],
       [`Congrats on ${c.years} amazing years! 🥂`, `Congrats on ${c.years} amazing years at KEBS, @${first}! 🥂`],
       ["Thank you for all you bring to the team.", `Thank you for all you bring to the team, @${first}. Here’s to many more years! 🙌`]];
}
act("celebWish", (b) => {
  const c = celebrations()[Number(b.dataset.i)]; if (!c) return;
  const p = person(c.id), first = p.name.split(" ")[0], opts = greetings(c, first);
  const n = D.diff(D.today(), c.date), whenTxt = `${fmtD(c.date, { day: "numeric", month: "short" })}${n === 0 ? " (Today)" : n === 1 ? " (Tomorrow)" : ""}`;
  const meta = c.kind === "birthday" ? `${c.age} Years` : `${plural(c.years, "Year")} at KEBS`;
  let pick = 0;
  const s = openSheet({
    title: c.kind === "birthday" ? "Birthday wishes" : "Work anniversary",
    body: `<div class="wish-head">${avatar(c.id, "lg")}<span class="grow"><b>${esc(p.name)}</b><span class="wish-meta">${I("calendar")}${whenTxt}<i></i>${meta}</span></span></div>
      <label class="wish-lbl" for="wish-t">Add a personal note or greeting</label>
      <textarea id="wish-t" class="inp wish-t" data-t rows="4">${esc(opts[0][1])}</textarea>
      <div class="wish-chips" data-chips>${opts.map(([l], i) => `<button class="wish-chip ${i === 0 ? "on" : ""}" data-s="pick" data-i="${i}">${esc(l)}</button>`).join("")}</div>`,
    foot: `<button class="btn primary block" data-s="send">Send</button>`,
    onMount(el) {
      const t = el.querySelector("[data-t]");
      onS(el, {
        pick(x) { pick = Number(x.dataset.i); t.value = opts[pick][1]; el.querySelectorAll(".wish-chip").forEach((ch, i) => ch.classList.toggle("on", i === pick)); },
        send() {
          const msg = t.value.trim(); if (msg.length < 2) { t.focus(); return toast("Write a short note", "bad"); }
          (S.wishes ||= {})[wishKey(c)] = msg; save(); closeSheet(s); rerender();
          actionToast(c.kind === "birthday" ? `Birthday wishes sent to ${first} 🎂` : `Congratulations sent to ${first} 🎉`, "View", () => go(`#/people/${c.id}?tab=wishes`));
        },
      });
      // typing your own note clears the selected suggestion
      t.addEventListener("input", () => { if (!opts.some(([, m]) => m === t.value)) el.querySelectorAll(".wish-chip").forEach((ch) => ch.classList.remove("on")); });
    },
  });
});
function celebWidget() {
  const list = celebrations(); if (!list.length) return "";
  const when = (d) => { const n = D.diff(D.today(), d); return n === 0 ? "Today" : n === 1 ? "Tomorrow" : fmtD ? fmtD(d, { weekday: "short", day: "numeric", month: "short" }) : D.short(d); };
  return `<div class="sec"><h2>Celebrations</h2><span class="tiny muted">This week</span></div>
    <div class="hscroll w-celebs">${list.map((c, idx) => { const pp = person(c.id), today = c.date === D.today(), done = S.wishes?.[wishKey(c)]; return `<div class="card w-celeb ${today ? "today" : ""}">
      <span class="w-celeb-av">${avatar(c.id, "lg")}<span class="w-celeb-badge ${c.kind}">${I(c.kind === "birthday" ? "cake" : "award")}</span></span>
      <b class="ell">${esc(pp.name.split(" ")[0])}</b>
      <small>${c.kind === "birthday" ? "Birthday" : `${c.years} years at KEBS`}</small>
      <span class="w-when">${when(c.date)}</span>
      ${done ? `<span class="w-done">${I("checkCircle")}${c.kind === "birthday" ? "Wished" : "Sent"}</span>` : `<button class="btn ${today ? "primary" : "ghost"} sm" data-act="celebWish" data-i="${idx}">${c.kind === "birthday" ? "Wish" : "Congratulate"}</button>`}
    </div>`; }).join("")}</div>`;
}

// what Home renders between the Today card and the rest
function homeWidgets() {
  return `${attentionWidget()}
    <div class="sec"><h2>At a glance</h2></div>
    <div class="grid2 w-grid">${leaveWidget()}${paydayWidget()}</div>
    ${hoursWidget()}`;
}
