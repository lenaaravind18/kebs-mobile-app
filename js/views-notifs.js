// Priority Inbox — AI-sorted notifications (Urgent · Important · Others), anchor tabs with counts,
// Priority / Newest sorting, swipe right = archive, swipe left = read/unread, move between categories,
// enhanced cards with chips, 3-step onboarding. Based on the KEBS "Priority Inbox" case study.

const PI_CATS = [
  { id: "urgent", name: "Urgent", tint: "t-red", hint: "Needs action soon" },
  { id: "important", name: "Important", tint: "t-amber", hint: "Worth a look today" },
  { id: "others", name: "Others", tint: "t-slate", hint: "FYI updates" },
];
const PI_KIND = {
  task: { label: "Task invite", icon: "users" }, mention: { label: "Mention", icon: "msg" }, comment: { label: "Comment", icon: "msg" },
  assign: { label: "Task", icon: "clipboard" }, reject: { label: "Timesheet", icon: "calendar" }, approve: { label: "Approval", icon: "checkCircle" },
  announce: { label: "Announcement", icon: "megaphone" }, reminder: { label: "Reminder", icon: "clock" }, leave: { label: "Leave", icon: "calendar" },
};
let PI_SORT = "priority";

// one-time extra sample notifications so every category has content
(function piSeed() {
  if (S.piSeeded) return;
  const now = Date.now(), H = 36e5;
  S.notifs.push(
    { id: uid(), kind: "reminder", html: "Your timesheet for <b>this week</b> is due on <b>Friday</b>. 2 days are still empty.", ts: now - 40 * 60e3, read: false, go: "#/ts" },
    { id: uid(), kind: "approve", who: "pr", html: "<b>Prasanna R</b> approved your <b>regularization request</b>.", ts: now - 26 * H, read: true, go: "#/requests" },
    { id: uid(), kind: "announce", who: "vj", html: "<b>Vijay Kumar</b> posted <b>New hybrid-work guidelines</b>.", ts: now - 30 * H, read: true, go: "#/announcements" },
    { id: uid(), kind: "leave", who: "jre", html: "<b>Jack Reacher</b> is on leave tomorrow. Reassign anything urgent.", ts: now - 3 * H, read: false },
  );
  S.piSeeded = true; save();
})();

// "Kais" categorisation: rule-based stand-in for the prompt, with a reason shown on each card
function piClassify(n) {
  if (n.cat) return { cat: n.cat, why: "Moved by you" };
  const txt = (n.html + " " + (n.quote || "")).toLowerCase();
  if (n.actionable && !n.resolved) return { cat: "urgent", why: "Waiting on your response" };
  if (n.kind === "reject") return { cat: "urgent", why: "Rejected — resubmit to get paid on time" };
  if (/due|deadline|today|friday|asap/.test(txt) && n.kind !== "announce") return { cat: "urgent", why: "Has a deadline this week" };
  if (n.kind === "mention" && /input|need|review|share/.test(txt)) return { cat: "urgent", why: "Someone needs your input" };
  if (n.kind === "mention" || n.kind === "comment") return { cat: "important", why: "Conversation about your work" };
  if (n.kind === "leave" || n.kind === "assign") return { cat: "important", why: "Affects your plans" };
  return { cat: "others", why: "Update for your information" };
}
function piChips(n, c) {
  const k = PI_KIND[n.kind] || { label: "Update", icon: "bell" };
  const chips = [`<span class="chip">${I(k.icon)}${k.label}</span>`];
  if (n.actionable && !n.resolved) chips.push(`<span class="chip bad">Action required</span>`);
  if (n.resolved) chips.push(`<span class="chip ${n.resolved === "accepted" ? "ok" : ""}">${esc(n.resolved)}</span>`);
  if (/due|friday/i.test(n.html)) chips.push(`<span class="chip warn">${I("clock")}Due Fri</span>`);
  if (n.kind === "reject") chips.push(`<span class="chip bad">Rejected</span>`);
  if (n.kind === "approve") chips.push(`<span class="chip ok">Approved</span>`);
  return chips.join("");
}
function piCard(n) {
  const c = piClassify(n), cat = PI_CATS.find((x) => x.id === c.cat);
  const icon = PI_KIND[n.kind]?.icon || "bell";
  return `<div class="sw" data-sw="${n.id}">
    <div class="sw-bg"><span class="l">${I("archive")}Archive</span><span class="r">${I(n.read ? "bell" : "check")}${n.read ? "Mark unread" : "Mark read"}</span></div>
    <div class="sw-fg ${cat.tint} ${n.read ? "" : "unread"}" data-act="piOpen" data-id="${n.id}">
      <div style="position:relative;flex:none">${n.who ? avatar(n.who) : `<span class="av ic3d ${cat.tint}" style="border-radius:13px">${I(icon)}</span>`}${n.kind === "mention" ? `<span class="badge-ic">${I("msg")}</span>` : ""}</div>
      <div class="grow" style="min-width:0">
        <div class="hrow" style="align-items:flex-start"><div class="txt grow">${n.html}</div><span class="tiny faint" style="white-space:nowrap">${D.ago(n.ts)}${n.read ? "" : `<span class="udot" aria-label="Unread"></span>`}</span></div>
        ${n.quote ? `<div class="quote">“${esc(n.quote)}”</div>` : ""}
        <div class="pi-chips">${piChips(n, c)}</div>
        ${n.actionable && !n.resolved ? `<div class="hrow" style="margin-top:10px"><button class="btn primary sm" data-act="ntResolve" data-id="${n.id}" data-v="accepted">Accept</button><button class="btn outline sm" data-act="ntResolve" data-id="${n.id}" data-v="declined">Decline</button></div>` : ""}
        ${PI_SORT === "priority" ? `<div class="pi-why">${I("sparkles")}${esc(c.why)}</div>` : ""}
      </div>
      <button class="ib sm" style="align-self:flex-start;margin:-4px -6px 0 0" data-act="piMenu" data-id="${n.id}" aria-label="More options">${I("dots")}</button>
    </div></div>`;
}

route("notifs", () => {
  const list = S.notifs.filter((n) => !n.archived).sort((a, b) => b.ts - a.ts);
  const groups = PI_CATS.map((c) => ({ ...c, items: list.filter((n) => piClassify(n).cat === c.id) }));
  const archived = S.notifs.filter((n) => n.archived).length;
  let body;
  if (!list.length) body = emptyState(["bell", "checkCircle", "sparkles"], "Inbox clear", "You’re all caught up. New notifications land here, sorted by priority.");
  else if (PI_SORT === "priority") body = groups.map((g) => `<div class="pi-sec ${g.tint}" id="pi-${g.id}"><span class="dot"></span><h2>${g.name}</h2><small>${g.items.length}</small><span class="ai">${I("sparkles")}Sorted by Kais</span></div>
      ${g.items.map(piCard).join("") || emptyMini(g.id === "urgent" ? "checkCircle" : "bell", g.id === "urgent" ? "Nothing urgent — nice work." : "Nothing in this group right now.")}`).join("");
  else body = `<div style="height:8px"></div><div data-lazy="6">${list.map(piCard).join("")}</div>`;
  return `<div class="screen">
    <div class="big-title hrow" style="align-items:flex-start"><div class="grow"><h1>Notifications</h1><p>${unreadCount() ? `${unreadCount()} unread` : "All read"} · swipe to clear</p></div><button class="ib" data-act="piMore" aria-label="More options">${I("dots")}</button></div>
    <div class="pi-bar"><div class="pi-sort" role="tablist" aria-label="Sort"><button class="${PI_SORT === "priority" ? "on" : ""}" data-act="piSort" data-v="priority">${I("sparkles")} Priority</button><button class="${PI_SORT === "newest" ? "on" : ""}" data-act="piSort" data-v="newest">Newest</button></div></div>
    ${PI_SORT === "priority" ? `<div class="pi-bar"><div class="pi-anchors">${groups.map((g) => `<button class="${g.tint}" data-act="piJump" data-c="${g.id}">${g.name}<span class="n">${g.items.length}</span></button>`).join("")}</div></div>` : ""}
    <div class="scroll" data-pi>${body}${archived ? `<button class="link" style="display:block;margin:16px auto 0" data-act="piArchived">${I("archive")} Archived (${archived})</button>` : ""}</div></div>`;
}, {
  dock: "notifs",
  mount() {
    // swipe gestures: right = archive, left = toggle read
    $$("[data-sw]").forEach((sw) => {
      const fg = sw.querySelector(".sw-fg"); let x0 = null, dx = 0, moved = false;
      fg.addEventListener("pointerdown", (e) => { if (e.target.closest("button")) return; x0 = e.clientX; dx = 0; moved = false; fg.setPointerCapture(e.pointerId); fg.classList.add("drag"); });
      fg.addEventListener("pointermove", (e) => {
        if (x0 === null) return; dx = (e.clientX - x0) / ZOOM; if (Math.abs(dx) > 6) moved = true;
        fg.style.transform = `translateX(${dx}px)`; sw.classList.toggle("go-r", dx > 0); sw.classList.toggle("go-l", dx < 0);
      });
      const end = () => {
        if (x0 === null) return; x0 = null; fg.classList.remove("drag");
        const id = sw.dataset.sw, w = sw.offsetWidth;
        if (dx > w * 0.32) { fg.style.transform = `translateX(${w}px)`; setTimeout(() => piArchive(id), 180); }
        else if (dx < -w * 0.32) { fg.style.transform = ""; piToggleRead(id); }
        else fg.style.transform = "";
        if (moved) fg.dataset.justSwiped = "1";
      };
      fg.addEventListener("pointerup", end); fg.addEventListener("pointercancel", end);
    });
    // scroll spy: highlight the anchor tab for the section in view
    const sc = $("[data-pi]"), tabs = $$(".pi-anchors button");
    const spy = () => {
      if (!sc || !tabs.length) return;
      let cur = "urgent";
      for (const c of ["urgent", "important", "others"]) { const el = document.getElementById("pi-" + c); if (el && el.offsetTop - sc.offsetTop - sc.scrollTop <= 24) cur = c; }
      tabs.forEach((t) => t.classList.toggle("on", t.dataset.c === cur));
    };
    sc?.addEventListener("scroll", spy, { passive: true }); spy();
    if (!S.piOnboarded) setTimeout(piOnboarding, 350);
  },
});

function toastUndo(msg, undo) {
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `${I("checkCircle")}<span>${esc(msg)}</span><button style="pointer-events:auto;margin-left:6px;color:var(--accent);font-weight:700">Undo</button>`;
  t.querySelector("button").onclick = () => { undo(); t.remove(); };
  $("#toasts").append(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 260); }, 4000);
}
function piArchive(id) {
  const n = S.notifs.find((x) => x.id === id); if (!n) return;
  n.archived = true; n.read = true; save(); rerender();
  toastUndo("Archived", () => { n.archived = false; save(); rerender(); });
}
function piToggleRead(id) { const n = S.notifs.find((x) => x.id === id); n.read = !n.read; save(); rerender(); toast(n.read ? "Marked as read" : "Marked as unread", "info"); }

act("piOpen", (b, e) => {
  if (b.dataset.justSwiped) { delete b.dataset.justSwiped; return; }
  if (e.target.closest("button")) return;
  const n = S.notifs.find((x) => x.id === b.dataset.id); n.read = true; save();
  if (n.go) go(n.go); else rerender();
});
act("ntResolve", (b) => { const n = S.notifs.find((x) => x.id === b.dataset.id); n.resolved = b.dataset.v; n.read = true; save(); rerender(); toast(`Invite ${b.dataset.v}`); });
act("piSort", (b) => { PI_SORT = b.dataset.v; rerender(); });
act("piJump", (b) => { const el = document.getElementById("pi-" + b.dataset.c); const sc = $("[data-pi]"); if (el && sc) sc.scrollTo({ top: el.offsetTop - sc.offsetTop - 4, behavior: "smooth" }); });
act("piMenu", (b) => {
  const n = S.notifs.find((x) => x.id === b.dataset.id), cur = piClassify(n).cat;
  const s = openSheet({
    title: "Notification",
    body: `<span class="eyebrow">Move to</span><div class="choices" style="margin:8px 0 14px">${PI_CATS.map((c) => `<button class="choice ${c.id === cur ? "on" : ""}" data-s="move" data-c="${c.id}">${c.name}</button>`).join("")}</div>
      <p class="tiny faint" style="margin:-6px 0 12px">Moving a notification teaches Kais what matters to you.</p>
      <div class="list"><button class="li" data-s="read"><span class="ic tint t-blue">${I(n.read ? "bell" : "check")}</span><span class="t grow">Mark as ${n.read ? "unread" : "read"}</span></button>
      <button class="li" data-s="arch"><span class="ic tint t-green">${I("archive")}</span><span class="t grow">Archive</span></button>
      ${n.cat ? `<button class="li" data-s="reset"><span class="ic tint t-violet">${I("sparkles")}</span><span class="t grow">Let Kais decide again</span></button>` : ""}
      <button class="li" data-s="del"><span class="ic tint t-red">${I("trash")}</span><span class="t grow" style="color:var(--danger)">Delete</span></button></div>`,
    onMount(el) {
      onS(el, {
        move(x) { n.cat = x.dataset.c; save(); closeSheet(s); rerender(); toast(`Moved to ${PI_CATS.find((c) => c.id === n.cat).name}`); },
        read() { closeSheet(s); piToggleRead(n.id); },
        arch() { closeSheet(s); piArchive(n.id); },
        reset() { delete n.cat; save(); closeSheet(s); rerender(); },
        del() { S.notifs = S.notifs.filter((x) => x !== n); save(); closeSheet(s); rerender(); toast("Deleted"); },
      });
    },
  });
});
act("piMore", () => {
  const s = openSheet({ title: "Notifications", body: `<div class="list">
    <button class="li" data-s="all"><span class="ic tint t-blue">${I("check")}</span><span class="t grow">Mark all as read</span></button>
    <button class="li" data-s="arch"><span class="ic tint t-green">${I("archive")}</span><span class="t grow">Archive all read</span></button>
    <button class="li" data-s="intro"><span class="ic tint t-violet">${I("sparkles")}</span><span class="t grow">How Priority Inbox works</span></button></div>`,
    onMount(el) { onS(el, {
      all() { S.notifs.forEach((n) => (n.read = true)); save(); closeSheet(s); rerender(); toast("All caught up"); },
      arch() { const r = S.notifs.filter((n) => n.read && !n.archived); r.forEach((n) => (n.archived = true)); save(); closeSheet(s); rerender(); toastUndo(`Archived ${r.length}`, () => { r.forEach((n) => (n.archived = false)); save(); rerender(); }); },
      intro() { closeSheet(s); setTimeout(piOnboarding, 250); },
    }); } });
});
act("piArchived", () => {
  const list = S.notifs.filter((n) => n.archived);
  const s = openSheet({ title: `Archived (${list.length})`, body: `<div class="list">${list.map((n) => `<div class="li"><span class="grow small">${n.html}</span><button class="btn ghost sm" data-s="restore" data-id="${n.id}">Restore</button></div>`).join("")}</div>`,
    onMount(el) { onS(el, { restore(x) { S.notifs.find((n) => n.id === x.dataset.id).archived = false; save(); closeSheet(s); rerender(); toast("Restored"); } }); } });
});

// 3-step onboarding: the inbox, swipe gestures, sorting modes
function piOnboarding() {
  let step = 0;
  const steps = [
    { art: `<div class="stack s6" style="width:80%">${PI_CATS.map((c) => `<div class="onb-demo ${c.tint}"><span class="dot" style="width:9px;height:9px;border-radius:50%;background:var(--t)"></span>${c.name}<span class="grow"></span><span class="tiny muted">${c.hint}</span></div>`).join("")}</div>`,
      t: "Meet your Priority Inbox", p: "Kais sorts every notification into Urgent, Important and Others, so you decide instead of scanning." },
    { art: `<div class="onb-demo swipe">${I("bell")}Swipe me<span class="grow"></span>${I("chevR")}</div>`, t: "Swipe to clear", p: "Swipe right to archive. Swipe left to mark as read or unread. Clear items as you finish them." },
    { art: `<div class="pi-sort" style="transform:scale(1.3)"><button class="on">${I("sparkles")} Priority</button><button>Newest</button></div>`, t: "Priority or newest", p: "Switch between Priority and Newest sorting any time. Move a card to another group to teach Kais what matters." },
  ];
  const s = openSheet({
    title: "", body: `<div data-onb></div>`, foot: `<div class="row-btns"><button class="btn ghost" data-s="skip">Skip</button><button class="btn primary" data-s="next">Next</button></div>`,
    onClose() { S.piOnboarded = true; save(); },
    onMount(el) {
      const draw = () => {
        const st = steps[step];
        el.querySelector("[data-onb]").innerHTML = `<div class="onb"><div class="onb-art">${st.art}</div><h3>${st.t}</h3><p>${st.p}</p><div class="onb-dots">${steps.map((_, i) => `<i class="${i === step ? "on" : ""}"></i>`).join("")}</div></div>`;
        el.querySelector("[data-s=next]").textContent = step === steps.length - 1 ? "Got it" : "Next";
      };
      onS(el, { skip() { closeSheet(s); }, next() { if (step < steps.length - 1) { step++; draw(); } else closeSheet(s); } });
      draw();
    },
  });
}
