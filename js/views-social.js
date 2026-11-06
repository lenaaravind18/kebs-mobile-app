// Social: wishes walls (what the receiver sees), "Wishes for you" page, and a detail screen for every alert
// that had nowhere to go (mentions, comments, task invites, leave, assignments).
// Note: KEBS runs on-device without a server, so a wish you send is stored here and shown on the receiver's
// profile wall; your own celebrations come in as an alert with the colleagues' wishes.

const WISH_LINES = {
  birthday: ["Happy birthday! Have a great one 🎂", "Many happy returns of the day! 🎉", "Wishing you a fantastic year ahead 🎈", "Happy birthday — enjoy the cake! 🍰"],
  work: ["Happy work anniversary! 🎉", "Congrats on another great year 🥂", "Thanks for everything you bring to the team 🙌", "Here’s to many more years! 🚀"],
};
// colleagues' wishes on someone's wall (stable per person and occasion)
function wallWishes(id, kind, date) {
  const others = S.people.filter((p) => p.id !== id).slice(0, 12);
  let h = 0; for (const ch of id + kind) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const n = 3 + (h % 4), lines = WISH_LINES[kind];
  return Array.from({ length: n }, (_, i) => { const who = others[(h + i * 5) % others.length]; return { who: who.id, text: lines[(h + i) % lines.length], ts: Date.parse(date) + (9 + i) * 36e5 - 864e5 * (date > D.today() ? 0 : 0) }; })
    .filter((w, i, a) => a.findIndex((x) => x.who === w.who) === i);
}
function actionToast(msg, label, fn) {
  const t = document.createElement("div");
  t.className = "toast ok"; t.innerHTML = `${I("checkCircle")}<span>${esc(msg)}</span><button type="button" class="tk-undo">${esc(label)}</button>`;
  t.querySelector("button").onclick = () => { fn(); t.remove(); };
  $("#toasts").append(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 260); }, 4200);
}

// ── your own celebration + its alert (seeded once) ──
(function socialSeed() {
  if (S.socialSeeded) return;
  const now = Date.now(), H = 36e5;
  S.myWishes = { kind: "work", years: 2, date: D.today(), list: [
    { id: uid(), who: "sj", text: "Happy 2-year work anniversary, Aravind! The design system would not be the same without you 🎉", ts: now - 5 * H },
    { id: uid(), who: "pr", text: "Two years already! Thanks for raising the bar on every release 🙌", ts: now - 4 * H },
    { id: uid(), who: "jh", text: "Congrats! Here’s to many more launches together 🚀", ts: now - 3 * H },
    { id: uid(), who: "vi", text: "Happy anniversary! Coffee is on me today ☕", ts: now - 2 * H },
    { id: uid(), who: "sl", text: "Congrats Aravind — thanks for always helping with the tough reviews!", ts: now - 70 * 60e3 },
    { id: uid(), who: "al", text: "Happy work anniversary 🥂", ts: now - 30 * 60e3 },
  ] };
  S.notifs.push({ id: uid(), kind: "wish", who: "sj", html: "<b>Surya Jayaraman</b> and 5 others wished you on your <b>2-year work anniversary</b> 🎉", ts: now - 30 * 60e3, read: false, go: "#/wishes" });
  // the "new task assigned" alert points at a real task
  const a = S.notifs.find((n) => n.kind === "assign" && /client onboarding/i.test(n.html));
  if (a && S.pj?.p2) {
    let t = S.pj.p2.tasks.find((x) => /client onboarding/i.test(x.title));
    if (!t) { const tp = PROJECTS.find((x) => x.id === "p2"); const ti = tp ? tp.tasks.push("Design UX for client onboarding") - 1 : null;
      t = { id: uid(), ti, title: "Design UX for client onboarding", assignee: "me", status: "todo", priority: "high", due: (() => { let d = D.today(); while (D.wd(d) !== 4) d = D.add(d, 1); return d; })(), est: 12, desc: "Map the onboarding journey for new clients and design the first-run screens.", comments: [], created: now - 8 * H };
      S.pj.p2.tasks.push(t); }
    a.go = `#/projects/p2/task/${t.id}`;
  }
  S.socialSeeded = true; save();
})();
if (typeof PI_KIND !== "undefined") PI_KIND.wish = { label: "Celebration", icon: "cake" };

// ── Wishes for you ──
route("wishes", () => {
  const W = S.myWishes;
  if (!W) return `<div class="screen">${topbar("Wishes")}${emptyState(["award"], "No wishes yet", "Wishes from your colleagues on your birthday and work anniversaries show up here.")}</div>`;
  const thanked = W.list.filter((w) => w.thanked).length, occasion = W.kind === "work" ? `${W.years}-year work anniversary` : "birthday";
  return `<div class="screen has-foot">${topbar("Wishes for you")}
  <div class="scroll"><div class="stack">
    <div class="wish-hero"><span class="wh-conf" aria-hidden="true">${"<i></i>".repeat(14)}</span>
      <span class="wh-ic">${I(W.kind === "work" ? "award" : "cake")}</span>
      <h1>Happy ${occasion}, ${esc(S.me.display.split(" ")[0])}!</h1>
      <p>${plural(W.list.length, "colleague")} sent you wishes${thanked ? ` · you thanked ${thanked}` : ""}</p>
      <span class="av-stack">${W.list.slice(0, 6).map((w) => avatar(w.who, "sm")).join("")}</span></div>
    <div class="sec"><h2>Wishes <span class="muted" style="font-weight:600">(${W.list.length})</span></h2></div>
    <div class="stack" data-lazy="8">${W.list.slice().sort((a, b) => b.ts - a.ts).map((w) => `<div class="card wish-card">
      <div class="hrow">${avatar(w.who)}<span class="grow" style="min-width:0"><b class="ell" style="display:block">${esc(person(w.who).name)}</b><span class="tiny muted">${D.ago(w.ts)} ago</span></span>
        <button class="wish-thx ${w.thanked ? "on" : ""}" data-act="wishThank" data-id="${w.id}" aria-pressed="${!!w.thanked}">${I("thumb")}${w.thanked ? "Thanked" : "Thank"}</button></div>
      <p>${esc(w.text)}</p>
      ${w.reply ? `<div class="wish-reply">${avatar("me", "xs")}<span>${esc(w.reply)}</span></div>` : `<button class="link" data-act="wishReply" data-id="${w.id}">Reply</button>`}
    </div>`).join("")}</div>
  </div></div>
  <div class="foot"><button class="btn primary block" data-act="wishThankAll" ${thanked === W.list.length ? "disabled" : ""}>${thanked === W.list.length ? "You’ve thanked everyone" : "Thank everyone"}</button></div></div>`;
});
act("wishThank", (b) => { const w = S.myWishes.list.find((x) => x.id === b.dataset.id); w.thanked = !w.thanked; save(); rerender(); if (w.thanked) toast(`Thanks sent to ${person(w.who).name.split(" ")[0]}`); });
act("wishThankAll", () => { S.myWishes.list.forEach((w) => (w.thanked = true)); save(); rerender(); try { navigator.vibrate?.(12); } catch {} toast(`Thanks sent to ${plural(S.myWishes.list.length, "colleague")} 🙏`); });
act("wishReply", (b) => {
  const w = S.myWishes.list.find((x) => x.id === b.dataset.id), first = person(w.who).name.split(" ")[0];
  const s = openSheet({ title: `Reply to ${esc(first)}`, body: `<textarea class="inp" data-r rows="3" maxlength="240">Thank you ${esc(first)}! 😊</textarea>`, foot: `<button class="btn primary block" data-s="ok">Send reply</button>`,
    onMount(el) { onS(el, { ok() { const v = el.querySelector("[data-r]").value.trim(); if (v.length < 2) return toast("Write a short reply first", "bad"); w.reply = v; w.thanked = true; save(); closeSheet(s); rerender(); toast(`Reply sent to ${first}`); } }); } });
});

// ── a colleague's wishes wall (what they see) — added to their profile ──
function celebFor(id) { return (typeof celebrations === "function" ? celebrations() : []).find((c) => c.id === id); }
function wishesWall(id) {
  const c = celebFor(id), p = person(id), first = p.name.split(" ")[0];
  if (!c) return emptyState(["award", "sparkles"], "No celebration right now", `${esc(first)}’s birthday and work-anniversary wishes show up here.`);
  const mine = S.wishes?.[wishKey(c)], idx = celebrations().findIndex((x) => x.id === c.id && x.kind === c.kind);
  const list = wallWishes(id, c.kind, c.date);
  const when = c.date === D.today() ? "today" : D.diff(D.today(), c.date) === 1 ? "tomorrow" : D.nice(c.date);
  return `<div class="wish-hero sm"><span class="wh-ic">${I(c.kind === "birthday" ? "cake" : "award")}</span>
      <h1>${c.kind === "birthday" ? `${esc(first)}’s birthday` : `${esc(first)}’s ${c.years}-year anniversary`} ${when === "today" ? "is today" : `· ${when}`}</h1>
      <p>${list.length + (mine ? 1 : 0)} ${list.length + (mine ? 1 : 0) === 1 ? "wish" : "wishes"} on ${esc(first)}’s wall${c.date > D.today() ? " — they’ll see them on the day" : ""}</p></div>
    ${mine ? "" : `<button class="btn primary block" style="margin-top:12px" data-act="celebWish" data-i="${idx}">${I(c.kind === "birthday" ? "cake" : "award")}${c.kind === "birthday" ? "Send birthday wishes" : "Congratulate"}</button>`}
    <div class="stack" style="margin-top:12px">
      ${mine ? `<div class="card wish-card mine"><div class="hrow">${avatar("me")}<span class="grow" style="min-width:0"><b style="display:block">You</b><span class="tiny muted">Sent · ${esc(first)} sees this ${c.date > D.today() ? "on the day" : "on their wall"}</span></span><span class="wish-sent">${I("checkCircle")}Sent</span></div><p>${esc(mine)}</p></div>` : ""}
      ${list.map((w) => `<div class="card wish-card"><div class="hrow">${avatar(w.who)}<span class="grow" style="min-width:0"><b class="ell" style="display:block">${esc(person(w.who).name)}</b></span></div><p>${esc(w.text)}</p></div>`).join("")}
    </div>`;
}

// ── alert detail for notifications without their own screen ──
const ntTitle = (n) => (n.html.match(/[“"]([^”"]+)[”"]/) || n.html.match(/<b>‘?([^<’]+)’?<\/b>[^<]*$/) || [, ""])[1];
route("alert/:id", ({ id }) => {
  const n = S.notifs.find((x) => x.id === id);
  if (!n) return `<div class="screen">${topbar("Alert")}${emptyState(["bell"], "Alert not found", "It may have been archived.", `<button class="btn primary" data-go="#/notifs">All alerts</button>`)}</div>`;
  const who = n.who ? person(n.who) : null, first = who?.name.split(" ")[0] || "", title = ntTitle(n);
  let body = "", foot = "";
  if (n.kind === "mention" || n.kind === "comment") {
    n.thread ||= [
      ...(n.kind === "comment" ? [{ who: "me", text: `Shared the latest draft of ${title}.`, ts: n.ts - 5 * 36e5 }] : [{ who: "pr", text: `Agenda for ${title} is up — add your items.`, ts: n.ts - 3 * 36e5 }]),
      { who: n.who, text: n.quote || "", ts: n.ts },
    ];
    body = `<div class="nt-ctx"><span class="kc-ic tint ${n.kind === "mention" ? "t-blue" : "t-violet"}">${I("msg")}</span><span class="grow" style="min-width:0"><small>${n.kind === "mention" ? "You were mentioned in" : "New comment on"}</small><b class="ell">${esc(title || "a conversation")}</b></span></div>
      <div class="nt-thread">${n.thread.map((m) => `<div class="nt-msg ${m.who === "me" ? "me" : ""}">${m.who === "me" ? "" : avatar(m.who, "sm")}<div class="nt-bub"><b>${esc(m.who === "me" ? "You" : person(m.who).name)}</b><p>${esc(m.text).replace(/@?(you)\b/i, "<mark>$1</mark>")}</p><small>${D.ago(m.ts)} ago</small></div></div>`).join("")}</div>`;
    foot = `<form class="nt-reply" data-form="ntReply" data-id="${n.id}"><input class="inp" name="r" maxlength="300" placeholder="Reply to ${esc(first)}…" enterkeyhint="send" autocomplete="off"><button class="ksend" type="submit" aria-label="Send reply">${I("send")}</button></form>`;
  } else if (n.kind === "task") {
    const res = n.resolved;
    body = `<div class="card nt-task"><span class="tiny muted">Task invite from ${esc(who?.name || "a teammate")}</span><h2>${esc(title || "New task")}</h2>
        <div class="kv"><span>Project</span><span>Design system – KEBS Lite 2.0</span></div><div class="kv"><span>Invited by</span><span class="hrow" style="gap:6px">${n.who ? avatar(n.who, "xs") : ""}${esc(who?.name || "—")}</span></div><div class="kv"><span>Suggested due</span><span>${D.long(D.add(D.today(), 4))}</span></div></div>
      ${res ? `<div class="banner ${res === "accepted" ? "ok" : "info"}">${I(res === "accepted" ? "checkCircle" : "info")}You ${res} this invite${n.reason ? ` · “${esc(n.reason)}”` : ""}.</div>` : `<p class="small muted" style="margin:4px 2px">Accepting adds it to My tasks and lets ${esc(first)} know.</p>`}`;
    foot = res === "accepted" && n.taskId ? `<button class="btn primary block" data-go="#/projects/p2/task/${n.taskId}">Open the task</button>` : res ? "" : `<div class="row-btns"><button class="btn outline" style="flex:1" data-act="ntDecline" data-id="${n.id}">Decline</button><button class="btn primary" style="flex:1" data-act="ntAccept" data-id="${n.id}">Accept</button></div>`;
  } else if (n.kind === "leave") {
    const theirs = pjList().flatMap((p) => p.tasks.filter((t) => t.assignee === n.who && t.status !== "done" && p.team.includes("me")).map((t) => ({ p, t })));
    body = `<button class="card hrow nt-person" data-go="#/people/${n.who}">${avatar(n.who, "lg")}<span class="grow" style="min-width:0"><b style="display:block">${esc(who.name)}</b><span class="small muted">${esc(who.role)} · On leave ${D.nice(D.add(D.today(), 1))}</span></span>${I("chevR")}</button>
      <div class="sec"><h2>Their open tasks on your projects</h2></div>
      ${theirs.length ? `<div class="tk-list">${theirs.map((x) => tkRow(x.p, x.t)).join("")}</div>` : emptyMini("checkCircle", `${esc(first)} has nothing open on your projects — no cover needed.`)}`;
  } else {
    body = `<div class="card"><div class="txt">${n.html}</div>${n.quote ? `<div class="quote" style="margin-top:8px">“${esc(n.quote)}”</div>` : ""}<span class="tiny faint">${D.ago(n.ts)} ago</span></div>`;
  }
  return `<div class="screen ${foot ? "has-foot" : ""}">${topbar(PI_KIND[n.kind]?.label || "Alert", { sub: who ? who.name : "" })}<div class="scroll"><div class="stack" style="padding-top:6px">${body}</div></div>${foot ? `<div class="foot">${foot}</div>` : ""}</div>`;
}, { parent: "#/notifs", mount() { const th = $(".screen .scroll"); if (th && $(".nt-thread")) th.scrollTop = th.scrollHeight; } });
act("submit:ntReply", (f) => {
  const n = S.notifs.find((x) => x.id === f.dataset.id), v = f.r.value.trim();
  if (v.length < 2) return toast("Write a reply first", "bad");
  if (!navigator.onLine) return toast("You’re offline — your reply wasn’t sent. Try again when you’re back online.", "bad");
  n.thread.push({ who: "me", text: v, ts: Date.now() }); f.r.value = ""; save(); rerender(); toast(`Reply sent to ${person(n.who).name.split(" ")[0]}`);
});
act("ntAccept", (b) => {
  const n = S.notifs.find((x) => x.id === b.dataset.id), p = S.pj?.p2, title = ntTitle(n) || "New task";
  if (p) { const tp = PROJECTS.find((x) => x.id === "p2"), ti = tp ? tp.tasks.push(title) - 1 : null;
    const t = { id: uid(), ti, title, assignee: "me", status: "todo", priority: "med", due: D.add(D.today(), 4), est: 6, desc: `Invited by ${person(n.who).name}.`, comments: [], created: Date.now() };
    p.tasks.push(t); n.taskId = t.id; }
  n.resolved = "accepted"; n.read = true; save(); rerender(); try { navigator.vibrate?.(12); } catch {}
  actionToast("Added to My tasks", "Open", () => go(`#/projects/p2/task/${n.taskId}`));
});
act("ntDecline", (b) => {
  const n = S.notifs.find((x) => x.id === b.dataset.id);
  const s = openSheet({ title: "Decline invite", body: `<div class="choices" data-why>${["Too much on my plate", "Not the right person", "Need more details"].map((r, i) => `<button class="choice ${i === 0 ? "on" : ""}" data-s="why" data-v="${r}">${r}</button>`).join("")}</div>`, foot: `<button class="btn danger block" data-s="ok">Decline</button>`,
    onMount(el) { let why = "Too much on my plate"; onS(el, { why(x) { why = x.dataset.v; el.querySelectorAll(".choice").forEach((c) => c.classList.toggle("on", c === x)); }, ok() { n.resolved = "declined"; n.reason = why; n.read = true; save(); closeSheet(s); rerender(); toast(`${person(n.who).name.split(" ")[0]} has been told`); } }); } });
});
