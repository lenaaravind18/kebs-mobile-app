// My profile (summary / timeline / personal / job), edit profile, colleague profiles + praise

const PRAISE_BADGES = [["Being Consistent", "award"], ["Team Player", "users"], ["Above & Beyond", "sparkles"], ["Problem Solver", "target"], ["Customer First", "thumb"]];
function praiseCard(p) {
  return `<div class="card praise"><div class="hrow">${avatar(p.from, "sm")}<span class="grow"><b style="display:block">${esc(person(p.from).name)}</b><span class="tiny muted">${esc(person(p.from).role || "")}</span></span><span class="tiny faint">${D.long(p.date)}</span></div><span class="badge-praise">${I("award")}${esc(p.badge)}</span><span class="small">${esc(p.text)}</span></div>`;
}
function profileHead(id, statusChip) {
  const p = person(id);
  return `<div class="prof-head"><div class="av-wrap">${avatar(id, "xl")}<span class="status">${statusChip}</span></div>
    <h2>${esc(p.name)}</h2><div class="muted b small">${esc(p.role)}</div><div class="eyebrow" style="margin-top:2px">${esc(p.dept)} · ${esc(p.loc)}</div></div>`;
}

route("profile", (_, q) => {
  const tab = q.tab || "summary", me = S.me;
  const chip = clockedIn() ? `<span class="chip ok">Clocked in</span>` : S.att.today.outTs ? `<span class="chip">Clocked out</span>` : `<span class="chip acc">Not in yet</span>`;
  let body = "";
  if (tab === "summary") {
    body = `<div class="sec"><h2>Praises (${S.praises.me.length})</h2></div><div class="stack">${S.praises.me.map(praiseCard).join("") || emptyMini("award", "No praises received yet.")}</div>
      <div class="sec"><h2>About</h2></div>
      <div class="card stack"><span class="eyebrow">Intro</span>${me.intro ? `<p>${esc(me.intro)}</p>` : `<p class="muted">Not a single line about who you are. Impossible! Don’t be shy, let your teammates know you.</p>`}<button class="btn outline block" data-act="editIntro">${me.intro ? "Edit your response" : "Add your response"}</button></div>`;
  } else if (tab === "timeline") {
    const when = (ts) => new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const ev = [
      ...S.requests.map((r) => ({ ts: r.created, title: `${r.type === "leave" ? (LEAVE_TYPES.find((l) => l.id === r.leaveType)?.name || "Leave") : REQ_TYPES[r.type].name} request`, sub: D.range(r.from, r.to), icon: REQ_TYPES[r.type].icon, tint: REQ_TYPES[r.type].tint, chip: statusChip(r.status), go: `#/request/${r.id}` })),
      ...Object.entries(S.ts.weeks).filter(([, w]) => w.submittedAt).map(([k, w]) => ({ ts: w.submittedAt, title: "Timesheet submitted", sub: `Week of ${D.short(k)}`, icon: "clipboard", tint: "t-teal", chip: statusChip(w.status === "draft" ? "draft" : w.status), go: `#/ts/week?w=${k}` })),
      ...S.praises.me.map((p) => ({ ts: D.parse(p.date).getTime(), title: `Received “${p.badge}”`, sub: `from ${person(p.from).name}`, who: p.from, icon: "award", tint: "t-amber" })),
      { ts: D.parse(me.joined).getTime(), title: `Joined ${me.company}`, sub: me.role, icon: "building", tint: "t-blue" },
    ].sort((a, b) => b.ts - a.ts);
    body = `<div class="feed ptl" style="margin-top:14px">${ev.map((e) => `<${e.go ? `button data-go="${e.go}"` : "div"} class="fd">
        <div class="fd-av">${e.who ? `${avatar(e.who)}<span class="fd-badge ${e.tint}">${I(e.icon)}</span>` : `<span class="ic tint ${e.tint} ptl-ic">${I(e.icon)}</span>`}</div>
        <div class="grow" style="min-width:0"><b class="fd-t">${esc(e.title)}</b><span class="small muted" style="display:block">${esc(e.sub)} · ${when(e.ts)}</span></div>
        ${e.chip || ""}
      </${e.go ? "button" : "div"}>`).join("")}</div>`;
  } else if (tab === "personal") {
    body = `<div class="card" style="margin-top:12px">${[["First name", me.first], ["Middle name", me.middle], ["Last name", me.last], ["Display name", me.display], ["Date of birth", D.long(me.dob)], ["Marital status", me.marital], ["Gender", me.gender], ["Phone", me.phone], ["Work email", S.email]].map(([k, v]) => `<div class="kv"><span>${k}</span><span>${esc(v || "—")}</span></div>`).join("")}</div>
      <button class="btn primary block" style="margin-top:12px" data-go="#/profile/edit">${I("edit")}Edit personal details</button>`;
  } else {
    const yrs = D.diff(me.joined, D.today()) / 365;
    body = `<div class="card" style="margin-top:12px">${[["Employee ID", me.empId], ["Designation", me.role], ["Department", me.dept], ["Location", me.loc], ["Reporting to", person(me.manager).name], ["Date of joining", D.long(me.joined)], ["Tenure", `${yrs.toFixed(1)} years`], ["Shift", `${SHIFT.name} (${D.hm(SHIFT.start)} – ${D.hm(SHIFT.end)})`], ["Company", me.company]].map(([k, v]) => `<div class="kv"><span>${k}</span><span>${esc(v)}</span></div>`).join("")}</div>`;
  }
  return `<div class="screen">${topbar("My profile", { right: `<button class="ib" data-go="#/profile/edit" aria-label="Edit profile">${I("edit")}</button>` })}
    <div class="scroll">${profileHead("me", chip)}
    <div style="margin:16px -16px 0">${seg([["summary", "Summary"], ["timeline", "Timeline"], ["personal", "Personal"], ["job", "Job"]], tab, "profTab")}</div>
    ${body}</div></div>`;
});
act("profTab", (b) => swap(`#/profile?tab=${b.dataset.v}`));
act("editIntro", () => {
  const s = openSheet({ title: "About you", body: `<textarea class="inp" data-t maxlength="280" placeholder="Share what you work on, what you love, a fun fact…" autofocus>${esc(S.me.intro)}</textarea><p class="tiny faint" style="margin-top:6px">Visible to your teammates · up to 280 characters</p>`,
    foot: `<button class="btn primary block" data-s="ok">Save</button>`,
    onMount(el) { onS(el, { ok() { S.me.intro = el.querySelector("[data-t]").value.trim(); save(); closeSheet(s); rerender(); toast("Intro updated"); } }); } });
});

route("profile/edit", () => {
  const me = S.me;
  const F = draft("prof", { first: me.first, middle: me.middle, last: me.last, display: me.display, dob: me.dob, marital: me.marital, gender: me.gender, phone: me.phone });
  const inp = (k, label, type = "text") => `<div class="field"><label for="pf-${k}">${label}</label><input id="pf-${k}" class="inp" type="${type}" data-bind="${k}" value="${esc(F[k])}"></div>`;
  return `<div class="screen has-foot">${topbar("Edit profile")}<div class="scroll"><div class="stack s16" style="padding-top:6px">
    ${inp("first", "First name")}${inp("middle", "Middle name <span class='opt'>(optional)</span>")}${inp("last", "Last name")}${inp("display", "Display name")}${inp("dob", "Date of birth", "date")}
    <div class="field"><span class="lbl">Marital status</span><button class="inp sel" data-act="profPick" data-k="marital"><span>${esc(F.marital)}</span>${I("chevD")}</button></div>
    <div class="field"><span class="lbl">Gender</span><button class="inp sel" data-act="profPick" data-k="gender"><span>${esc(F.gender)}</span>${I("chevD")}</button></div>
    ${inp("phone", "Phone", "tel")}
  </div></div><div class="foot"><button class="btn primary block" data-act="profSave" data-cta>Save</button></div></div>`;
}, { mount() { FORM_CHECK = () => { const b = $("[data-cta]"); if (b) b.disabled = !(DRAFT.first.trim() && DRAFT.last.trim() && DRAFT.display.trim()); }; FORM_CHECK(); } });
act("profPick", (b) => {
  const k = b.dataset.k, opts = k === "marital" ? ["Single", "Married", "Divorced", "Widowed", "Prefer not to say"] : ["Female", "Male", "Non-binary", "Prefer not to say"];
  pickOption({ title: k === "marital" ? "Marital status" : "Gender", value: DRAFT[k], options: opts.map((v) => ({ v, label: v })), onPick(v) { DRAFT[k] = v; rerender(); } });
});
act("profSave", (b) => {
  if (b.disabled) return;
  const { _k, ...vals } = DRAFT;
  Object.keys(vals).forEach((k) => (vals[k] = String(vals[k]).trim()));
  Object.assign(S.me, vals); save(); DRAFT = null; toast("Profile saved"); ACTIONS.back();
});

route("people/:id", ({ id }, q) => {
  const p = S.people.find((x) => x.id === id);
  if (!p) return `<div class="screen">${topbar("Profile")}${emptyState(["user"], "Person not found", "")}</div>`;
  const tab = q.tab || "summary", praises = S.praises.others[id] || [];
  const off = S.offThisWeek.list.find((o) => o.id === id && o.date === D.today());
  const chip = off ? `<span class="chip vio">On leave</span>` : `<span class="chip ok">Available</span>`;
  const body = tab === "summary"
    ? `<div class="sec"><h2>Praises (${praises.length})</h2></div><div class="stack">${praises.map(praiseCard).join("") || emptyState(["award", "sparkles", "thumb"], "No praises yet", `Be the first to recognise ${esc(p.name.split(" ")[0])}’s work.`)}</div>
       <button class="btn outline block" style="margin-top:10px" data-act="givePraise" data-id="${id}">Give a praise</button>`
    : `<div class="card" style="margin-top:12px">${[["Designation", p.role], ["Department", p.dept], ["Location", p.loc], ["Email", `${p.name.split(" ")[0].toLowerCase()}@prima.com`]].map(([k, v]) => `<div class="kv"><span>${k}</span><span>${esc(v)}</span></div>`).join("")}</div>`;
  return `<div class="screen">${topbar("Profile")}<div class="scroll">${profileHead(id, chip)}
    <div class="hrow" style="justify-content:center;margin-top:14px"><button class="ib contact-btn" data-act="contact" data-id="${id}" data-k="mail" aria-label="Email">${I("mail")}</button><button class="ib contact-btn" data-act="contact" data-id="${id}" data-k="chat" aria-label="Message">${I("msg")}</button><button class="btn primary sm" data-act="givePraise" data-id="${id}">${I("award")}Give praise</button></div>
    <div style="margin:16px -16px 0">${seg([["summary", "Summary"], ["job", "Job"]], tab, "pplTab")}</div>${body}</div></div>`;
}, { mount({ id }, q) { if (q.praise) setTimeout(() => ACTIONS.givePraise({ dataset: { id } }), 150); } });
act("pplTab", (b) => swap(location.hash.split("?")[0] + `?tab=${b.dataset.v}`));
act("contact", (b) => { const p = person(b.dataset.id); navigator.clipboard?.writeText(`${p.name.split(" ")[0].toLowerCase()}@prima.com`).catch(() => {}); toast(b.dataset.k === "mail" ? `Copied ${p.name.split(" ")[0]}’s email` : `Chat with ${p.name.split(" ")[0]} opens in KEBS Chat`, "info"); });
act("givePraise", (b) => {
  const id = b.dataset.id; let badge = PRAISE_BADGES[0][0];
  const s = openSheet({
    title: `Praise ${esc(person(id).name.split(" ")[0])}`,
    body: `<div class="stack s16"><div class="field"><span class="lbl">Pick a badge</span><div class="choices" data-b>${PRAISE_BADGES.map(([n, ic]) => `<button class="choice ${n === badge ? "on" : ""}" data-s="badge" data-v="${n}">${I(ic)}&nbsp;${n}</button>`).join("")}</div></div>
      <div class="field"><label for="pr-t">Your message</label><textarea id="pr-t" class="inp" data-t placeholder="What did they do that stood out?"></textarea></div></div>`,
    foot: `<button class="btn primary block" data-s="send">${I("send")}Send praise</button>`,
    onMount(el) {
      onS(el, {
        badge(x) { badge = x.dataset.v; el.querySelectorAll("[data-b] .choice").forEach((c) => c.classList.toggle("on", c.dataset.v === badge)); },
        send() {
          const t = el.querySelector("[data-t]").value.trim();
          if (t.length < 5) { el.querySelector("[data-t]").focus(); return toast("Write a short message", "bad"); }
          (S.praises.others[id] ||= []).unshift({ from: "me", badge, text: t, date: D.today() }); save(); closeSheet(s); rerender(); toast(`Praise sent to ${person(id).name.split(" ")[0]} 🎉`);
        },
      });
    },
  });
});
