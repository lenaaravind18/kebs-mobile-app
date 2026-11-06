// Project team chat: messages, replies, emoji reactions, photo/file attachments and @mentions.
// Data: S.pjChat = { [pid]: { msgs: [{ id, who, text, ts, files?, react?, reply?, failed? }], read } }.
// Teammates are simulated: when you post, someone on the team (or whoever you @mention) types a reply.

const PC_EMOJI = ["👍", "❤️", "😂", "🎉", "👀", "🙏"];
const PC = { pid: null, files: [], reply: null, edit: null, typing: null, draft: {}, below: 0 };
// sender name colours inside group bubbles (calm, readable in light and dark)
const PC_NAME_TINT = { "t-blue": "#3b82f6", "t-violet": "#8b5cf6", "t-green": "#16a34a", "t-teal": "#0d9488", "t-amber": "#d97706", "t-pink": "#db2777", "t-red": "#e5484d", "t-orange": "#ea580c", "t-slate": "#64748b" };
const PC_TICK1 =`<svg viewBox="0 0 16 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m2.5 6.5 3 3 6-7"/></svg>`;
const PC_TICK2 = `<svg viewBox="0 0 20 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m1.5 6.5 3 3 6-7"/><path d="m8.5 9.5 6-7"/></svg>`;
// Apple-style emoji images (emoji-datasource-apple); falls back to the system emoji if an image is missing
const EMO_CDN = "https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.1.2/img/apple/64/";
const EMO_RE = /(?:\p{Regional_Indicator}{2}|\p{Extended_Pictographic}(?:️|[\u{1F3FB}-\u{1F3FF}])?(?:‍\p{Extended_Pictographic}(?:️|[\u{1F3FB}-\u{1F3FF}])?)*)/gu;
const emoCode = (e) => [...e].map((c) => c.codePointAt(0).toString(16)).join("-");
function emoImg(e) { const code = emoCode(e); return `<img class="emo" src="${EMO_CDN}${code}.png" alt="${e}" draggable="false" data-c="${code}" onerror="emoErr(this)">`; }
function emoErr(img) {
  const c = img.dataset.c;
  if (c.includes("-fe0f")) { img.dataset.c = c.replace(/-fe0f/g, ""); img.src = EMO_CDN + img.dataset.c + ".png"; }
  else if (!img.dataset.t) { img.dataset.t = 1; img.dataset.c = c + "-fe0f"; img.src = EMO_CDN + img.dataset.c + ".png"; }
  else img.replaceWith(document.createTextNode(img.alt));
}
const emoText = (html) => html.replace(EMO_RE, (e) => emoImg(e));

function seedChat() {
  const now = Date.now(), h = 36e5, me = (S.me.display || "you").split(" ")[0];
  const M = (who, ago, text, o = {}) => ({ id: uid(), who, ts: now - ago, text, ...o });
  const C = {
    p1: [M("jh", 50 * h, "Morning all — the beta build for the Zifo pilot goes out Thursday. Please flag any blockers here."),
      M("al", 49 * h, "Home screen API is about 80% done. Waiting on the token refresh endpoint."),
      M("pb", 26 * h, "Feedback from the pilot users 👇", { files: [{ name: "Zifo_pilot_feedback.pdf", size: "1.2 MB" }] }),
      M("rb", 25 * h, "Thanks Pam, I’ll go through the Android bits today.", { react: { "👍": ["jh", "al"] } }),
      M("jh", 3 * h, `@${me} can you share the accessibility test results before standup tomorrow?`),
      M("al", 0.7 * h, "Pushed the fix for the login crash 🎉", { react: { "🎉": ["rb", "pb"] } })],
    p2: [M("sl", 30 * h, "Uploaded the icon audit sheet — 14 icons need new sizes.", { files: [{ name: "Icon_audit.xlsx", size: "86 KB" }] }),
      M("vi", 28 * h, "Dark mode contrast: 6 components fail AA. List is in the sheet.", { react: { "👀": ["as"] } }),
      M("as", 1.5 * h, `@${me} can we move the component audit review to Thursday?`)],
    p3: [M("rb", 52 * h, "Handover is in 10 days. Let’s close the refactor review this week."),
      M("dr", 27 * h, "Sales demo build works great on the Pixel 7 ✅", { react: { "🎉": ["rb", "me"] } }),
      M("ww", 6 * h, "Client asked for an extra report export — park it for phase 2?"),
      M("rb", 5 * h, "Yes, phase 2. I’ll note it in the handover doc.")],
    p4: [M("jh", 120 * h, "Pausing this until the finance API is ready. Keep notes here so we can pick up quickly.")],
    p5: [M("sj", 20 * h, "Team lunch on Friday at 1 PM 🍕 React with 👍 if you’re in!", { react: { "👍": ["vj", "pr"] } })],
    p6: [M("vj", 30 * 24 * h, "The site is live! Great work everyone 🎉", { react: { "🎉": ["sl", "me"], "❤️": ["sl"] } }),
      M("sl", 30 * 24 * h - h, "Handover docs are in the shared drive.", { files: [{ name: "NextGen_handover.docx", size: "420 KB" }] })],
  };
  const out = {};
  Object.entries(C).forEach(([pid, msgs]) => { out[pid] = { msgs, read: pid === "p1" ? now - 4 * h : pid === "p2" ? now - 2 * h : now }; });
  return out;
}
if (!S.pjChat) { S.pjChat = seedChat(); save(); }
{ const base = resetDemo; resetDemo = function () { base(); S.pjChat = seedChat(); save(); }; }

const pcOf = (pid) => (S.pjChat[pid] ||= { msgs: [], read: Date.now() });
const pcUnread = (pid) => { const c = S.pjChat[pid]; return c ? c.msgs.filter((m) => m.who !== "me" && m.ts > c.read).length : 0; };
const pcFirst = (id) => (id === "me" ? "You" : person(id).name.split(" ")[0]);
const pcMyFirst = () => (S.me.display || fullName()).split(" ")[0];
const pcTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
function pcSnippet(m) {
  if (!m) return "No messages yet";
  const t = m.text ? m.text : m.files?.length ? `${m.files.some((f) => f.src) ? "📷 Photo" : "📎 " + m.files[0].name}` : "";
  return `${m.who === "me" ? "You: " : ""}${t}`;
}

// text → safe html with @mentions and links highlighted
function pcRich(text, p) {
  let s = esc(text || "");
  s = s.replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
  const names = [...p.team.map((id) => [id === "me" ? pcMyFirst() : pcFirst(id), id]), ["everyone", ""]];
  names.forEach(([n, id]) => {
    const mine = id === "me" || n === "everyone";
    s = s.replace(new RegExp(`@${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), `<b class="pc-at-tag${mine ? " me" : ""}"${id ? ` data-go="#/people/${id}" role="link"` : ""}>@${n}</b>`);
  });
  return emoText(s.replace(/\n/g, "<br>"));
}

function pcFilesHtml(m) {
  if (!m.files?.length) return "";
  const imgs = m.files.filter((f) => f.src), docs = m.files.filter((f) => !f.src);
  return `${imgs.length ? `<div class="pc-imgs n${Math.min(imgs.length, 4)}">${imgs.slice(0, 4).map((f, i) => `<button type="button" class="pc-img" data-act="pcView" data-m="${m.id}" data-i="${m.files.indexOf(f)}" aria-label="Open ${esc(f.name)}"><img src="${f.src}" alt="">${i === 3 && imgs.length > 4 ? `<span>+${imgs.length - 4}</span>` : ""}</button>`).join("")}</div>` : ""}
    ${docs.map((f) => `<button type="button" class="pc-doc" data-act="pcFile" data-m="${m.id}" data-i="${m.files.indexOf(f)}">${fileIcon(f.name)}<span class="grow" style="min-width:0"><b class="ell">${esc(f.name)}</b><small>${esc(f.size || "")}</small></span></button>`).join("")}`;
}

function pcThreadHtml(p) {
  const c = pcOf(p.id);
  if (!c.msgs.length) return `<div class="pc-empty">${emptyState(["msg"], "Start the conversation", `Share updates, files and ideas with the ${esc(pjName(p))} team. Type @ to mention someone.`)}</div>`;
  let out = "", lastDay = "", prev = null;
  c.msgs.forEach((m, i) => {
    const day = D.iso(m.ts);
    if (day !== lastDay) { out += `<div class="pc-day"><span>${D.diff(day, D.today()) < 2 ? dayLabel(day) : D.nice(day)}</span></div>`; lastDay = day; prev = null; }
    const next = c.msgs[i + 1];
    const cont = prev && prev.who === m.who && m.ts - prev.ts < 6e5;
    const endGroup = !next || next.who !== m.who || next.ts - m.ts >= 6e5 || D.iso(next.ts) !== day;
    const mine = m.who === "me", rq = m.reply && c.msgs.find((x) => x.id === m.reply);
    const rx = Object.entries(m.react || {}).filter(([, w]) => w.length);
    // seen = a teammate posted after it or reacted to it
    const seen = mine && (c.msgs.slice(i + 1).some((x) => x.who !== "me") || Object.values(m.react || {}).some((w) => w.some((x) => x !== "me")));
    const meta = `<span class="pc-bt${m.text ? "" : " solo"}">${m.edited ? "edited · " : ""}${pcTime(m.ts)}${mine ? `<i class="pc-tick${seen ? " seen" : ""}" aria-label="${seen ? "Seen" : "Sent"}">${seen ? PC_TICK2 : PC_TICK1}</i>` : ""}</span>`;
    out += `<div class="pc-msg ${mine ? "me" : ""} ${cont ? "cont" : ""}" data-id="${m.id}">
      <span class="pc-swr" aria-hidden="true">${I("reply")}</span>
      ${mine ? "" : endGroup ? avatar(m.who, "sm") : `<span class="pc-av-sp"></span>`}
      <div class="pc-col">
        <div class="pc-bub ${m.failed ? "failed" : ""}" data-m="${m.id}" tabindex="0" aria-label="Message from ${esc(pcFirst(m.who))}. Press and hold for reactions, swipe right to reply">
          ${!mine && !cont ? `<b class="pc-bn" style="color:${PC_NAME_TINT[person(m.who).tint] || "var(--accent)"}">${esc(person(m.who).name)}</b>` : ""}
          ${rq ? `<span class="pc-quote" data-act="pcJump" data-to="${rq.id}" role="button"><b>${esc(pcFirst(rq.who))}</b><span class="ell">${esc(pcSnippet({ ...rq, who: "" }))}</span></span>` : m.reply ? `<span class="pc-quote gone"><span class="ell">Original message was deleted</span></span>` : ""}
          ${pcFilesHtml(m)}
          ${m.text ? `<p>${pcRich(m.text, p)}${m.failed ? "" : meta}</p>` : m.failed ? "" : meta}
        </div>
        ${rx.length ? `<div class="pc-rxs">${rx.map(([e, w]) => `<button type="button" class="pc-rx ${w.includes("me") ? "on" : ""}" data-act="pcReact" data-m="${m.id}" data-e="${e}" aria-label="${e} by ${w.map(pcFirst).join(", ")}">${emoImg(e)}<span>${w.length}</span></button>`).join("")}</div>` : ""}
        ${m.failed ? `<button type="button" class="pc-fail" data-act="pcRetry" data-m="${m.id}">${I("alert")}Not sent · Tap to retry</button>` : ""}
      </div></div>`;
    prev = m;
  });
  if (PC.typing && PC.pid === p.id) out += `<div class="pc-msg"><span>${avatar(PC.typing, "sm")}</span><div class="pc-col"><div class="pc-bub pc-typing" aria-label="${esc(pcFirst(PC.typing))} is typing"><i></i><i></i><i></i></div></div></div>`;
  return out;
}

function pcCtxHtml() {
  const c = PC.pid && pcOf(PC.pid), rq = PC.reply && c?.msgs.find((m) => m.id === PC.reply), ed = PC.edit && c?.msgs.find((m) => m.id === PC.edit);
  if (ed) return `<div class="pc-replying">${I("edit")}<span class="grow" style="min-width:0"><small>Editing message</small><span class="ell">${esc(ed.text)}</span></span><button type="button" class="ib sm" data-act="pcNoEdit" aria-label="Cancel editing">${I("x")}</button></div>`;
  return `${rq ? `<div class="pc-replying">${I("reply")}<span class="grow" style="min-width:0"><small>Replying to ${esc(rq.who === "me" ? "yourself" : person(rq.who).name)}</small><span class="ell">${esc(pcSnippet({ ...rq, who: "" }))}</span></span><button type="button" class="ib sm" data-act="pcNoReply" aria-label="Cancel reply">${I("x")}</button></div>` : ""}
    ${PC.files.length ? `<div class="pc-tray">${PC.files.map((f, i) => `<div class="pc-tf">${f.src ? `<img src="${f.src}" alt="">` : fileIcon(f.name)}${f.src ? "" : `<span class="ell">${esc(f.name)}</span>`}<button type="button" data-act="pcUnfile" data-i="${i}" aria-label="Remove ${esc(f.name)}">${I("x")}</button></div>`).join("")}</div>` : ""}`;
}

route("projects/:id/chat", ({ id }) => {
  const p = pjOf(id);
  if (!p) return `<div class="screen">${topbar("Team chat")}${emptyState(["msg"], "Chat not found", "This project may have been removed.", `<button class="btn primary" data-go="#/projects">All projects</button>`)}</div>`;
  if (PC.pid !== id) { PC.pid = id; PC.files = []; PC.reply = null; PC.edit = null; PC.typing = null; PC.below = 0; }
  const closed = p.status === "done", nFiles = pcOf(id).msgs.reduce((a, m) => a + (m.files?.length || 0), 0);
  return `<div class="screen pc">
    ${topbar(esc(pjName(p)), { sub: `Team chat · ${plural(p.team.length, "member")}`, right: `<button class="ib" data-act="pcFiles" aria-label="Shared files">${I("clip")}${nFiles ? `<span class="pc-nb">${nFiles}</span>` : ""}</button>` })}
    <div class="pc-members"><span class="av-stack">${p.team.slice(0, 6).map((m) => avatar(m, "xs")).join("")}</span><span class="tiny muted ell">${p.team.map((m) => (m === "me" ? "You" : pcFirst(m))).join(", ")}</span></div>
    <div class="pc-wrap"><div class="scroll pc-thread" data-thread>${pcThreadHtml(p)}</div>
      <button type="button" class="pc-down" data-act="pcDown" aria-label="Jump to latest messages" hidden>${I("chevD")}<span class="pc-down-n" hidden></span></button></div>
    ${closed ? `<div class="pc-closed">${I("lock")}This project is closed — the chat is read-only.</div>` : `<form class="pc-compose" data-form="pcSend" data-p="${id}">
      <div data-ctx>${pcCtxHtml()}</div>
      <div class="pc-mention" data-mention hidden></div>
      <div class="pc-row">
        <button type="button" class="ib pc-plus" data-act="pcAttach" aria-label="Attach photos or files">${I("plus")}</button>
        <div class="pc-box"><textarea name="m" rows="1" maxlength="2000" placeholder="Message the team…" aria-label="Message" enterkeyhint="send">${esc(PC.draft[id] || "")}</textarea><button type="button" class="pc-atb" data-act="pcAt" aria-label="Mention someone">@</button></div>
        <button type="submit" class="ksend" aria-label="Send">${I("send")}</button>
      </div></form>`}
  </div>`;
}, {
  parent: ({ id }) => `#/projects/${id}`,
  mount({ id }) {
    const c = S.pjChat[id]; if (c) { c.read = Date.now(); save(); }
    pcScroll(true);
    const th = $("[data-thread]");
    if (th) {
      pcGestures(th, pjOf(id).status === "done");
      th.addEventListener("scroll", pcDownSync, { passive: true });
    }
    const ta = $(".pc-compose textarea"); if (!ta) return;
    const grow = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; };
    grow();
    ta.addEventListener("input", () => { PC.draft[id] = ta.value; grow(); pcMentionMenu(ta, id); });
    ta.addEventListener("keydown", (e) => {
      const menu = $("[data-mention]");
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        if (menu && !menu.hidden) { e.preventDefault(); menu.querySelector("button")?.click(); return; }
        e.preventDefault(); ta.form.requestSubmit();
      }
      if (e.key === "Escape" && menu && !menu.hidden) menu.hidden = true;
    });
    ta.addEventListener("click", () => pcMentionMenu(ta, id));
  },
});

function pcScroll(force) {
  const th = $("[data-thread]"); if (!th) return;
  const near = th.scrollHeight - th.scrollTop - th.clientHeight < 160;
  if (force || near) requestAnimationFrame(() => { th.scrollTop = th.scrollHeight; });
}
function pcRedraw(force, incoming) {
  const p = pjOf(PC.pid), th = $("[data-thread]");
  if (!p || !th || hpath(location.hash) !== `projects/${p.id}/chat`) return;
  const near = th.scrollHeight - th.scrollTop - th.clientHeight < 160, top = th.scrollTop;
  th.innerHTML = pcThreadHtml(p);
  th.scrollTop = top;
  const ctx = $("[data-ctx]"); if (ctx) ctx.innerHTML = pcCtxHtml();
  pcOf(p.id).read = Date.now(); save();
  if (incoming && !near && !force) PC.below++;
  pcScroll(force);
  pcDownSync();
}

// "jump to latest" button: shows when you've scrolled up, with a count of messages that came in meanwhile
function pcDownSync() {
  const th = $("[data-thread]"), b = $(".pc-down"); if (!th || !b) return;
  const far = th.scrollHeight - th.scrollTop - th.clientHeight > 240;
  if (!far) PC.below = 0;
  b.hidden = !far;
  const n = b.querySelector(".pc-down-n"); n.hidden = !PC.below; n.textContent = PC.below;
}
act("pcDown", () => { const th = $("[data-thread]"); PC.below = 0; th?.scrollTo({ top: th.scrollHeight, behavior: "smooth" }); });
act("pcJump", (b) => {
  const el = $(`.pc-msg[data-id="${b.dataset.to}"]`); if (!el) return;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
});

// gestures: swipe right to reply, press and hold for reactions, double-tap to ❤️
function pcGestures(th, closed) {
  let st = null, lastTap = { id: null, t: 0 };
  const reset = (msg) => { if (!msg) return; msg.classList.add("snap"); msg.style.removeProperty("--sx"); setTimeout(() => msg.classList.remove("snap", "swiping", "armed"), 220); };
  th.addEventListener("pointerdown", (e) => {
    const bub = e.target.closest(".pc-bub[data-m]"); if (!bub || e.button > 0) return;
    const msg = bub.closest(".pc-msg"), id = bub.dataset.m;
    st = { x: e.clientX, y: e.clientY, bub, msg, id, mode: null, armed: false,
      t: setTimeout(() => {
        if (!st || st.mode) return; st.mode = "hold";
        try { navigator.vibrate?.(14); } catch {}
        msg.classList.add("held"); setTimeout(() => msg.classList.remove("held"), 260);
        ACTIONS.pcMsg(bub);
      }, 430) };
  });
  th.addEventListener("pointermove", (e) => {
    if (!st) return;
    const dx = e.clientX - st.x, dy = e.clientY - st.y;
    if (!st.mode) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { clearTimeout(st.t); st = null; return; }
      if (dx > 12 && dx > Math.abs(dy) * 1.4 && !closed) { st.mode = "swipe"; clearTimeout(st.t); st.msg.classList.add("swiping"); try { th.setPointerCapture(e.pointerId); } catch {} }
      else if (Math.abs(dx) > 10) { clearTimeout(st.t); }
    }
    if (st?.mode === "swipe") {
      const d = Math.max(0, Math.min(84, dx < 64 ? dx : 64 + (dx - 64) * 0.3));
      st.msg.style.setProperty("--sx", d + "px");
      const armed = d >= 56;
      if (armed !== st.armed) { st.armed = armed; st.msg.classList.toggle("armed", armed); if (armed) try { navigator.vibrate?.(10); } catch {} }
    }
  });
  const end = (e, cancelled) => {
    if (!st) return;
    clearTimeout(st.t);
    const s = st; st = null;
    if (s.mode === "swipe") {
      reset(s.msg);
      if (s.armed && !cancelled) pcStartReply(s.id);
      return;
    }
    if (s.mode || cancelled) return;
    if (e.target.closest("a, .pc-img, .pc-doc, .pc-quote, .pc-at-tag")) return;
    const now = Date.now();
    if (!closed && lastTap.id === s.id && now - lastTap.t < 320) { lastTap = { id: null, t: 0 }; pcHeart(s.id, s.bub); }
    else lastTap = { id: s.id, t: now };
  };
  th.addEventListener("pointerup", (e) => end(e, false));
  th.addEventListener("pointercancel", (e) => end(e, true));
  th.addEventListener("contextmenu", (e) => { if (e.target.closest(".pc-bub[data-m]")) e.preventDefault(); });
  th.addEventListener("keydown", (e) => { const bub = e.target.closest(".pc-bub[data-m]"); if (bub && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); ACTIONS.pcMsg(bub); } });
}
function pcStartReply(id) {
  PC.reply = id; PC.edit = null;
  const ctx = $("[data-ctx]"); if (ctx) ctx.innerHTML = pcCtxHtml();
  $(".pc-compose textarea")?.focus();
}
function pcHeart(id, bub) {
  const m = pcOf(PC.pid).msgs.find((x) => x.id === id); if (!m) return;
  const had = m.react?.["❤️"]?.includes("me");
  if (!had) {
    const pop = document.createElement("span"); pop.className = "pc-pop"; pop.innerHTML = emoImg("❤️");
    bub.append(pop); setTimeout(() => pcToggleReact(m, "❤️"), 380);
  } else pcToggleReact(m, "❤️");
}

// @mention suggestions while typing
function pcMentionMenu(ta, pid) {
  const menu = $("[data-mention]"); if (!menu) return;
  const before = ta.value.slice(0, ta.selectionStart), m = before.match(/(^|\s)@(\w*)$/);
  if (!m) { menu.hidden = true; return; }
  const q = m[2].toLowerCase(), p = pjOf(pid);
  const opts = [...p.team.filter((x) => x !== "me").map((x) => ({ id: x, name: person(x).name, first: pcFirst(x), sub: person(x).role })), { id: "everyone", name: "everyone", first: "everyone", sub: `Notify all ${p.team.length - 1} teammates` }]
    .filter((o) => !q || o.name.toLowerCase().split(" ").some((w) => w.startsWith(q)));
  if (!opts.length) { menu.hidden = true; return; }
  menu.innerHTML = opts.map((o) => `<button type="button" data-v="${o.first}">${o.id === "everyone" ? `<span class="av sm pc-all">${I("users")}</span>` : avatar(o.id, "sm")}<span class="grow" style="min-width:0"><b class="ell">${esc(o.name)}</b><small class="ell">${esc(o.sub)}</small></span></button>`).join("");
  menu.hidden = false;
  menu.onclick = (e) => {
    const b = e.target.closest("button[data-v]"); if (!b) return;
    const start = ta.selectionStart - m[2].length - 1;
    ta.value = ta.value.slice(0, start) + "@" + b.dataset.v + " " + ta.value.slice(ta.selectionStart);
    const pos = start + b.dataset.v.length + 2; ta.setSelectionRange(pos, pos); ta.focus();
    PC.draft[pid] = ta.value; menu.hidden = true; ta.dispatchEvent(new Event("input"));
  };
}
act("pcAt", () => {
  const ta = $(".pc-compose textarea"); if (!ta) return;
  const pos = ta.selectionStart ?? ta.value.length, pre = ta.value.slice(0, pos), lead = pre && !/\s$/.test(pre) ? " " : "";
  ta.value = pre + lead + "@" + ta.value.slice(pos); const np = pos + lead.length + 1;
  ta.focus(); ta.setSelectionRange(np, np); ta.dispatchEvent(new Event("input"));
});

// attachments: photos are shrunk to a small JPEG so they fit in local storage
function pcShrink(file) {
  return new Promise((res) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, 560 / Math.max(img.width, img.height)), cv = document.createElement("canvas");
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
      res(cv.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); res(null); };
    img.src = url;
  });
}
function pcPick(accept, capture) {
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = accept; inp.multiple = !capture; if (capture) inp.capture = "environment";
  inp.onchange = async () => {
    const files = [...inp.files];
    if (PC.files.length + files.length > 6) toast("You can attach up to 6 files at a time", "bad");
    for (const f of files.slice(0, Math.max(0, 6 - PC.files.length))) {
      if (f.size > 25e6) { toast(`${f.name} is over 25 MB — share a link instead`, "bad"); continue; }
      const isImg = /^image\/(png|jpe?g|webp|gif)$/.test(f.type);
      const src = isImg ? await pcShrink(f) : null;
      if (isImg && !src) { toast(`Couldn’t read ${f.name}`, "bad"); continue; }
      PC.files.push({ name: f.name, size: fmtSize(f.size), ...(src ? { src } : {}) });
    }
    const ctx = $("[data-ctx]"); if (ctx) ctx.innerHTML = pcCtxHtml();
  };
  inp.click();
}
act("pcAttach", () => {
  const s = openSheet({ title: "Share with the team", body: `<div class="list">
      <button class="opt-row" data-s="photo"><span class="ic">${I("image")}</span><span class="grow"><span class="b">Photos</span><span class="small muted" style="display:block">From your gallery</span></span></button>
      <button class="opt-row" data-s="cam"><span class="ic">${I("scan")}</span><span class="grow"><span class="b">Camera</span><span class="small muted" style="display:block">Take a photo now</span></span></button>
      <button class="opt-row" data-s="file"><span class="ic">${I("file")}</span><span class="grow"><span class="b">Document</span><span class="small muted" style="display:block">PDF, Word, Excel, PowerPoint · up to 25 MB</span></span></button></div>`,
    onMount(el) { onS(el, {
      photo() { closeSheet(s); pcPick("image/*"); },
      cam() { closeSheet(s); pcPick("image/*", true); },
      file() { closeSheet(s); pcPick(".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.zip"); },
    }); } });
});
act("pcUnfile", (b) => { PC.files.splice(Number(b.dataset.i), 1); const ctx = $("[data-ctx]"); if (ctx) ctx.innerHTML = pcCtxHtml(); });
act("pcNoEdit", () => { PC.edit = null; const ta = $(".pc-compose textarea"); if (ta) { ta.value = ""; ta.dispatchEvent(new Event("input")); } const ctx = $("[data-ctx]"); if (ctx) ctx.innerHTML = pcCtxHtml(); });
act("pcNoReply", () => { PC.reply = null; const ctx = $("[data-ctx]"); if (ctx) ctx.innerHTML = pcCtxHtml(); });

// sending
act("submit:pcSend", (f) => {
  const pid = f.dataset.p, p = pjOf(pid), ta = f.m, text = ta.value.trim();
  if (PC.edit) {
    const em = pcOf(pid).msgs.find((x) => x.id === PC.edit); PC.edit = null;
    if (em && text && text !== em.text) { em.text = text; em.edited = true; save(); toast("Message edited"); }
    ta.value = ""; ta.style.height = "auto"; PC.draft[pid] = ""; pcRedraw(); return;
  }
  if (!text && !PC.files.length) { ta.focus(); return; }
  const m ={ id: uid(), who: "me", ts: Date.now(), text, ...(PC.files.length ? { files: PC.files } : {}), ...(PC.reply ? { reply: PC.reply } : {}) };
  if (!navigator.onLine) m.failed = true;
  const c = pcOf(pid); c.msgs.push(m);
  try { save(); } catch { c.msgs.pop(); return toast("Not enough space on this phone to keep these photos — try fewer", "bad"); }
  ta.value = ""; ta.style.height = "auto"; PC.draft[pid] = ""; PC.files = []; PC.reply = null;
  const menu = $("[data-mention]"); if (menu) menu.hidden = true;
  try { navigator.vibrate?.(8); } catch {}
  pcRedraw(true);
  if (m.failed) return toast("You’re offline — your message wasn’t sent", "bad");
  pcRespond(p, m);
});
act("pcRetry", (b) => {
  const c = pcOf(PC.pid), m = c.msgs.find((x) => x.id === b.dataset.m); if (!m) return;
  if (!navigator.onLine) return toast("Still offline — try again when you’re connected", "bad");
  delete m.failed; m.ts = Date.now(); c.msgs.splice(c.msgs.indexOf(m), 1); c.msgs.push(m); save(); pcRedraw(true); pcRespond(pjOf(PC.pid), m);
});

// a teammate answers (whoever you mentioned, otherwise someone on the team)
function pcRespond(p, m) {
  const others = p.team.filter((x) => x !== "me"); if (!others.length) return;
  const named = others.filter((x) => new RegExp(`@${pcFirst(x)}\\b`, "i").test(m.text || ""));
  const all = /@everyone\b/i.test(m.text || "");
  if (!named.length && !all && Math.random() < 0.35) return;
  const who = named[0] || others[Math.floor(Math.random() * others.length)];
  const t = (m.text || "").toLowerCase();
  const reply = m.files?.length ? (m.files.some((f) => f.src) ? "Got the photos, thanks! Looks good 👍" : `Thanks — I’ll go through ${m.files[0].name} today.`)
    : /\?$/.test(t) || /^(can|could|will|should|is|are|do|did|any)\b/.test(t) ? ["Checking now — will update you by end of day.", "Yes, that works for me 👍", "Give me 30 mins, I’ll confirm."][Math.floor(Math.random() * 3)]
    : /thank|thanks|great|awesome|nice/.test(t) ? "Anytime! 🙌"
    : all ? "Noted, thanks for the heads up." : ["Sounds good 👍", "On it.", "Makes sense — let’s go with that.", "Noted 👍"][Math.floor(Math.random() * 4)];
  setTimeout(() => {
    if (Math.random() < 0.5 || named.length) { (m.react ||= {})["👍"] = [...new Set([...(m.react["👍"] || []), who])]; save(); pcRedraw(); }
    PC.typing = who; if (PC.pid === p.id) pcRedraw();
    setTimeout(() => {
      PC.typing = null;
      const c = pcOf(p.id); c.msgs.push({ id: uid(), who, ts: Date.now(), text: reply, reply: named.length ? m.id : undefined });
      const here = hpath(location.hash) === `projects/${p.id}/chat`;
      if (here) c.read = Date.now();
      save(); pcRedraw(false, true);
      if (!here) actionToast(`${pcFirst(who)} replied in ${pjName(p)}`, "Open", () => go(`#/projects/${p.id}/chat`));
    }, 1600 + Math.random() * 1200);
  }, 900);
}

// message actions: react, reply, copy, delete
act("pcMsg", (b, e) => {
  if (e?.target.closest("a, .pc-img, .pc-doc")) return;
  const c = pcOf(PC.pid), m = c.msgs.find((x) => x.id === b.dataset.m); if (!m) return;
  const closed = pjOf(PC.pid)?.status === "done";
  const s = openSheet({ title: "", cls: "pc-sheet", body: `
    ${closed ? "" : `<div class="pc-emoji">${PC_EMOJI.map((e2) => `<button data-s="rx" data-e="${e2}" class="${m.react?.[e2]?.includes("me") ? "on" : ""}" aria-label="React ${e2}">${emoImg(e2)}</button>`).join("")}</div>`}
    <div class="pc-prev"><b>${esc(m.who === "me" ? "You" : person(m.who).name)}</b><span>${emoText(esc(pcSnippet({ ...m, who: "" })))}</span><small>${D.nice(D.iso(m.ts))} · ${pcTime(m.ts)}</small></div>
    ${Object.keys(m.react || {}).length ? `<div class="pc-who">${Object.entries(m.react).filter(([, w]) => w.length).map(([e2, w]) => `<span>${emoImg(e2)} ${w.map(pcFirst).join(", ")}</span>`).join("")}</div>` : ""}
    <div class="list">
      ${closed ? "" : `<button class="opt-row" data-s="reply"><span class="ic">${I("reply")}</span><span class="grow b">Reply</span></button>`}
      ${m.text ? `<button class="opt-row" data-s="copy"><span class="ic">${I("copy")}</span><span class="grow b">Copy text</span></button>` : ""}
      ${m.who === "me" && m.text && !m.failed && !closed ? `<button class="opt-row" data-s="edit"><span class="ic">${I("edit")}</span><span class="grow b">Edit message</span></button>` : ""}
      ${m.who === "me" && !closed ? `<button class="opt-row" data-s="del" style="color:var(--danger)"><span class="ic" style="color:var(--danger)">${I("trash")}</span><span class="grow b">Delete message</span></button>` : ""}
    </div>`,
    onMount(el) { onS(el, {
      rx(x) { closeSheet(s); pcToggleReact(m, x.dataset.e); },
      reply() { closeSheet(s); pcStartReply(m.id); },
      edit() {
        closeSheet(s); PC.edit = m.id; PC.reply = null;
        const ta = $(".pc-compose textarea"); if (!ta) return;
        ta.value = m.text; ta.dispatchEvent(new Event("input")); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
        const ctx = $("[data-ctx]"); if (ctx) ctx.innerHTML = pcCtxHtml();
      },
      copy() { closeSheet(s); navigator.clipboard?.writeText(m.text).then(() => toast("Copied"), () => toast("Couldn’t copy", "bad")); },
      del() {
        closeSheet(s); const i = c.msgs.indexOf(m); c.msgs.splice(i, 1); save(); pcRedraw();
        undoToast("Message deleted", () => { c.msgs.splice(i, 0, m); save(); pcRedraw(); });
      },
    }); } });
});
function pcToggleReact(m, e) {
  m.react ||= {}; const w = m.react[e] || [];
  m.react[e] = w.includes("me") ? w.filter((x) => x !== "me") : [...w, "me"];
  if (!m.react[e].length) delete m.react[e];
  save(); pcRedraw(); try { navigator.vibrate?.(8); } catch {}
}
act("pcReact", (b) => {
  if (pjOf(PC.pid)?.status === "done") return toast("This project is closed — reactions are off", "info");
  const m = pcOf(PC.pid).msgs.find((x) => x.id === b.dataset.m); if (m) pcToggleReact(m, b.dataset.e);
});

// files
function pcFileSheet(m, f) {
  const s = openSheet({ title: "", body: `<div class="pc-fsheet">${f.src ? `<img src="${f.src}" alt="${esc(f.name)}">` : fileIcon(f.name)}<b>${esc(f.name)}</b><span class="small muted">${esc(f.size || "")} · Shared by ${esc(m.who === "me" ? "you" : person(m.who).name)} · ${D.short(D.iso(m.ts))}</span></div>`,
    foot: `<button class="btn primary block" data-s="dl">${I("arrowDown")}Download</button>`,
    onMount(el) { onS(el, { dl() {
      if (f.src) { const a = document.createElement("a"); a.href = f.src; a.download = f.name.replace(/\.\w+$/, "") + ".jpg"; a.click(); }
      closeSheet(s); toast(f.src ? `Saved ${f.name}` : `${f.name} will download when it’s synced from the server`, f.src ? "ok" : "info");
    } }); } });
}
act("pcView", (b) => { const m = pcOf(PC.pid).msgs.find((x) => x.id === b.dataset.m); if (m) pcFileSheet(m, m.files[Number(b.dataset.i)]); });
act("pcFile", (b) => { const m = pcOf(PC.pid).msgs.find((x) => x.id === b.dataset.m); if (m) pcFileSheet(m, m.files[Number(b.dataset.i)]); });
act("pcFiles", () => {
  const c = pcOf(PC.pid), all = c.msgs.flatMap((m) => (m.files || []).map((f, i) => ({ m, f, i }))).reverse();
  const s = openSheet({ title: "Shared files", body: all.length ? `<div class="list">${all.map(({ m, f, i }) => `<button class="opt-row" data-s="open" data-m="${m.id}" data-i="${i}">${f.src ? `<img class="pc-fthumb" src="${f.src}" alt="">` : fileIcon(f.name)}<span class="grow" style="min-width:0"><span class="b ell" style="display:block">${esc(f.name)}</span><span class="small muted">${esc(pcFirst(m.who))} · ${D.short(D.iso(m.ts))}${f.size ? ` · ${esc(f.size)}` : ""}</span></span></button>`).join("")}</div>`
    : emptyMini("clip", "No files yet. Tap + in the chat to share photos or documents."),
    onMount(el) { onS(el, { open(x) { const m = c.msgs.find((y) => y.id === x.dataset.m); closeSheet(s); pcFileSheet(m, m.files[Number(x.dataset.i)]); } }); } });
});

// entry card on the project overview
function pcCard(p) {
  const c = pcOf(p.id), last = c.msgs[c.msgs.length - 1], n = pcUnread(p.id);
  return `<div class="sec"><h2 class="sec-ic">${I("msg")}Team chat</h2>${n ? `<span class="pc-new">${n} new</span>` : ""}</div>
    <button class="card pc-card" data-go="#/projects/${p.id}/chat">
      ${last ? `${last.who === "me" ? avatar("me", "sm") : avatar(last.who, "sm")}<span class="grow" style="min-width:0"><span class="hrow" style="gap:6px"><b class="ell">${esc(last.who === "me" ? "You" : person(last.who).name)}</b><span class="tiny muted" style="margin-left:auto;flex:none">${D.ago(last.ts) === "now" ? "now" : D.ago(last.ts) + " ago"}</span></span><span class="small ${n ? "" : "muted"} ell" style="display:block">${emoText(esc(pcSnippet({ ...last, who: "" })))}</span></span>`
        : `<span class="pc-card-ic">${I("msg")}</span><span class="grow"><b style="display:block">Start the conversation</b><span class="small muted">Chat, share files and @mention your team</span></span>`}
      ${I("chevR")}
    </button>`;
}
