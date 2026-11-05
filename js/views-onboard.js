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

route("welcome", () => {
  const s = OB[OB_I], last = OB_I === OB.length - 1;
  const pct = ((OB_I + 1) / OB.length) * 100;
  return `<div class="screen ob" data-ob>
    ${curtain(`<div class="ob-art" aria-hidden="true">${obArt(s)}</div>`)}
    <div class="ob-copy" aria-live="polite">
      <h1>${s.title}</h1>
      <p class="ob-tag">${s.tag}</p>
      <p class="ob-body">${s.body}</p>
    </div>
    <div class="ob-dots" role="tablist" aria-label="Slides">${OB.map((_, i) => `<button class="${i === OB_I ? "on" : ""}" data-act="obGo" data-i="${i}" aria-label="Slide ${i + 1}" aria-selected="${i === OB_I}"></button>`).join("")}</div>
    <div class="ob-foot">
      ${last ? `<span></span>` : `<button class="link ob-skip" data-act="obDone">Skip</button>`}
      ${last ? `<button class="btn primary ob-start" data-act="obDone">Get started ${I("arrowOut")}</button>`
        : `<button class="ob-next" data-act="obNext" aria-label="Next slide"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29" class="trk"/><circle cx="32" cy="32" r="29" class="bar" style="stroke-dashoffset:${182 - (182 * pct) / 100}"/></svg><span>${I("chevR")}</span></button>`}
    </div>
  </div>`;
}, {
  mount() {
    // swipe between slides
    const el = $("[data-ob]"); let x0 = null;
    el.addEventListener("pointerdown", (e) => { if (!e.target.closest("button")) x0 = e.clientX; });
    el.addEventListener("pointerup", (e) => {
      if (x0 === null) return; const dx = e.clientX - x0; x0 = null;
      if (dx < -50 && OB_I < OB.length - 1) { OB_I++; rerender(); } else if (dx > 50 && OB_I > 0) { OB_I--; rerender(); }
    });
  },
});
act("obNext", () => { OB_I = Math.min(OB.length - 1, OB_I + 1); rerender(); });
act("obGo", (b) => { OB_I = Number(b.dataset.i); rerender(); });
act("obDone", () => { S.onboarded = true; save(); OB_I = 0; location.replace("#/login"); });
act("replayIntro", () => { closeDrawer(); OB_I = 0; S.onboarded = false; save(); S.authed && toast("Showing the intro — sign-in is kept", "info"); go("#/welcome"); });
