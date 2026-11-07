// First-run onboarding (3 slides) + the curtain-arch art shared with login.
// Inspired by the KEBS onboarding designs: coral curtain dome, 3D illustration, title, coral tagline, body, dots, Skip / next.

const OB = [
  { title: "Assistant-Powered Workspace", tag: "Streamline operations with intelligent automation", body: "Kais learns how you work: it clocks you in, logs your time and drafts requests so you can focus on the work.",
    art: [["ai.svg", "main"], ["sparkles", "tl"], ["bulb", "tr"]] },
  { title: "Smart Approval Hub", tag: "Intelligent request management and insights", body: "Priority Inbox sorts what needs you first. Approve routine requests in one tap with assistant-verified suggestions.",
    art: [["approve.svg", "main"], ["check", "tr"], ["bell", "tl"]] },
  { title: "Unified Analytics", tag: "Data-driven insights at your fingertips", body: "Leave, hours and spend at a glance — live charts, smart summaries and answers from Kais whenever you ask.",
    art: [["analytics.svg", "main"], ["chart", "tr"], ["coin", "tl"]] },
];
let OB_I = 0;

function curtain(inner = "", cls = "") {
  return `<div class="curtain ${cls}"><div class="curtain-bg"></div><span class="kmark-ghost l">${KEBS_MARK}</span><span class="kmark-ghost r">${KEBS_MARK}</span>${inner}</div>`;
}
function obArt(s) {
  return s.art.map(([img, pos], i) => `<img class="ob-img ${pos}" style="--d:${i * 90}ms" src="assets/ob/${img.includes(".") ? img : img + ".png"}" alt="" draggable="false">`).join("");
}

// Onboarding v3: real product UI as floating cards on a brand gradient (Dribbble product-onboarding pattern)
const OB4 = [
  { eyebrow: "Meet Kais", icon: "sparkles", ill: "ai", alt: "A person checks a confirmation on her phone next to a friendly assistant robot", feats: [["clock", "Clock in from anywhere"], ["timesheet", "Log time just by asking"], ["request", "Drafts WFH and leave requests"]], title: "Kais handles the busywork", body: "Clock in, log hours and draft requests just by asking. Your assistant keeps your day moving.",
    art: () => `
      <div class="oc oc-chat c1">
        <div class="oc-row me"><span class="oc-bub me">Clock me in</span></div>
        <div class="oc-row"><img class="oc-kav" src="kais.svg" alt=""><span class="oc-bub ai"><b>Clocked in · 9:28 AM</b><small>${I("pin")} India HO – Chennai</small></span></div>
      </div>
      <div class="oc oc-today c2">
        <span class="oc-eyebrow">Today</span>
        <div class="hrow"><b class="oc-timer">03:42:10</b><span class="oc-chip ok">${I("check")}On time</span></div>
        <div class="oc-bar"><i style="width:42%"></i></div>
      </div>` },
  { eyebrow: "Priority Inbox", icon: "inbox", ill: "approve", alt: "A person next to a checklist with two items approved", feats: [["ag-approval", "Policy checks on every request"], ["alert", "Flags what needs a closer look"], ["bills", "Bulk-approve routine claims"]], title: "Approvals in one tap", body: "Kais checks every request against policy and lines up the routine ones, so you clear your inbox in seconds.",
    art: () => `
      <div class="oc oc-appr back"></div>
      <div class="oc oc-appr c1">
        <div class="hrow">${avatar("dr", "sm")}<span class="grow"><b>Darlene Robertson</b><small>Client lunch · Food</small></span><b class="oc-amt">₹2,450</b></div>
        <span class="oc-chip ok">${I("checkCircle")}Matches policy</span>
        <div class="oc-btns"><span class="oc-btn ghost">Reject</span><span class="oc-btn ok">${I("check")}Approve</span></div>
      </div>
      <div class="oc oc-pill c2">${I("sparkles")}<b>4 ready</b><span>Bulk approve</span></div>` },
  { eyebrow: "Insights", icon: "chart", ill: "analytics", alt: "Two people looking at a growth chart on a big screen", feats: [["balances", "Live leave and hours"], ["insights", "Spend by category"], ["ag-report", "Reports on demand"]], title: "Your work at a glance", body: "Leave, hours and spend in clean, live charts. Ask Kais anything and get the answer with the numbers.",
    art: () => `
      <div class="oc oc-ring c1"><span class="ring lg" style="--p:82;--t:var(--accent)"><b>31</b><small>days left</small></span><span class="grow"><b>Leave balance</b><small>Casual 9 · Sick 7 · Earned 12</small></span></div>
      <div class="oc oc-chart c2"><span class="oc-eyebrow">Hours this week</span><div class="oc-bars">${[78, 74, 64, 30, 0].map((h, i) => `<i style="height:${Math.max(6, h)}%" class="${i === 3 ? "now" : ""}"></i>`).join("")}</div><div class="oc-days"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span></div></div>
      <div class="oc oc-pill c3 up">${I("arrowOut")}<b>+8%</b><span>vs last week</span></div>` },
];

// Onboarding v4 (clean, centred): logo on top, floating KEBS mini-cards over a dotted map, big title, dots, one pill CTA
const AV = (id, cls = "") => `<span class="obx-av ${cls}" style="background-image:url(assets/avatars/${id}.jpg?v=3)"></span>`;
const OB5 = [
  { title: "Your workday,<br>perfectly planned", body: "Clock in, plan leave and log time in seconds. Start your day the easy way.",
    art: () => `
      <div class="obx obx-today p1"><span class="obx-eyebrow">Today · ${D.f(D.today(), { weekday: "short", day: "numeric", month: "short" })}</span><b class="obx-big">09:28 AM</b><span class="obx-sub">${I("pin")}Clocked in · India HO</span></div>
      <div class="obx-chip p2"><span><b>12</b><small>Dec</small></span><span><b>4</b><small>days</small></span></div>
      <div class="obx obx-list p3">${[["coffee", "t-blue", "Casual leave", "2 days · 24 Dec"], ["sparkles", "t-violet", "Floater holiday", "1 day · 1 Jan"], ["plane", "t-green", "Earned leave", "5 days · 4 Mar"], ["home", "t-orange", "Work from home", "1 day · 19 Jul"]]
        .map(([ic, t, a, b]) => `<div class="obx-li"><span class="obx-ic" style="color:var(--c-${t})">${I(ic)}</span><span><b>${a}</b><small>${b}</small></span></div>`).join("")}</div>
      ${AV("me", "p4 ring")}<i class="obx-dots p5"></i><i class="obx-dash p6"></i><i class="obx-dot p7"></i>` },
  { title: "Your team,<br>close by", body: "See who’s in, who’s away and chat with your project team in one place.",
    art: () => `
      <div class="obx-photo p1 sm">${AV("sl")}<span class="obx-badge">${AV("sl", "xs")}</span></div>
      <div class="obx-photo p2 lg">${AV("al")}<span class="obx-badge">${AV("al", "xs")}</span></div>
      <div class="obx-photo p3 sm">${AV("rb")}<span class="obx-badge">${AV("rb", "xs")}</span></div>
      <div class="obx-tag p4">${AV("pb", "xs")}<span>Currently in <b>Chennai HO</b></span></div>
      <div class="obx-tag p5 pin">${I("msg")}<span><b>3 new</b> in Design system</span></div>
      <i class="obx-dots p6"></i><i class="obx-dots p7 o"></i>` },
  { title: "Approvals<br>in one tap", body: "Kais checks every request against policy, so you clear your inbox in seconds.",
    art: () => `
      <div class="obx obx-req p1"><span class="obx-label">Expense</span>${AV("dr", "sq")}<span class="grow"><b>Client lunch</b><small>Darlene · Food</small><em>${I("checkCircle")}Matches policy</em></span><span class="obx-acts"><i>${I("x")}</i><i>${I("check")}</i></span></div>
      <div class="obx obx-req p2 hi">${AV("jr", "sq")}<span class="grow"><b>Leave · 2 days</b><small>Jack Ryan · Casual</small><em>${I("checkCircle")}No clashes</em></span><span class="obx-acts"><i>${I("x")}</i><i class="go">${I("check")}</i></span></div>
      <div class="obx obx-req p3">${AV("vi", "sq")}<span class="grow"><b>Timesheet · 40h</b><small>Vineeth · Week 45</small><em>${I("checkCircle")}All days logged</em></span><span class="obx-acts"><i>${I("x")}</i><i>${I("check")}</i></span></div>
      <div class="obx-chip k p4">${I("sparkles")}<b>4 ready</b></div><i class="obx-dash p5"></i>` },
  { title: "Ask Kais<br>anything", body: "Your assistant applies leave, files claims and finds answers — just ask.",
    art: () => `
      <div class="obx-bub me p1">Apply leave for tomorrow</div>
      <div class="obx obx-kais p2"><img src="kais.svg" alt=""><span class="grow"><b>Casual leave · ${D.f(D.add(D.today(), 1), { weekday: "short", day: "numeric", month: "short" })}</b><small>Sent to Prasanna R for approval</small></span><span class="obx-ok">${I("check")}</span></div>
      <div class="obx-bub me p3">Scan this bill</div>
      <div class="obx obx-kais p4"><img src="kais.svg" alt=""><span class="grow"><b>Uber · ₹507</b><small>Travel · ready to submit</small></span></div>
      <img class="obx-orb p5" src="kais.svg" alt=""><i class="obx-dots p6"></i>` },
];

route("welcome", () => {
  const s = OB5[OB_I] || OB5[(OB_I = 0)];
  return `<div class="screen obx-screen" data-ob data-step="${OB_I}">
    <header class="obx-head"><span class="obx-logo">${KEBS_MARK}<b>KEBS<i>.</i></b></span>${OB_I < OB5.length - 1 ? `<button class="obx-skip" data-act="obDone">Skip</button>` : ""}</header>
    <div class="obx-stage" aria-hidden="true"><div class="obx-map"></div><svg class="obx-path" viewBox="0 0 320 260" preserveAspectRatio="none"><path d="M10 190 C 70 60, 150 250, 210 120 S 300 40, 316 70"/></svg><div class="obx-art" data-k="${OB_I}">${s.art()}</div></div>
    <div class="obx-copy">
      <h1>${s.title}</h1><p>${s.body}</p>
      <div class="obx-dotsnav" role="tablist" aria-label="Slides">${OB5.map((_, i) => `<button class="${i === OB_I ? "on" : ""}" data-act="obGo" data-i="${i}" aria-label="Slide ${i + 1}" aria-selected="${i === OB_I}"></button>`).join("")}</div>
      <button class="obx-cta" data-act="${OB_I < OB5.length - 1 ? "obNext" : "obDone"}">${OB_I < OB5.length - 1 ? "Continue" : "Get started"}</button>
    </div>
  </div>`;
}, {
  mount() {
    const el = $("[data-ob]"); let x0 = null;
    el.addEventListener("pointerdown", (e) => { if (!e.target.closest("button")) x0 = e.clientX; });
    el.addEventListener("pointerup", (e) => {
      if (x0 === null) return; const dx = (e.clientX - x0) / (typeof ZOOM !== "undefined" ? ZOOM : 1); x0 = null;
      if (dx < -50 && OB_I < OB5.length - 1) { OB_I++; rerender(); } else if (dx > 50 && OB_I > 0) { OB_I--; rerender(); }
    });
  },
});
act("obNext", () => { OB_I = Math.min(OB5.length - 1, OB_I + 1); rerender(); });
act("obGo", (b) => { OB_I = Number(b.dataset.i); rerender(); });
act("obDone", () => { S.onboarded = true; save(); OB_I = 0; location.replace("#/login"); });
act("replayIntro", () => { closeDrawer(); OB_I = 0; S.onboarded = false; save(); S.authed && toast("Showing the intro — sign-in is kept", "info"); go("#/welcome"); });
