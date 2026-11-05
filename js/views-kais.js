// Kais — full-screen assistant (chat-app style): suggested prompts, streamed answers, rich action cards,
// follow-ups, copy / regenerate / feedback, chat history, attachments, voice input.

S.kais ||= { chats: [], active: null };
const KAIS = { streaming: null, attach: [], agent: null };

const kaisChat = () => (S.kais ||= { chats: [], active: null }).chats.find((c) => c.id === S.kais.active);
function kaisNewChat(agent = null) { S.kais.active = null; KAIS.attach = []; KAIS.agent = agent; }

// ── tiny markdown: **bold**, `code`, "- " lists, line breaks ──
function md(src) {
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`(.+?)`/g, "<code>$1</code>");
  const out = []; let list = null;
  for (const line of src.split("\n")) {
    const m = line.match(/^\s*[-•]\s+(.*)/);
    if (m) { (list ||= []).push(`<li>${inline(m[1])}</li>`); continue; }
    if (list) { out.push(`<ul>${list.join("")}</ul>`); list = null; }
    out.push(line.trim() ? `<p>${inline(line)}</p>` : "");
  }
  if (list) out.push(`<ul>${list.join("")}</ul>`);
  return out.join("");
}

// ── natural-language helpers ──
function parseDay(t) {
  const today = D.today();
  if (/\btoday\b/.test(t)) return today;
  if (/day after tomorrow/.test(t)) return D.add(today, 2);
  if (/\btomorrow\b/.test(t)) return D.add(today, 1);
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const i = days.findIndex((d) => t.includes(d));
  if (i >= 0) { let d = D.add(today, 1); while (D.wd(d) !== i) d = D.add(d, 1); return d; }
  return null;
}
function parseHours(t) {
  const h = t.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)\b/), m = t.match(/(\d+)\s*(m|min|mins|minutes)\b/);
  const total = (h ? parseFloat(h[1]) * 60 : 0) + (m ? parseInt(m[1]) : 0);
  return total ? Math.round(total) : null;
}
function findTask(t) {
  let best = null, score = 0;
  PROJECTS.forEach((p) => p.tasks.forEach((task, ti) => {
    const words = (p.name + " " + task).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
    const s = words.filter((w) => t.includes(w)).length;
    if (s > score) { score = s; best = { pid: p.id, ti }; }
  }));
  return best;
}

// ── answer engine: returns { text, card?, follow[] } ──
function kaisAnswer(q) {
  const t = q.toLowerCase().trim();
  const bal = leaveBalances();
  const w = D.monday(D.today());

  if (/clock ?out|punch ?out/.test(t)) {
    if (!clockedIn()) return { text: "You aren’t clocked in right now, so there’s nothing to clock out of.", follow: ["Show my time logs", "Clock me in"] };
    return { text: `You’ve been on the clock for **${fmtMin(workedSec() / 60)}** today. Want me to clock you out?`, card: { type: "clockout" }, follow: ["How many hours did I log this week?"] };
  }
  if (/clock|punch|check ?in|start (my )?(day|shift)/.test(t)) {
    if (clockedIn()) return { text: `You’re already clocked in — since **${D.time(S.att.today.inTs)}**.`, follow: ["Clock me out", "Show my time logs"] };
    return { text: `Your **${SHIFT.name}** shift runs ${D.hm(SHIFT.start)} – ${D.hm(SHIFT.end)}. I’ll record your clock-in at **${OFFICE.name}**.`, card: { type: "clockin" }, follow: ["Apply WFH for tomorrow"] };
  }
  if (/(apply|book|take|need).*(leave|day off|off)|leave (for|on) /.test(t)) {
    const day = parseDay(t) || D.add(D.today(), 1);
    const type = /sick|unwell|fever|doctor/.test(t) ? "sick" : /earned|vacation|trip/.test(t) ? "earned" : "casual";
    const b = bal.find((x) => x.id === type);
    return { text: `Here’s a **${b.name}** request for **${D.nice(day)}**. You have **${b.available}** ${b.name.toLowerCase()} day(s) left. Review it and submit when ready.`, card: { type: "leave", day, leaveType: type }, follow: ["What’s my leave balance?", "Who else is off this week?"] };
  }
  if (/wfh|work from home|remote/.test(t)) {
    const day = parseDay(t) || D.add(D.today(), 1);
    return { text: `I’ve drafted a **work-from-home** request for **${D.nice(day)}**. Add a reason and send it to ${person(S.me.manager).name}.`, card: { type: "wfh", day }, follow: ["Any pending approvals?"] };
  }
  if (/balance|how many (leaves|days)|leaves? (do i|left)/.test(t)) {
    return { text: "Here’s your leave balance right now:", card: { type: "balances" }, follow: ["Apply leave tomorrow", "When is the next holiday?"] };
  }
  if (/log|add|track/.test(t) && parseHours(t)) {
    const mins = parseHours(t), task = findTask(t), day = parseDay(t) || D.today();
    if (!task) return { text: `Which task should I log **${fmtH(mins)}** against? Try something like “log 2h on design system development”.`, follow: ["Log 2h on design system development", "Log 1h 30m on home screen API integration"] };
    return { text: `Ready to log **${fmtH(mins)}** on **${proj(task.pid).tasks[task.ti]}** for ${D.nice(day)}.`, card: { type: "log", ...task, mins, day }, follow: ["How many hours did I log this week?"] };
  }
  if (/hour|timesheet|logged|worked/.test(t)) {
    const days = weekDays(w).map((d) => ({ d, m: sumMins(tsList(d)) }));
    return { text: `You’ve logged **${fmtH(weekMins(w))}** this week — status: **${weekRec(w).status === "draft" ? "not submitted" : weekRec(w).status}**.`, card: { type: "week", days }, follow: ["Log 2h on design system development", "Submit my timesheet"] };
  }
  if (/submit.*timesheet/.test(t)) return { text: "Your week is ready for review. Check each day, add the mandatory attachment and submit.", card: { type: "link", label: "Review & submit week", go: `#/ts/week?w=${w}`, icon: "clipboard" }, follow: [] };
  if (/holiday/.test(t)) {
    const list = holidays().filter((h) => h.date >= D.today()).slice(0, 4);
    return list.length ? { text: `Next up is **${list[0].name}** on ${D.nice(list[0].date)} — ${plural(D.diff(D.today(), list[0].date), "day")} away.`, card: { type: "holidays", list }, follow: ["Apply leave the day after", "What’s my leave balance?"] } : { text: "No more public holidays this year." };
  }
  if (/approv|inbox|pending|waiting/.test(t)) {
    const routine = S.inbox.filter((x) => x.routine);
    return { text: `You have **${S.inbox.length}** approvals waiting. ${routine.length ? `**${routine.length}** are routine and match your usual patterns — I can approve them in one go.` : ""}\n\nYour own pending requests: **${pendingRequests().length}**.`, card: { type: "approvals", ids: routine.map((x) => x.id) }, follow: ["Show my pending requests", "Open inbox"] };
  }
  if (/my (pending )?requests|request status/.test(t)) return { text: `You have **${pendingRequests().length}** pending request(s).`, card: { type: "link", label: "Open request history", go: "#/requests?f=pending", icon: "list" }, follow: [] };
  if (/off this week|who.*(off|leave)/.test(t)) {
    const off = S.offThisWeek.list;
    return { text: off.length ? `${off.length} teammates are off this week:\n${off.map((o) => `- **${person(o.id).name}** — ${D.nice(o.date)}`).join("\n")}` : "Everyone’s in this week.", follow: ["Apply leave tomorrow"] };
  }
  if (/expense|bill|claim|reimburse/.test(t)) {
    const p = S.expenses.filter((e) => e.status === "pending");
    return { text: `**${p.length}** claim(s) are awaiting reimbursement, worth **${money(p.reduce((a, e) => a + e.amount, 0))}**.`, card: { type: "link", label: "Scan a new bill", go: "#/expenses/new?scan=1", icon: "scan" }, follow: ["Show my expense insights"] };
  }
  if (/insight/.test(t)) return { text: "Here’s where your spend goes.", card: { type: "link", label: "Open expense insights", go: "#/expenses?tab=insights", icon: "chart" }, follow: [] };
  if (/praise|kudos|thank/.test(t)) return { text: "Recognition goes a long way. Pick a teammate and a badge.", card: { type: "link", label: "Give a praise", act: "praisePick", icon: "award" }, follow: [] };
  if (/^(hi|hey|hello|yo)\b/.test(t)) return { text: `Hey ${S.me.display}! I can clock you in, apply leave, log time, check balances and clear approvals. What do you need?`, follow: ["What’s my leave balance?", "Clock me in", "Any pending approvals?"] };
  if (/time ?logs?|attendance/.test(t)) return { text: "Here are your recent attendance logs.", card: { type: "link", label: "Open time logs", go: "#/logs", icon: "history" }, follow: ["Clock me in"] };
  if (/open inbox/.test(t)) return { text: "Opening your inbox.", card: { type: "link", label: "Go to inbox", go: "#/inbox", icon: "inbox" }, follow: [] };
  return {
    text: `I’m not sure about “${q}” yet. Here’s what I can do:\n- **Attendance** — clock in/out, time logs\n- **Leave** — balances, apply leave, holidays\n- **Timesheet** — log hours, weekly summary\n- **Approvals** — inbox and bulk approve\n- **Expenses** — claims and bills`,
    follow: ["What’s my leave balance?", "Log 2h on design system development", "Any pending approvals?"],
  };
}

// ── rich cards ──
function kaisCard(c, mi) {
  if (!c) return "";
  const btn = (label, k, cls = "primary") => (c.done ? "" : `<button class="btn ${cls} sm" data-act="kaisDo" data-k="${k}" data-mi="${mi}">${label}</button>`);
  const done = c.done ? `<div class="banner ok" style="margin-top:10px">${I("checkCircle")}${esc(c.done)}</div>` : "";
  switch (c.type) {
    case "clockin": return `<div class="kc"><div class="hrow"><span class="kc-ic tint t-green">${I("fingerprint")}</span><span class="grow"><b>Clock in now</b><span class="small muted" style="display:block">${OFFICE.name}</span></span>${btn("Clock in", "clockin")}</div>${done}</div>`;
    case "clockout": return `<div class="kc"><div class="hrow"><span class="kc-ic tint t-red">${I("clock")}</span><span class="grow"><b>${fmtMin(workedSec() / 60)} worked</b><span class="small muted" style="display:block">since ${D.time(S.att.today.inTs || Date.now())}</span></span>${btn("Clock out", "clockout", "danger fill")}</div>${done}</div>`;
    case "leave": { const lt = LEAVE_TYPES.find((l) => l.id === c.leaveType); return `<div class="kc"><span class="eyebrow">Leave request · draft</span><div class="kv"><span>Type</span><span>${lt.name}</span></div><div class="kv"><span>Date</span><span>${D.nice(c.day)}</span></div><div class="kv"><span>Approver</span><span>${esc(person(S.me.manager).name)}</span></div><div class="hrow" style="margin-top:10px">${btn("Submit request", "leave")}${c.done ? "" : `<button class="btn ghost sm" data-go="#/leave/apply?type=${c.leaveType}">Edit details</button>`}</div>${done}</div>`; }
    case "wfh": return `<div class="kc"><span class="eyebrow">WFH request · draft</span><div class="kv"><span>Date</span><span>${D.nice(c.day)}</span></div>${c.done ? "" : `<input class="inp" data-kreason="${mi}" placeholder="Reason (required)" style="margin-top:8px;min-height:42px">`}<div class="hrow" style="margin-top:10px">${btn("Send request", "wfh")}</div>${done}</div>`;
    case "balances": {
      const list = leaveBalances().filter((b) => b.total);
      const avail = list.reduce((a, b) => a + b.available, 0), total = list.reduce((a, b) => a + b.total, 0);
      return `<div class="kc"><div class="hrow" style="gap:14px;margin-bottom:12px"><span class="ring lg" style="--p:${(avail / total) * 100};--t:var(--accent)"><b>${avail}</b><small>of ${total}</small></span><span class="grow"><b style="display:block">${avail} days available</b><span class="small muted">${total - avail} used across ${list.length} leave types</span></span></div>
        <div class="kb-grid">${list.map((b) => `<div class="kb ${b.tint}"><span class="ring" style="--p:${(b.available / b.total) * 100}"><b>${b.available}</b></span><span class="grow" style="min-width:0"><span class="small b ell" style="display:block">${esc(b.name)}</span><span class="tiny muted">${b.available} of ${b.total} left</span></span></div>`).join("")}</div>
        <button class="btn ghost sm" style="margin-top:12px" data-go="#/leave/balances">View history</button></div>`;
    }
    case "log": return `<div class="kc"><div class="hrow"><span class="kc-ic tint t-teal">${I("clipboard")}</span><span class="grow"><b>${esc(proj(c.pid).tasks[c.ti])}</b><span class="small muted" style="display:block">${esc(proj(c.pid).name)} · ${D.short(c.day)}</span></span><b class="timer" style="font-size:18px">${fmtH(c.mins)}</b></div><div class="hrow" style="margin-top:10px">${btn("Log time", "log")}</div>${done}</div>`;
    case "week": {
      const max = Math.max(9 * 60, ...c.days.map((d) => d.m)), tot = c.days.reduce((a, d) => a + d.m, 0), target = 45 * 60;
      return `<div class="kc"><div class="hrow" style="margin-bottom:6px"><span class="grow"><span class="eyebrow">This week</span><b class="timer" style="display:block;font-size:24px;margin-top:2px">${fmtH(tot)}</b></span><span class="chip ${tot >= target ? "ok" : "acc"}">${Math.round((tot / target) * 100)}% of 45h</span></div>
        <div class="kchart"><span class="kgoal" style="bottom:${(8 * 60 / max) * 100}%"><em>8h</em></span>${c.days.map((d) => `<div class="col ${d.d === D.today() ? "today" : ""}"><span class="tiny b num">${d.m ? `${Math.floor(d.m / 60)}h${d.m % 60 ? ` ${d.m % 60}m` : ""}` : ""}</span><i style="height:${Math.max(2, (d.m / max) * 100)}%;${d.m ? "" : "opacity:.25"}"></i><small>${D.f(d.d, { weekday: "narrow" })}</small></div>`).join("")}</div>
        <button class="btn ghost sm" style="margin-top:12px" data-go="#/ts">Open timesheet</button></div>`;
    }
    case "holidays": return `<div class="kc"><div class="list">${c.list.map((h) => `<div class="li"><span class="daycell"><small>${D.f(h.date, { month: "short" }).toUpperCase()}</small><b>${D.parse(h.date).getDate()}</b></span><span class="grow"><span class="t" style="display:block">${esc(h.name)}</span><span class="s">${D.dayName(h.date)}</span></span>${h.floater ? `<span class="chip vio">Floater</span>` : ""}</div>`).join("")}</div></div>`;
    case "approvals": return `<div class="kc"><div class="hrow"><span class="kc-ic tint t-blue">${I("inbox")}</span><span class="grow"><b>${S.inbox.length} waiting</b><span class="small muted" style="display:block">${c.ids.length} routine</span></span></div><div class="hrow" style="margin-top:10px">${c.ids.length ? btn(`Approve ${c.ids.length} routine`, "approve") : ""}<button class="btn ghost sm" data-go="#/inbox">Open inbox</button></div>${done}</div>`;
    case "donut": {
      let acc = 0; const tot = c.items.reduce((a, x) => a + x.v, 0) || 1;
      const grad = c.items.map((x) => { const f = (acc / tot) * 100; acc += x.v; return `${x.c} ${f}% ${(acc / tot) * 100}%`; }).join(", ");
      return `<div class="kc"><span class="eyebrow">${esc(c.title)}</span><div class="kd-wrap"><div class="kd" style="background:conic-gradient(${grad})"><div><small>Total</small><b>${esc(c.total)}</b></div></div>
        <div class="kd-leg">${c.items.map((x) => `<div><i style="background:${x.c}"></i><span class="grow ell">${esc(x.l)}</span><b>${Math.round((x.v / tot) * 100)}%</b></div>`).join("")}</div></div>
        ${c.go ? `<button class="btn ghost sm" data-go="${c.go}">${esc(c.cta || "Open")}</button>` : ""}</div>`;
    }
    case "bars": { const max = Math.max(...c.items.map((x) => x.v));
      return `<div class="kc"><div class="hrow" style="margin-bottom:6px"><span class="grow"><span class="eyebrow">${esc(c.title)}</span><b class="timer" style="display:block;font-size:22px;margin-top:2px">${esc(c.total)}</b></span>${c.chip ? `<span class="chip ok">${esc(c.chip)}</span>` : ""}</div>
        <div class="kchart" style="margin-bottom:22px">${c.items.map((x, i) => `<div class="col ${i === c.items.length - 1 ? "today" : ""}"><span class="tiny b num">${esc(x.t)}</span><i style="height:${(x.v / max) * 100}%"></i><small>${esc(x.l)}</small></div>`).join("")}</div>
        ${c.go ? `<button class="btn ghost sm" data-go="${c.go}">${esc(c.cta || "Open")}</button>` : ""}</div>`; }
    case "link": return `<div class="kc"><button class="hrow" style="width:100%;text-align:left" ${c.go ? `data-go="${c.go}"` : `data-act="${c.act}"`}><span class="kc-ic tint t-blue">${I(c.icon)}</span><b class="grow">${esc(c.label)}</b>${I("chevR")}</button></div>`;
  }
  return "";
}

// ── rendering ──
const KAIS_STARTERS = [
  ["fingerprint", "Clock me in", "Start today’s shift"], ["calendar", "Apply leave tomorrow", "Draft a casual leave"],
  ["clipboard", "How many hours did I log this week?", "Timesheet summary"], ["inbox", "Any pending approvals?", "Clear your inbox"],
  ["list", "What’s my leave balance?", "All leave types"], ["sun", "When is the next holiday?", "Plan your time off"],
];
function kaisMsgHtml(m, i, isLast) {
  if (m.role === "user") return `<div class="km user"><div class="kbub">${m.files?.length ? `<div class="kfiles">${m.files.map((f) => `<span class="chip" style="height:auto;padding:4px 10px 4px 4px">${fileIcon(f)}${esc(f)}</span>`).join("")}</div>` : ""}${esc(m.text)}</div></div>`;
  const streaming = KAIS.streaming?.mi === i;
  return `<div class="km ai"><div class="kname"><span class="kav-wrap ${streaming ? "busy" : ""}" style="--ad:-${Date.now() % 900}ms"><img class="kav" src="kais.svg" alt=""></span><b>Kais</b>${streaming ? `<span class="sr-only">is responding</span>` : ""}</div><div class="kbody">
    ${kaisReasoning(m, i, streaming)}
    <div class="kmd" data-mi="${i}" ${streaming && KAIS.streaming.phase === "think" ? "hidden" : ""}>${streaming ? md(m.text.slice(0, KAIS.streaming.n)) + `<span class="caret"></span>` : md(m.text)}</div>
    ${streaming ? "" : kaisCard(m.card, i)}
    ${streaming ? "" : `<div class="ktools"><button class="ib sm" data-act="kaisCopy" data-mi="${i}" aria-label="Copy" title="Copy">${I("copy")}</button>${isLast ? `<button class="ib sm" data-act="kaisRegen" aria-label="Regenerate" title="Regenerate">${I("history")}</button>` : ""}<button class="ib sm ${m.fb === 1 ? "on" : ""}" data-act="kaisFb" data-mi="${i}" data-v="1" aria-label="Good response" title="Good response">${I("thumb")}</button><button class="ib sm flip ${m.fb === -1 ? "on" : ""}" data-act="kaisFb" data-mi="${i}" data-v="-1" aria-label="Bad response" title="Bad response">${I("thumb")}</button></div>`}
    ${!streaming && isLast && m.follow?.length ? `<div class="kfollow">${m.follow.map((f) => `<button data-act="kaisAsk" data-q="${esc(f)}">${I("arrowOut")}${esc(f)}</button>`).join("")}</div>` : ""}
  </div></div>`;
}
route("kais", () => {
  const c = kaisChat(), msgs = c?.msgs || [];
  const ag = KAIS_AGENTS.find((a) => a.id === (c ? c.agent : KAIS.agent));
  const hello = `<div class="khello"><img class="kais-orb" src="kais.svg" alt=""><h1>${T(greetingKey())}, ${esc(S.me.display)}</h1><p>How can I help with your workday?</p>
    <div class="kstarters">${KAIS_STARTERS.map(([ic, q, s]) => `<button data-act="kaisAsk" data-q="${esc(q)}"><span class="i">${I(ic)}</span><b>${esc(q)}</b><small>${s}</small></button>`).join("")}</div></div>`;
  return `<div class="screen kais">
    <header class="top"><div class="pill"><button class="ib" data-act="back" aria-label="Back">${I("back")}</button><button class="ttl kais-ttl" data-act="kaisHistory" aria-label="Open Kais sidebar"><span class="hrow" style="gap:6px;justify-content:center">${ag ? `<span class="ag-logo xs">${msIcon("ag-" + ag.id)}</span>${esc(ag.name)}` : `Kais <span class="chip acc" style="height:20px;font-size:9.5px">AI</span>`}${I("chevD")}</span></button><button class="ib" data-act="kaisNew" aria-label="New chat">${I("edit")}</button></div></header>
    <div class="scroll kthread" data-thread>${msgs.length ? msgs.map((m, i) => kaisMsgHtml(m, i, i === msgs.length - 1)).join("") : ag ? agentHello(ag) : hello}</div>
    <form class="kcomposer" data-form="kais">

      <div class="kbox">
        ${KAIS.attach.length ? `<div class="kattach">${KAIS.attach.map((f, j) => `<div class="kfile">${fileIcon(f)}<span class="grow" style="min-width:0"><b class="ell">${esc(f)}</b><small>${fileKind(f)}</small></span><button type="button" data-act="kaisUnattach" data-i="${j}" aria-label="Remove ${esc(f)}">${I("x")}</button></div>`).join("")}</div>` : ""}
        <textarea name="q" rows="1" placeholder="${ag ? `Ask ${esc(ag.name)}…` : "Message Kais…"}" aria-label="Message Kais" enterkeyhint="send"></textarea>
        <div class="hrow"><button type="button" class="ib sm" data-act="kaisAttach" aria-label="Attach file">${I("plus")}</button><button type="button" class="ib sm" data-act="kaisMic" aria-label="Voice input">${I("mic")}</button><span class="grow"></span>
          ${KAIS.streaming ? `<button type="button" class="ksend stop" data-act="kaisStop" aria-label="Stop">${I("stop")}</button>` : `<button type="button" class="ksend voice" data-act="kaisVoice" aria-label="Start voice mode">${I("wave")}</button><button type="submit" class="ksend" aria-label="Send" hidden>${I("arrowUp")}</button>`}</div>
      </div>
    </form></div>`;
}, {
  mount(_, q) {
    const th = $("[data-thread]"); th.scrollTop = th.scrollHeight;
    const ta = $(".kcomposer textarea");
    const grow = () => { ta.style.height = "auto"; ta.style.height = Math.min(140, ta.scrollHeight) + "px"; };
    ta.addEventListener("input", grow);
    // empty box → voice mode button; typing → send button (ChatGPT / Claude pattern)
    const swapBtn = () => { const has = !!ta.value.trim() || KAIS.attach.length > 0; $(".ksend.voice")?.toggleAttribute("hidden", has); $(".ksend[type=submit]")?.toggleAttribute("hidden", !has); };
    ta.addEventListener("input", swapBtn); swapBtn();
    ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ta.form.requestSubmit(); } });
    if (q.agent) { kaisNewChat(q.agent); history.replaceState(null, "", "#/kais"); rerender(); return; }
    if (q.q) { history.replaceState(null, "", "#/kais"); kaisSend(q.q); return; }
    if (!KAIS.streaming) ta.focus();
  },
});

function kaisSend(text) {
  text = text.trim(); if (!text && KAIS.attach.length) text = `Here’s ${KAIS.attach.length > 1 ? KAIS.attach.length + " files" : "a file"} — ${KAIS.attach.join(", ")}`; if (!text || KAIS.streaming) return;
  let c = kaisChat();
  if (!c) { c = { id: uid(), title: text.slice(0, 48), ts: Date.now(), msgs: [], agent: KAIS.agent }; S.kais.chats.unshift(c); S.kais.active = c.id; }
  c.msgs.push({ role: "user", text, files: KAIS.attach.slice() }); KAIS.attach = []; c.ts = Date.now();
  kaisRespond(c, text);
}
function kaisRespond(c, text) {
  const a = (c.agent && agentAnswer(c.agent, text)) || kaisAnswer(text);
  const steps = kaisSteps(text, a, c.agent);
  const t0 = Date.now();
  c.msgs.push({ role: "ai", text: a.text, card: a.card || null, follow: a.follow || [], steps });
  save();
  const mi = c.msgs.length - 1;
  KAIS.streaming = { mi, n: 0, phase: "think", revealed: 1 };
  rerender();
  const scrollDown = () => { const th = $("[data-thread]"); if (th) th.scrollTop = th.scrollHeight; };
  scrollDown();
  const reveal = () => {
    if (!KAIS.streaming || KAIS.streaming.mi !== mi) return;
    if (KAIS.streaming.revealed < steps.length) { KAIS.streaming.revealed++; rerender(); scrollDown(); setTimeout(reveal, 520); return; }
    // reasoning done → fold it and stream the answer
    c.msgs[mi].thoughtMs = Date.now() - t0; save();
    KAIS.streaming.phase = "answer"; rerender();
    const el = () => $(`.kmd[data-mi="${mi}"]`);
    const step = () => {
      if (!KAIS.streaming || KAIS.streaming.mi !== mi) return;
      KAIS.streaming.n += 3 + Math.floor(Math.random() * 4);
      const node = el();
      if (KAIS.streaming.n >= a.text.length || !node) { KAIS.streaming = null; rerender(); return; }
      node.innerHTML = md(a.text.slice(0, KAIS.streaming.n)) + `<span class="caret"></span>`;
      const th = $("[data-thread]"); if (th && th.scrollHeight - th.scrollTop - th.clientHeight < 120) th.scrollTop = th.scrollHeight;
      setTimeout(step, 18);
    };
    step();
  };
  setTimeout(reveal, 560);
}
act("submit:kais", (f) => { const v = f.q.value; f.q.value = ""; kaisSend(v); });
act("kaisAsk", (b) => kaisSend(b.dataset.q));
act("kaisStop", () => {
  const c = kaisChat(), s = KAIS.streaming; if (!c || !s) return;
  const m = c.msgs[s.mi]; m.text = m.text.slice(0, s.n) + " …"; m.card = null; m.follow = []; KAIS.streaming = null; save(); rerender();
});
act("kaisRegen", () => {
  const c = kaisChat(); if (!c || KAIS.streaming) return;
  c.msgs.pop(); const lastUser = [...c.msgs].reverse().find((m) => m.role === "user");
  if (lastUser) kaisRespond(c, lastUser.text);
});
act("kaisCopy", (b) => {
  const m = kaisChat().msgs[Number(b.dataset.mi)];
  navigator.clipboard?.writeText(m.text.replace(/\*\*/g, "")).then(() => toast("Copied"), () => toast("Copy not available", "bad"));
});
act("kaisFb", (b) => { const m = kaisChat().msgs[Number(b.dataset.mi)]; const v = Number(b.dataset.v); m.fb = m.fb === v ? 0 : v; save(); rerender(); if (m.fb) toast(m.fb > 0 ? "Thanks for the feedback" : "Thanks — we’ll use this to improve Kais", "info"); });
act("kaisNew", () => { kaisNewChat(); rerender(); });
act("kaisAttach", () => pickFile("image/*,.pdf,.doc,.docx,.xlsx,.csv", (f) => { KAIS.attach.push(f.name); rerender(); }));
act("kaisUnattach", (b) => { KAIS.attach.splice(Number(b.dataset.i), 1); rerender(); });
act("kaisMic", (b) => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return toast("Voice input isn’t supported in this browser", "info");
  const r = new SR(); r.lang = "en-IN"; r.interimResults = true;
  const ta = $(".kcomposer textarea"); b.classList.add("rec");
  r.onresult = (e) => { ta.value = [...e.results].map((x) => x[0].transcript).join(""); ta.dispatchEvent(new Event("input")); };
  r.onend = () => b.classList.remove("rec");
  r.onerror = () => { b.classList.remove("rec"); toast("Couldn’t hear that — try again", "bad"); };
  r.start(); toast("Listening…", "info");
});
function fileKind(name) {
  const e = name.split(".").pop().toLowerCase();
  return { xlsx: "Spreadsheet", xls: "Spreadsheet", csv: "Spreadsheet", pdf: "PDF", doc: "Document", docx: "Document", ppt: "Presentation", pptx: "Presentation", png: "Image", jpg: "Image", jpeg: "Image", heic: "Image", webp: "Image" }[e] || "File";
}
// ── Reasoning (Arc UI text shimmer + step timeline) ──
function kaisSteps(q, a, agent) {
  const t = q.toLowerCase(), c = a.card?.type;
  const read = (what, ic) => [ic, what];
  if (c === "balances" || /leave|balance/.test(t)) return [read("Reading your leave records", "calendar"), read(`Checking ${LEAVE_TYPES.length} leave types and pending requests`, "list"), read("Preparing your balance summary", "sparkles")];
  if (c === "week" || /hour|timesheet|logged/.test(t)) return [read("Opening this week’s timesheet", "clipboard"), read("Adding up entries for each day", "clock"), read("Comparing against your 45h target", "chart")];
  if (c === "donut" || /expense|spend|claim/.test(t)) return [read("Fetching your expense claims", "receipt"), read("Grouping spend by category", "wallet"), read("Building the breakdown chart", "chart")];
  if (c === "bars" || /revenue|report/.test(t)) return [read("Loading the revenue report", "file"), read("Comparing the last 6 months", "chart"), read("Summarising the trend", "sparkles")];
  if (c === "approvals" || /approv|inbox|pending/.test(t)) return [read("Scanning your approval inbox", "inbox"), read("Checking each request against policy", "shield"), read("Picking out routine items", "checkCircle")];
  if (c === "clockin" || c === "clockout" || /clock/.test(t)) return [read("Checking today’s attendance", "fingerprint"), read(`Confirming your ${SHIFT.name} shift and location`, "pin")];
  if (c === "leave" || c === "wfh") return [read("Checking your calendar and balance", "calendar"), read("Drafting the request for your approver", "edit")];
  if (c === "log") return [read("Matching the task to your projects", "briefcase"), read("Preparing the time entry", "clock")];
  if (c === "holidays" || /holiday/.test(t)) return [read("Looking up the holiday calendar", "calendar"), read("Finding the next days off", "sun")];
  return [read("Understanding your question", "search"), read(agent ? "Checking with the " + (KAIS_AGENTS.find((x) => x.id === agent)?.name || "agent") : "Looking across your workspace", "sparkles")];
}
function kaisReasoning(m, i, streaming) {
  if (!m.steps?.length) return "";
  const live = streaming && KAIS.streaming.phase === "think";
  const shown = live ? m.steps.slice(0, KAIS.streaming.revealed) : m.steps;
  const open = live || m.stepsOpen;
  const secs = m.thoughtMs ? (m.thoughtMs / 1000).toFixed(1) : null;
  const head = live
    ? `<div class="kthink-head"><span class="kthink-dot"></span><span class="ts-shimmer">Thinking…</span></div>`
    : `<button class="kthink-head kthink-sum" data-act="kaisSteps" data-mi="${i}" aria-expanded="${!!open}">${I("sparkles")}<span>Thought for ${secs || "1.6"}s · ${plural(m.steps.length, "step")}</span>${I(open ? "chevU" : "chevD")}</button>`;
  const list = open ? `<ol class="kthink-steps">${shown.map(([ic, s], j) => { const cur = live && j === shown.length - 1;
      return `<li class="${cur ? "cur" : "done"}"><span class="kts-ic">${I(cur ? ic : "check")}</span><span class="${cur ? "ts-shimmer" : ""}">${esc(s)}</span></li>`; }).join("")}</ol>` : "";
  return `<div class="kthink ${live ? "live" : ""}" aria-live="polite">${head}${list}</div>`;
}
act("kaisSteps", (b) => { const m = kaisChat()?.msgs[Number(b.dataset.mi)]; if (!m) return; m.stepsOpen = !m.stepsOpen; save(); rerender(); });
// ── Agents ──
const KAIS_AGENTS = [
  { id: "expense", name: "Expense Assistant", icon: "wallet", tint: "t-violet", desc: "Track, manage and submit your expenses effortlessly with AI.",
    starters: ["Summarise my expenses by category", "Show pending claims", "Upload new expense", "Generate expense report"] },
  { id: "report", name: "Report Assistant", icon: "chart", tint: "t-blue", desc: "Build reports, explore data and get insights — powered by Kais AI.",
    starters: ["View revenue report", "Timesheet report", "View existing reports"] },
  { id: "approval", name: "Approval Assistant", icon: "checkCircle", tint: "t-red", desc: "Smart actions, faster approvals.",
    starters: ["Show expense approvals", "Pending approvals", "Approval escalations"] },
];
const PROMPTS = [
  ["Attendance", ["Clock me in", "Show my time logs", "Apply WFH for tomorrow"]],
  ["Leave", ["What’s my leave balance?", "Apply leave tomorrow", "When is the next holiday?"]],
  ["Timesheet", ["How many hours did I log this week?", "Log 2h on design system development", "Submit my timesheet"]],
  ["Approvals & expenses", ["Any pending approvals?", "Summarise my expenses by category", "Show pending claims"]],
];
const CAT_COLORS = ["#ff4013", "#7c4dff", "#0d9488", "#f5b820", "#2563eb", "#db2777"];
function agentAnswer(id, q) {
  const t = q.toLowerCase();
  if (id === "expense") {
    if (/summar|categor|breakdown|spend|where/.test(t)) {
      const by = {}; S.expenses.filter((e) => e.status !== "rejected").forEach((e) => (by[e.cat] = (by[e.cat] || 0) + e.amount));
      const items = Object.entries(by).sort((a, b) => b[1] - a[1]).map(([l, v], i) => ({ l, v, c: CAT_COLORS[i % CAT_COLORS.length] }));
      const tot = items.reduce((a, x) => a + x.v, 0);
      return { text: `Here’s your spend by category over the last month. **${items[0]?.l}** is the biggest share at **${Math.round((items[0]?.v / tot) * 100)}%**.\n${items.map((x) => `- ${x.l}: **${money(x.v)}**`).join("\n")}`,
        card: { type: "donut", title: "Expenses by category", total: money(tot), items, go: "#/expenses?tab=insights", cta: "Open insights" }, follow: ["Show pending claims", "Generate expense report"] };
    }
    if (/pending|claim|status/.test(t)) {
      const p = S.expenses.filter((e) => e.status === "pending");
      return { text: p.length ? `You have **${p.length}** claim(s) awaiting reimbursement:\n${p.map((e) => `- ${e.title} — **${money(e.amount)}** (${D.short(e.date)})`).join("\n")}` : "No claims are pending — everything’s been processed.",
        card: { type: "link", label: "Open my claims", go: "#/expenses", icon: "wallet" }, follow: ["Summarise my expenses by category", "Upload new expense"] };
    }
    if (/upload|new|scan|add/.test(t)) return { text: "Snap or upload the bill and I’ll fill in the amount and category for you.", card: { type: "link", label: "Scan a bill", go: "#/expenses/new?scan=1", icon: "scan" }, follow: ["Show pending claims"] };
    if (/report/.test(t)) { const tot = S.expenses.reduce((a, e) => a + e.amount, 0); return { text: `This month: **${S.expenses.length}** claims worth **${money(tot)}** — ${S.expenses.filter((e) => e.status === "approved").length} approved, ${S.expenses.filter((e) => e.status === "pending").length} pending, ${S.expenses.filter((e) => e.status === "rejected").length} rejected.`, card: { type: "link", label: "Open expense insights", go: "#/expenses?tab=insights", icon: "chart" }, follow: ["Summarise my expenses by category"] }; }
  }
  if (id === "report") {
    if (/revenue/.test(t)) {
      const items = [["Jun", 38], ["Jul", 42], ["Aug", 40], ["Sep", 47], ["Oct", 51], ["Nov", 55]].map(([l, v]) => ({ l, v, t: `${v}L` }));
      return { text: "Revenue is up **8%** month on month — November is tracking at **₹55L**, the best month this half.", card: { type: "bars", title: "Revenue (₹ lakh)", total: "₹2.73 Cr", chip: "+8% MoM", items }, follow: ["Timesheet report", "View existing reports"] };
    }
    if (/timesheet|hours/.test(t)) return kaisAnswer("How many hours did I log this week?");
    if (/existing|reports|saved/.test(t)) return { text: "Your saved reports:\n- **Weekly utilisation** — every Monday\n- **Leave summary (team)** — monthly\n- **Expense by project** — monthly\n- **Billable vs non-billable** — weekly", card: { type: "link", label: "Open timesheet history", go: "#/ts/history", icon: "history" }, follow: ["View revenue report"] };
  }
  if (id === "approval") {
    if (/escalat|flag|policy/.test(t)) { const f = S.inbox.filter((x) => x.flag); return { text: `**${f.length}** requests were flagged by Kais and need a closer look:\n${f.slice(0, 5).map((x) => `- ${person(x.who).name} — ${x.flag}`).join("\n")}`, card: { type: "link", label: "Review in inbox", go: "#/inbox", icon: "inbox" }, follow: ["Pending approvals"] }; }
    if (/expense/.test(t)) { const e = S.inbox.filter((x) => x.kind === "expense"); return { text: `**${e.length}** expense approvals are waiting, worth **${money(e.reduce((a, x) => a + (x.amount || 0), 0))}**.`, card: { type: "approvals", ids: e.filter((x) => x.routine).map((x) => x.id) }, follow: ["Approval escalations"] }; }
    if (/pending|approv|show/.test(t)) return kaisAnswer("Any pending approvals?");
  }
  return null;
}
function agentHello(ag) {
  return `<div class="khello ag-hello"><div class="ag-hero"><span class="ag-logo lg">${msIcon("ag-" + ag.id)}</span><span class="grow"><b>${esc(ag.name)}</b><span class="small muted">${esc(ag.desc)}</span></span></div>
    <div class="ag-chips">${ag.starters.map((s) => `<button data-act="kaisAsk" data-q="${esc(s)}">${esc(s)}</button>`).join("")}<button data-act="kaisPrompts">More ${I("chevR")}</button></div></div>`;
}
function chatGroups(list) {
  const today = D.today(), y = D.add(today, -1), wk = D.add(today, -7), out = { Today: [], Yesterday: [], "Previous 7 days": [], Older: [] };
  list.forEach((c) => { const d = D.iso(c.ts); (d === today ? out.Today : d === y ? out.Yesterday : d >= wk ? out["Previous 7 days"] : out.Older).push(c); });
  return Object.entries(out).filter(([, v]) => v.length);
}
act("kaisHistory", () => {
  kaisChat();
  if (drawerEl) return;
  const layer = $("#layer");
  const scrim = document.createElement("div"); scrim.className = "scrim";
  const el = document.createElement("aside"); el.className = "drawer ksb";
  el.innerHTML = `<div class="ksb-title"><img src="kais.svg" alt=""><b>Kais</b><span class="chip acc">AI</span><span class="grow"></span><button class="ib" data-k="close" aria-label="Close sidebar">${I("x")}</button></div><div class="ksb-head"><label class="searchbox grow">${I("search")}<input data-ksq placeholder="Search chats & agents" aria-label="Search chats and agents"></label><button class="ib" data-k="new" aria-label="New chat">${I("edit")}</button></div><div class="ksb-body" data-ksb></div>`;
  layer.append(scrim, el); drawerEl = { el, scrim }; scrim.addEventListener("click", closeDrawer);
  let q = "";
  const draw = () => {
    const ql = q.toLowerCase();
    const ags = KAIS_AGENTS.filter((a) => !ql || (a.name + a.desc).toLowerCase().includes(ql));
    const chats = S.kais.chats.filter((c) => !ql || c.title.toLowerCase().includes(ql));
    el.querySelector("[data-ksb]").innerHTML = `
      ${!ql || "prompt library".includes(ql) || ags.length ? `<div class="ksb-sec">Agents</div>` : ""}
      ${!ql || "prompt library".includes(ql) ? `<button class="ksb-row" data-k="prompts"><span class="ag-logo sm">${msIcon("ag-prompts")}</span><span class="grow"><b>Prompt Library</b><small>Explore ready-to-use prompts</small></span></button>` : ""}
      ${ags.map((a) => `<button class="ksb-row ${KAIS.agent === a.id ? "on" : ""}" data-k="agent" data-id="${a.id}"><span class="ag-logo sm">${msIcon("ag-" + a.id)}</span><span class="grow"><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></span></button>`).join("")}
      ${chatGroups(chats).map(([g, list]) => `<div class="ksb-sec">${g}</div>${list.map((c) => { const a = KAIS_AGENTS.find((x) => x.id === c.agent);
        return `<div class="ksb-chat ${S.kais.active === c.id ? "on" : ""}"><button class="grow" data-k="open" data-id="${c.id}">${a ? `<span class="ag-logo xs">${msIcon("ag-" + a.id)}</span>` : `<span class="i">${I("msg")}</span>`}<span class="ell">${esc(c.title)}</span></button><button class="ib sm" data-k="del" data-id="${c.id}" aria-label="Delete chat">${I("trash")}</button></div>`; }).join("")}`).join("")}
      ${!chats.length ? (ql ? `<p class="small muted" style="padding:12px 6px">No chats match “${esc(q)}”.</p>` : emptyMini("msg", "No chats yet — ask Kais anything.")) : ""}`;
  };
  el.addEventListener("input", (e) => { if (e.target.matches("[data-ksq]")) { q = e.target.value; draw(); } });
  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-k]"); if (!b) return;
    const k2 = b.dataset.k;
    if (k2 === "close") { closeDrawer(); return; }
    if (k2 === "new") { kaisNewChat(); closeDrawer(); rerender(); }
    if (k2 === "agent") { kaisNewChat(b.dataset.id); closeDrawer(); rerender(); }
    if (k2 === "prompts") { closeDrawer(); setTimeout(() => ACTIONS.kaisPrompts(), 230); }
    if (k2 === "open") { const c = S.kais.chats.find((x) => x.id === b.dataset.id); S.kais.active = c.id; KAIS.agent = c.agent || null; KAIS.streaming = null; save(); closeDrawer(); rerender(); }
    if (k2 === "del") { S.kais.chats = S.kais.chats.filter((c) => c.id !== b.dataset.id); if (S.kais.active === b.dataset.id) S.kais.active = null; save(); draw(); toast("Chat deleted"); }
  });
  draw();
});
act("kaisPrompts", () => {
  const s = openSheet({ title: "Prompt Library", body: `<p class="small muted" style="margin-bottom:12px">Tap a prompt to send it to Kais.</p>${PROMPTS.map(([cat, list]) => `<div class="sec" style="margin:14px 0 8px"><span class="eyebrow">${cat}</span></div><div class="stack s6">${list.map((p) => `<button class="kp-row" data-s="use" data-q="${esc(p)}">${I("sparkles")}<span class="grow">${esc(p)}</span>${I("arrowUp")}</button>`).join("")}</div>`).join("")}`,
    onMount(el) { onS(el, { use(b) { closeSheet(s); kaisSend(b.dataset.q); } }); } });
});

// actions from rich cards
act("kaisDo", (b) => {
  const c = kaisChat(), m = c.msgs[Number(b.dataset.mi)], card = m.card;
  const k = b.dataset.k;
  if (k === "clockin") { if (!S.att.today.inTs || S.att.today.outTs) { S.att.today.inTs = Date.now(); S.att.today.outTs = null; } card.done = `Clocked in at ${D.time(S.att.today.inTs)}`; }
  if (k === "clockout") { S.att.today.outTs = Date.now(); card.done = `Clocked out at ${D.time(S.att.today.outTs)} · ${fmtMin(workedSec() / 60)} worked`; }
  if (k === "leave") {
    const b2 = leaveBalances().find((x) => x.id === card.leaveType);
    if (b2.available < 1) return toast(`No ${b2.name.toLowerCase()} left`, "bad");
    if (S.requests.some((r) => r.type === "leave" && ["pending", "approved"].includes(r.status) && r.from <= card.day && r.to >= card.day)) return toast("You already have leave on that day", "bad");
    const r = { id: uid(), type: "leave", leaveType: card.leaveType, from: card.day, to: card.day, dayType: "full", reason: "Requested via Kais", notify: [], attachments: [], comments: [], status: "pending", created: Date.now(), activity: [{ text: "Request raised via Kais", ts: Date.now(), kind: "on" }] };
    S.requests.push(r); card.done = `Leave request sent to ${person(S.me.manager).name}`;
  }
  if (k === "wfh") {
    const reason = $(`[data-kreason="${b.dataset.mi}"]`)?.value.trim();
    if (!reason) { $(`[data-kreason="${b.dataset.mi}"]`)?.focus(); return toast("Add a reason first", "bad"); }
    S.requests.push({ id: uid(), type: "wfh", from: card.day, to: card.day, dayType: "full", reason, notify: [], attachments: [], comments: [], status: "pending", created: Date.now(), activity: [{ text: "Request raised via Kais", ts: Date.now(), kind: "on" }] });
    card.done = "WFH request sent for approval";
  }
  if (k === "log") {
    const list = (S.ts.entries[card.day] ||= []);
    if (isLocked(card.day)) return toast("That week is already submitted", "bad");
    const ex = list.find((e) => e.pid === card.pid && e.ti === card.ti);
    if (ex) { ex.mins += card.mins; if (!ex.comment) ex.comment = "Logged via Kais"; }
    else list.push({ id: uid(), pid: card.pid, ti: card.ti, mins: card.mins, billable: !proj(card.pid).nonbill, comment: "Logged via Kais" });
    ensureWeek(D.monday(card.day)); card.done = `Logged ${fmtH(card.mins)} · day total ${fmtH(sumMins(list))}`;
  }
  if (k === "approve") { const n = card.ids.length; S.inbox = S.inbox.filter((x) => !card.ids.includes(x.id)); card.done = `Approved ${plural(n, "request")}`; }
  save(); rerender(); toast(card.done);
});

// Entry points: dock button, search "ask", home ask bar
function openKais(q = "") { go(q ? `#/kais?q=${encodeURIComponent(q)}` : "#/kais"); }
// Dock button always lands on the Kais home (new chat); past chats stay in the sidebar
act("kais", () => { kaisNewChat(); KAIS.streaming = null; save(); if (location.hash.split("?")[0] === "#/kais") rerender(); else openKais(); });

// ── Voice mode (ChatGPT / Claude style): orb reacts to your voice, live captions, Kais speaks back ──
const VOICE = { on: false, rec: null, stream: null, ctx: null, raf: 0, muted: false, captions: true, state: "idle" };
function vmSet(state, text) {
  VOICE.state = state;
  const el = $(".vmode"); if (!el) return;
  el.dataset.state = state;
  const label = { listening: "Listening…", thinking: "Thinking…", speaking: "Speaking", muted: "Mic muted", idle: "Tap the orb to talk", error: "Voice isn’t available" }[state] || "";
  el.querySelector("[data-vm-state]").textContent = label;
  if (text !== undefined) el.querySelector("[data-vm-cap]").innerHTML = text;
}
function vmSpeak(text, done) {
  const plain = text.replace(/\*\*/g, "").replace(/^- /gm, "").replace(/\n+/g, ". ");
  if (!("speechSynthesis" in window)) { done(); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(plain);
  u.rate = 1.02; u.pitch = 1; u.lang = "en-IN";
  const v = speechSynthesis.getVoices().find((x) => /en-(IN|GB|US)/.test(x.lang) && /female|zira|samantha|google/i.test(x.name)) || speechSynthesis.getVoices().find((x) => x.lang.startsWith("en"));
  if (v) u.voice = v;
  u.onend = done; u.onerror = done;
  speechSynthesis.speak(u);
}
function vmListen() {
  if (!VOICE.on || VOICE.muted) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { vmSet("error", "Voice mode needs speech recognition — try Chrome, Edge or Safari."); return; }
  const r = new SR(); VOICE.rec = r; r.lang = "en-IN"; r.interimResults = true; r.continuous = false;
  let finalText = "";
  vmSet("listening", VOICE.captions ? `<span class="faint">Say something like “What’s my leave balance?”</span>` : "");
  r.onresult = (e) => {
    finalText = [...e.results].map((x) => x[0].transcript).join("");
    if (VOICE.captions) vmSet("listening", `<b>${esc(finalText)}</b>`);
  };
  r.onerror = (e) => { if (e.error === "not-allowed") vmSet("error", "Microphone access was blocked. Allow it in the browser to use voice mode."); };
  r.onend = () => {
    VOICE.rec = null;
    if (!VOICE.on || VOICE.muted) return;
    const q = finalText.trim();
    if (!q) { setTimeout(vmListen, 300); return; }
    vmSet("thinking", VOICE.captions ? `<b>${esc(q)}</b>` : "");
    const c = kaisChat();
    const agent = c ? c.agent : KAIS.agent;
    const a = (agent && agentAnswer(agent, q)) || kaisAnswer(q);
    kaisSend(q); // also lands in the chat thread
    setTimeout(() => {
      if (!VOICE.on) return;
      vmSet("speaking", VOICE.captions ? md(a.text) : "");
      vmSpeak(a.text, () => { if (VOICE.on) setTimeout(vmListen, 350); });
    }, 700);
  };
  try { r.start(); } catch { setTimeout(vmListen, 500); }
}
async function vmMeter() {
  try {
    VOICE.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    VOICE.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const an = VOICE.ctx.createAnalyser(); an.fftSize = 256;
    VOICE.ctx.createMediaStreamSource(VOICE.stream).connect(an);
    const buf = new Uint8Array(an.frequencyBinCount);
    const tick = () => {
      if (!VOICE.on) return;
      an.getByteFrequencyData(buf);
      const lvl = VOICE.muted ? 0 : Math.min(1, buf.reduce((s, v) => s + v, 0) / buf.length / 90);
      $(".vmode")?.style.setProperty("--lvl", lvl.toFixed(3));
      VOICE.raf = requestAnimationFrame(tick);
    };
    tick();
  } catch { /* no mic meter: the orb keeps its idle animation */ }
}
function vmStop() {
  VOICE.on = false;
  try { VOICE.rec?.abort(); } catch {}
  VOICE.rec = null;
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  cancelAnimationFrame(VOICE.raf);
  VOICE.stream?.getTracks().forEach((t) => t.stop()); VOICE.stream = null;
  VOICE.ctx?.close().catch(() => {}); VOICE.ctx = null;
}
act("kaisVoice", () => {
  const c = kaisChat(), agent = KAIS_AGENTS.find((a) => a.id === (c ? c.agent : KAIS.agent));
  VOICE.on = true; VOICE.muted = false;
  const s = openSheet({
    cls: "full vmode-sheet",
    raw: `<div class="vmode" data-state="idle">
      <div class="vm-top"><span class="vm-who"><img src="kais.svg" alt="">${agent ? esc(agent.name) : "Kais"} <span class="chip acc">Voice</span></span>
        <button class="ib" data-s="cc" aria-label="Toggle captions" aria-pressed="true">${I("msg")}</button></div>
      <div class="vm-stage"><button class="vm-orb" data-s="orb" aria-label="Talk to Kais"><span class="b1"></span><span class="b2"></span><span class="b3"></span><img src="kais.svg" alt=""></button></div>
      <div class="vm-state" data-vm-state>Starting…</div>
      <div class="vm-cap kmd" data-vm-cap aria-live="polite"></div>
      <div class="vm-ctrl">
        <button class="vm-btn" data-s="mute" aria-label="Mute microphone" aria-pressed="false">${I("mic")}</button>
        <button class="vm-btn end" data-s="end" aria-label="End voice mode">${I("x")}</button>
      </div>
    </div>`,
    onClose() { vmStop(); },
    onMount(el) {
      onS(el, {
        end() { closeSheet(s); },
        mute(b) { VOICE.muted = !VOICE.muted; b.setAttribute("aria-pressed", VOICE.muted); b.classList.toggle("on", VOICE.muted);
          if (VOICE.muted) { try { VOICE.rec?.abort(); } catch {} vmSet("muted"); } else vmListen(); },
        cc(b) { VOICE.captions = !VOICE.captions; b.setAttribute("aria-pressed", VOICE.captions); b.classList.toggle("off", !VOICE.captions); if (!VOICE.captions) el.querySelector("[data-vm-cap]").innerHTML = ""; },
        orb() { if (VOICE.state === "speaking") { speechSynthesis.cancel(); vmListen(); } else if (!VOICE.rec) vmListen(); },
      });
      vmMeter(); setTimeout(vmListen, 400);
    },
  });
});
