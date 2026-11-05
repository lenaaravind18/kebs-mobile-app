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
  const [main, ...acc] = s.art;
  return `<div class="screen onb2" data-ob data-step="${OB_I}">
    <div class="onb2-bg" aria-hidden="true"><i class="g1"></i><i class="g2"></i><i class="g3"></i><span class="kmark-ghost r">${KEBS_MARK}</span></div>
    <div class="onb2-top"><span class="onb2-brand"><img src="icon.svg" alt="">KEBS</span>${last ? "" : `<button class="onb2-skip" data-act="obDone">Skip</button>`}</div>
    <div class="onb2-art" aria-hidden="true">
      <span class="onb2-halo"></span>
      <img class="onb2-main" src="assets/ob/${main[0]}" alt="" draggable="false">
      ${acc.map(([img, pos], i) => `<img class="onb2-acc ${pos}" style="--d:${160 + i * 90}ms" src="assets/ob/${img.includes(".") ? img : img + ".png"}" alt="" draggable="false">`).join("")}
    </div>
    <div class="onb2-card">
      <span class="onb2-step">0${OB_I + 1} <i>/ 0${OB.length}</i></span>
      <h1>${s.title}</h1>
      <p class="onb2-tag">${s.tag}</p>
      <p class="onb2-body">${s.body}</p>
      <div class="onb2-foot">
        <div class="onb2-bars" role="tablist" aria-label="Slides">${OB.map((_, i) => `<button class="${i < OB_I ? "done" : i === OB_I ? "on" : ""}" data-act="obGo" data-i="${i}" aria-label="Slide ${i + 1}" aria-selected="${i === OB_I}"><i></i></button>`).join("")}</div>
        <button class="btn primary onb2-cta" data-act="${last ? "obDone" : "obNext"}">${last ? "Get started" : "Next"} ${I("arrowOut")}</button>
      </div>
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
