// First-run onboarding (3 slides) + the curtain-arch art shared with login.
// Inspired by the KEBS onboarding designs: coral curtain dome, 3D illustration, title, coral tagline, body, dots, Skip / next.

const OB = [
  { title: "AI-Powered Workspace", tag: "Streamline operations with intelligent automation", body: "Kais learns how you work: it clocks you in, logs your time and drafts requests so you can focus on the work.",
    art: [["ai.svg", "main"], ["sparkles", "tl"], ["bulb", "tr"]] },
  { title: "Smart Approval Hub", tag: "Intelligent request management and insights", body: "Priority Inbox sorts what needs you first. Approve routine requests in one tap with AI-verified suggestions.",
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
  { eyebrow: "Meet Kais", icon: "sparkles", feats: [["clock", "Clock in from anywhere"], ["timesheet", "Log time just by asking"], ["request", "Drafts WFH and leave requests"]], title: "Kais handles the busywork", body: "Clock in, log hours and draft requests just by asking. Your AI teammate keeps your day moving.",
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
  { eyebrow: "Priority Inbox", icon: "inbox", feats: [["ag-approval", "Policy checks on every request"], ["alert", "Flags what needs a closer look"], ["bills", "Bulk-approve routine claims"]], title: "Approvals in one tap", body: "Kais checks every request against policy and lines up the routine ones, so you clear your inbox in seconds.",
    art: () => `
      <div class="oc oc-appr back"></div>
      <div class="oc oc-appr c1">
        <div class="hrow">${avatar("dr", "sm")}<span class="grow"><b>Darlene Robertson</b><small>Client lunch · Food</small></span><b class="oc-amt">₹2,450</b></div>
        <span class="oc-chip ok">${I("checkCircle")}Matches policy</span>
        <div class="oc-btns"><span class="oc-btn ghost">Reject</span><span class="oc-btn ok">${I("check")}Approve</span></div>
      </div>
      <div class="oc oc-pill c2">${I("sparkles")}<b>4 ready</b><span>Bulk approve</span></div>` },
  { eyebrow: "Insights", icon: "chart", feats: [["balances", "Live leave and hours"], ["insights", "Spend by category"], ["ag-report", "Reports on demand"]], title: "Your work at a glance", body: "Leave, hours and spend in clean, live charts. Ask Kais anything and get the answer with the numbers.",
    art: () => `
      <div class="oc oc-ring c1"><span class="ring lg" style="--p:82;--t:var(--accent)"><b>31</b><small>days left</small></span><span class="grow"><b>Leave balance</b><small>Casual 9 · Sick 7 · Earned 12</small></span></div>
      <div class="oc oc-chart c2"><span class="oc-eyebrow">Hours this week</span><div class="oc-bars">${[78, 74, 64, 30, 0].map((h, i) => `<i style="height:${Math.max(6, h)}%" class="${i === 3 ? "now" : ""}"></i>`).join("")}</div><div class="oc-days"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span></div></div>
      <div class="oc oc-pill c3 up">${I("arrowOut")}<b>+8%</b><span>vs last week</span></div>` },
];

route("welcome", () => {
  const s = OB4[OB_I], last = OB_I === OB4.length - 1;
  return `<div class="screen onb3" data-ob data-step="${OB_I}">
    <div class="onb3-hero">
      <div class="onb3-grid" aria-hidden="true"></div>
      <span class="onb3-mark" aria-hidden="true">${KEBS_MARK}</span>
      <div class="onb3-top">
        <div class="onb3-bars" role="tablist" aria-label="Slides">${OB4.map((_, i) => `<button class="${i < OB_I ? "done" : i === OB_I ? "on" : ""}" data-act="obGo" data-i="${i}" aria-label="Slide ${i + 1}" aria-selected="${i === OB_I}"><i></i></button>`).join("")}</div>
        ${last ? `<span style="width:52px"></span>` : `<button class="onb3-skip" data-act="obDone">Skip</button>`}
      </div>
      <div class="onb3-art" aria-hidden="true">${s.art()}</div>
    </div>
    <div class="onb3-copy">
      <span class="onb3-eyebrow">${I(s.icon)}${s.eyebrow}</span>
      <h1>${s.title}</h1>
      <p>${s.body}</p>
      <ul class="onb3-feats">${s.feats.map(([ic, t], i) => `<li style="--d:${120 + i * 70}ms"><span class="onb3-fic">${msIcon(ic)}</span><span>${t}</span></li>`).join("")}</ul>
      <div class="onb3-actions">
        <button class="btn primary block onb3-cta" data-act="${last ? "obDone" : "obNext"}">${last ? "Get started" : "Continue"}</button>
        ${last ? `<button class="link onb3-alt" data-act="obDone">I already have an account</button>` : ""}
      </div>
    </div>
  </div>`;
}, {
  mount() {
    const el = $("[data-ob]"); let x0 = null;
    el.addEventListener("pointerdown", (e) => { if (!e.target.closest("button")) x0 = e.clientX; });
    el.addEventListener("pointerup", (e) => {
      if (x0 === null) return; const dx = (e.clientX - x0) / ZOOM; x0 = null;
      if (dx < -50 && OB_I < OB4.length - 1) { OB_I++; rerender(); } else if (dx > 50 && OB_I > 0) { OB_I--; rerender(); }
    });
  },
});
act("obNext", () => { OB_I = Math.min(OB4.length - 1, OB_I + 1); rerender(); });
act("obGo", (b) => { OB_I = Number(b.dataset.i); rerender(); });
act("obDone", () => { S.onboarded = true; save(); OB_I = 0; location.replace("#/login"); });
act("replayIntro", () => { closeDrawer(); OB_I = 0; S.onboarded = false; save(); S.authed && toast("Showing the intro — sign-in is kept", "info"); go("#/welcome"); });
