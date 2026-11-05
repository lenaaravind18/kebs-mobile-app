// Kais — full-screen assistant (chat-app style): suggested prompts, streamed answers, rich action cards,
// follow-ups, copy / regenerate / feedback, chat history, attachments, voice input.

S.kais ||= { chats: [], active: null };
const KAIS = { streaming: null, attach: [] };

const kaisChat = () => (S.kais ||= { chats: [], active: null }).chats.find((c) => c.id === S.kais.active);
function kaisNewChat() { S.kais.active = null; KAIS.attach = []; }

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
  return `<div class="km ai"><div class="kname"><img class="kav" src="kais.svg" alt=""><b>Kais</b>${streaming ? `<span class="tiny faint">thinking…</span>` : ""}</div><div class="kbody">
    <div class="kmd" data-mi="${i}">${streaming ? md(m.text.slice(0, KAIS.streaming.n)) + `<span class="caret"></span>` : md(m.text)}</div>
    ${streaming ? "" : kaisCard(m.card, i)}
    ${streaming ? "" : `<div class="ktools"><button class="ib sm" data-act="kaisCopy" data-mi="${i}" aria-label="Copy" title="Copy">${I("copy")}</button>${isLast ? `<button class="ib sm" data-act="kaisRegen" aria-label="Regenerate" title="Regenerate">${I("history")}</button>` : ""}<button class="ib sm ${m.fb === 1 ? "on" : ""}" data-act="kaisFb" data-mi="${i}" data-v="1" aria-label="Good response" title="Good response">${I("thumb")}</button><button class="ib sm flip ${m.fb === -1 ? "on" : ""}" data-act="kaisFb" data-mi="${i}" data-v="-1" aria-label="Bad response" title="Bad response">${I("thumb")}</button></div>`}
    ${!streaming && isLast && m.follow?.length ? `<div class="kfollow">${m.follow.map((f) => `<button data-act="kaisAsk" data-q="${esc(f)}">${I("arrowOut")}${esc(f)}</button>`).join("")}</div>` : ""}
  </div></div>`;
}
route("kais", () => {
  const c = kaisChat(), msgs = c?.msgs || [];
  const hello = `<div class="khello"><img class="kais-orb" src="kais.svg" alt=""><h1>${T(greetingKey())}, ${esc(S.me.display)}</h1><p>How can I help with your workday?</p>
    <div class="kstarters">${KAIS_STARTERS.map(([ic, q, s]) => `<button data-act="kaisAsk" data-q="${esc(q)}"><span class="i">${I(ic)}</span><b>${esc(q)}</b><small>${s}</small></button>`).join("")}</div></div>`;
  return `<div class="screen kais">
    <header class="top"><div class="pill"><button class="ib" data-act="back" aria-label="Back">${I("back")}</button><button class="ttl kais-ttl" data-act="kaisHistory" aria-label="Chat history"><span class="hrow" style="gap:6px;justify-content:center">Kais <span class="chip acc" style="height:20px;font-size:9.5px">AI</span>${I("chevD")}</span></button><button class="ib" data-act="kaisNew" aria-label="New chat">${I("edit")}</button></div></header>
    <div class="scroll kthread" data-thread>${msgs.length ? msgs.map((m, i) => kaisMsgHtml(m, i, i === msgs.length - 1)).join("") : hello}</div>
    <form class="kcomposer" data-form="kais">
      ${KAIS.attach.length ? `<div class="kfiles">${KAIS.attach.map((f, i) => `<span class="chip" style="height:auto;padding:4px 10px 4px 4px">${fileIcon(f)}${esc(f)}<button type="button" data-act="kaisUnattach" data-i="${i}" aria-label="Remove">${I("x")}</button></span>`).join("")}</div>` : ""}
      <div class="kbox">
        <textarea name="q" rows="1" placeholder="Message Kais…" aria-label="Message Kais" enterkeyhint="send"></textarea>
        <div class="hrow"><button type="button" class="ib sm" data-act="kaisAttach" aria-label="Attach file">${I("plus")}</button><button type="button" class="ib sm" data-act="kaisMic" aria-label="Voice input">${I("mic")}</button><span class="grow tiny faint">Kais can make mistakes. Check important info.</span>
          ${KAIS.streaming ? `<button type="button" class="ksend stop" data-act="kaisStop" aria-label="Stop">${I("stop")}</button>` : `<button type="submit" class="ksend" aria-label="Send">${I("arrowUp")}</button>`}</div>
      </div>
    </form></div>`;
}, {
  mount(_, q) {
    const th = $("[data-thread]"); th.scrollTop = th.scrollHeight;
    const ta = $(".kcomposer textarea");
    const grow = () => { ta.style.height = "auto"; ta.style.height = Math.min(140, ta.scrollHeight) + "px"; };
    ta.addEventListener("input", grow);
    ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ta.form.requestSubmit(); } });
    if (q.q) { history.replaceState(null, "", "#/kais"); kaisSend(q.q); return; }
    if (!KAIS.streaming) ta.focus();
  },
});

function kaisSend(text) {
  text = text.trim(); if (!text || KAIS.streaming) return;
  let c = kaisChat();
  if (!c) { c = { id: uid(), title: text.slice(0, 48), ts: Date.now(), msgs: [] }; S.kais.chats.unshift(c); S.kais.active = c.id; }
  c.msgs.push({ role: "user", text, files: KAIS.attach.slice() }); KAIS.attach = []; c.ts = Date.now();
  kaisRespond(c, text);
}
function kaisRespond(c, text) {
  const a = kaisAnswer(text);
  c.msgs.push({ role: "ai", text: a.text, card: a.card || null, follow: a.follow || [] });
  save();
  const mi = c.msgs.length - 1;
  KAIS.streaming = { mi, n: 0, thinking: true };
  rerender();
  const el = () => $(`.kmd[data-mi="${mi}"]`);
  const think = el(); if (think) think.innerHTML = `<span class="typing"><span></span><span></span><span></span></span>`;
  setTimeout(() => {
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
  }, 550);
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
act("kaisHistory", () => {
  kaisChat();
  const s = openSheet({
    title: "Chats",
    body: `<button class="btn primary block" data-s="new">${I("edit")}New chat</button><div class="list" style="margin-top:8px">${S.kais.chats.map((c) => `<div class="li"><button class="grow" style="text-align:left;min-width:0" data-s="open" data-id="${c.id}"><span class="t ell" style="display:block">${esc(c.title)}</span><span class="s">${plural(c.msgs.filter((m) => m.role === "user").length, "message")} · ${D.ago(c.ts)} ago</span></button><button class="ib sm" data-s="del" data-id="${c.id}" aria-label="Delete chat">${I("trash")}</button></div>`).join("") || `<p class="small muted" style="padding:16px 4px">No chats yet — ask Kais anything.</p>`}</div>`,
    onMount(el) {
      onS(el, {
        new() { kaisNewChat(); closeSheet(s); rerender(); },
        open(x) { S.kais.active = x.dataset.id; KAIS.streaming = null; save(); closeSheet(s); rerender(); },
        del(x) { S.kais.chats = S.kais.chats.filter((c) => c.id !== x.dataset.id); if (S.kais.active === x.dataset.id) S.kais.active = null; save(); closeSheet(s); rerender(); toast("Chat deleted"); },
      });
    },
  });
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
act("kais", () => openKais());
