// Kais voice, advanced: a first-run intro, a "Choose a voice" carousel with cloud orbs and spoken previews,
// and an immersive dark voice screen (cloud orb · Listening… · pill waveform · pause / end).
// Reuses the engine in views-kais.js (vmListen, vmSet, vmMeter, vmStop, VOICE).

const VOICES = [
  { id: "aria", name: "Aria", desc: "Warm and clear", c: ["#ffeee6", "#ff8a5c", "#e8431e"], pitch: 1.05, rate: 1.0, male: false, idx: 0 },
  { id: "kabir", name: "Kabir", desc: "Calm and steady", c: ["#e6fbf7", "#3cc6b4", "#0b7a72"], pitch: 0.88, rate: 0.95, male: true, idx: 0 },
  { id: "meera", name: "Meera", desc: "Bright and upbeat", c: ["#fff7de", "#ffbd3a", "#ee7400"], pitch: 1.18, rate: 1.06, male: false, idx: 1 },
  { id: "dev", name: "Dev", desc: "Crisp and confident", c: ["#eceeff", "#7d88ff", "#3a3fc4"], pitch: 0.96, rate: 1.04, male: true, idx: 1 },
  { id: "nila", name: "Nila", desc: "Soft and relaxed", c: ["#eef7ff", "#7fc2ff", "#1f6fe0"], pitch: 1.0, rate: 0.92, male: false, idx: 2 },
];
(S.kais ||= { chats: [], active: null });
S.kais.voice ||= "aria";
const curVoice = () => VOICES.find((v) => v.id === S.kais.voice) || VOICES[0];
const orbVars = (v) => `--c1:${v.c[0]};--c2:${v.c[1]};--c3:${v.c[2]}`;

// pick a distinct system voice per Kais voice (falls back to any English voice)
function sysVoice(v) {
  if (!("speechSynthesis" in window)) return null;
  const all = speechSynthesis.getVoices().filter((x) => /^en/i.test(x.lang));
  if (!all.length) return null;
  const pref = all.filter((x) => (v.male ? /male|david|mark|ravi|guy|daniel|george|james/i.test(x.name) && !/female/i.test(x.name) : /female|zira|samantha|heera|aria|jenny|susan|hazel|google/i.test(x.name)));
  const pool = pref.length ? pref : all;
  return pool[v.idx % pool.length];
}
function sayAs(v, text, done) {
  if (!("speechSynthesis" in window)) { done?.(); return; }
  const go = () => {
    const u = new SpeechSynthesisUtterance(text.replace(/\*\*/g, "").replace(/^- /gm, "").replace(/\n+/g, ". "));
    u.lang = "en-IN"; u.pitch = v.pitch; u.rate = v.rate;
    const sv = sysVoice(v); if (sv) u.voice = sv;
    let fin = false; const end = () => { if (!fin) { fin = true; clearInterval(keep); done?.(); } };
    u.onend = end; u.onerror = end;
    // Chrome stops long utterances after ~15s unless nudged; also guard against a missed onend
    const keep = setInterval(() => { if (!speechSynthesis.speaking) end(); else { speechSynthesis.pause(); speechSynthesis.resume(); } }, 10000);
    speechSynthesis.speak(u);
  };
  // speaking straight after cancel() is silently dropped in Chrome, so give it a beat
  if (speechSynthesis.speaking || speechSynthesis.pending) { speechSynthesis.cancel(); setTimeout(go, 120); } else go();
}
// iOS only allows speech that starts from a tap: prime it with a silent utterance while the user's tap is still active
function unlockSpeech() {
  try { if (!("speechSynthesis" in window) || unlockSpeech.done) return; const u = new SpeechSynthesisUtterance(" "); u.volume = 0; speechSynthesis.speak(u); unlockSpeech.done = true; } catch {}
}
const TOUCH = matchMedia("(pointer: coarse)").matches;

// ── listening, rebuilt: one microphone user at a time, clear errors, gentle retries ──
vmListen = function () {
  if (!VOICE.on || VOICE.muted) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { vmSet("error", isStandaloneIOS() ? "Voice needs Safari on iPhone: open KEBS in Safari (not from the Home Screen) to talk to Kais." : "Voice mode needs speech recognition. Try Chrome, Edge or Safari."); return; }
  if (VOICE.rec) return;
  const r = new SR(); VOICE.rec = r; r.lang = "en-IN"; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
  let finalText = "", heard = false;
  vmSet("listening", VOICE.captions ? `<span class="faint">Say something like “What’s my leave balance?”</span>` : "");
  r.onaudiostart = () => { if (!VOICE.stream) fakeLevel(true); };
  r.onspeechstart = () => { heard = true; };
  r.onresult = (e) => { finalText = [...e.results].map((x) => x[0].transcript).join(""); if (VOICE.captions) vmSet("listening", `<b>${esc(finalText)}</b>`); };
  r.onerror = (e) => {
    VOICE.lastErr = e.error;
    const msg = { "not-allowed": "Microphone access is blocked. Allow the microphone for this site, then tap the orb.", "service-not-allowed": "Microphone access is blocked. Allow the microphone for this site, then tap the orb.",
      "audio-capture": "No microphone found, or another app is using it.", network: "Voice needs an internet connection. Check your network and tap the orb." }[e.error];
    if (msg) { VOICE.fatal = true; vmSet("error", msg); }
  };
  r.onend = () => {
    VOICE.rec = null; fakeLevel(false);
    if (!VOICE.on || VOICE.muted) return;
    if (VOICE.fatal) { VOICE.fatal = false; return; }
    const q = finalText.trim();
    if (!q) {
      VOICE.empty = (VOICE.empty || 0) + 1;
      if (VOICE.empty >= 3) { VOICE.empty = 0; vmSet("idle", `<span class="faint">I didn’t catch that. Tap the orb and ask again.</span>`); return; }
      setTimeout(vmListen, 350); return;
    }
    VOICE.empty = 0;
    vmSet("thinking", VOICE.captions ? `<b>${esc(q)}</b>` : "");
    const c = kaisChat(), agent = c ? c.agent : KAIS.agent;
    const ans = (agent && agentAnswer(agent, q)) || kaisAnswer(q);
    try { kaisSend(q); } catch {} // the exchange also lands in the chat thread
    setTimeout(() => {
      if (!VOICE.on) return;
      const say = voiceText(ans);
      vmSet("speaking", VOICE.captions ? md(say) : "");
      fakeLevel(true, true);
      vmSpeak(say, () => { fakeLevel(false); if (VOICE.on && !VOICE.paused) setTimeout(vmListen, 400); });
    }, 650);
  };
  try { r.start(); } catch { VOICE.rec = null; setTimeout(vmListen, 500); }
};
// spoken answers include what the chat shows in a card (numbers would otherwise be silent)
function voiceText(ans) {
  const c = ans.card; let extra = "";
  if (c?.type === "balances") extra = leaveBalances().filter((b) => b.total).map((b) => `${b.name} ${b.available}`).join(", ") + ".";
  else if (c?.type === "donut" && c.items) extra = c.items.map((i) => `${i.l || i.label || i.name} ${i.v ?? i.value ?? ""}`).join(", ") + (c.total ? `. Total ${c.total}.` : ".");
  else if (c?.type === "holidays" && c.list?.length > 1) extra = "After that: " + c.list.slice(1, 3).map((h) => `${h.name} on ${D.nice(h.date)}`).join(", ") + ".";
  return extra ? `${ans.text} ${extra}` : ans.text;
}
const isStandaloneIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) && (navigator.standalone || matchMedia("(display-mode: standalone)").matches);
// a soft, synthetic level for the orb and pills when we don't hold a mic meter (phones: the recogniser needs the mic to itself)
let FAKE = 0;
function fakeLevel(on, speaking = false) {
  cancelAnimationFrame(FAKE); FAKE = 0;
  const el = $(".vmode"); if (!el) return;
  if (!on) { if (!VOICE.stream) el.style.setProperty("--lvl", "0"); return; }
  const t0 = performance.now();
  const tick = (t) => { if (!VOICE.on) return; const k = (t - t0) / 1000; el.style.setProperty("--lvl", (Math.abs(Math.sin(k * (speaking ? 7 : 3.2))) * (speaking ? 0.7 : 0.35) + Math.random() * 0.12).toFixed(3)); FAKE = requestAnimationFrame(tick); };
  FAKE = requestAnimationFrame(tick);
}
// desktop keeps the real mic meter; phones skip it so speech recognition can use the microphone
const _vmMeter = vmMeter;
vmMeter = function () { if (!TOUCH) return _vmMeter(); };
// Kais speaks with the chosen voice everywhere voice mode talks
vmSpeak = function (text, done) { sayAs(curVoice(), text, done); };

// ── 1. Intro (first use) ──
function voiceIntro(next) {
  const row = (ic, t, s) => `<li><span class="vo-ic">${I(ic)}</span><span><b>${t}</b><small>${s}</small></span></li>`;
  const s = openSheet({
    cls: "full vo-sheet",
    raw: `<div class="vo-page vo-intro">
      <h1>Say hello to<br>Kais voice</h1>
      <ul>
        ${row("msg", "Natural conversations", "Talk the way you speak. Interrupt any time and Kais keeps up.")}
        ${row("wave", "Five voices", "Pick the voice that suits you, and change it whenever you like.")}
        ${row("user", "Knows your work", "Answers with your leave, hours, pay and approvals.")}
        ${row("lock", "You’re in control", "Nothing is recorded. Captions stay on this device.")}
      </ul>
      <p class="vo-foot">Kais can make mistakes, so check important details.</p>
      <button class="vo-pill" data-s="go">Continue</button>
    </div>`,
    onMount(el) { onS(el, { go() { closeSheet(s); voiceChooser(next, true); } }); },
  });
}

// ── 2. Choose a voice ──
function voiceChooser(next, first = false) {
  let i = Math.max(0, VOICES.findIndex((v) => v.id === S.kais.voice));
  const s = openSheet({
    cls: "full vo-sheet",
    raw: `<div class="vo-page vo-choose">
      <div class="vo-head">${first ? "" : `<button class="vo-ib" data-s="cancel" aria-label="Close">${I("x")}</button>`}<h2>Choose a voice</h2></div>
      <div class="vo-carousel" data-car>
        <button class="vo-arrow l" data-s="prev" aria-label="Previous voice">${I("chevL")}</button>
        <button class="vo-orb lg" data-s="play" aria-label="Play a preview"><span class="vo-play">${I("play")}</span></button>
        <button class="vo-arrow r" data-s="next" aria-label="Next voice">${I("chevR")}</button>
      </div>
      <div class="vo-name"><b data-n></b><small data-d></small></div>
      <div class="vo-dots" data-dots>${VOICES.map((v, k) => `<button data-s="dot" data-i="${k}" aria-label="${v.name}"></button>`).join("")}</div>
      <p class="vo-foot">Tap the orb to hear a preview.</p>
      <button class="vo-pill" data-s="done">${first ? "Get started" : "Done"}</button>
    </div>`,
    onClose() { if ("speechSynthesis" in window) speechSynthesis.cancel(); },
    onMount(el) {
      const draw = (dir = 0) => {
        const v = VOICES[i], orb = el.querySelector(".vo-orb");
        el.querySelector(".vo-choose").setAttribute("style", orbVars(v));
        el.querySelector("[data-n]").textContent = v.name; el.querySelector("[data-d]").textContent = v.desc;
        el.querySelectorAll("[data-dots] button").forEach((b, k) => b.classList.toggle("on", k === i));
        if (dir) { orb.classList.remove("in-l", "in-r"); void orb.offsetWidth; orb.classList.add(dir > 0 ? "in-r" : "in-l"); }
      };
      const go = (d) => { i = (i + d + VOICES.length) % VOICES.length; if ("speechSynthesis" in window) speechSynthesis.cancel(); draw(d); };
      onS(el, {
        prev() { go(-1); }, next() { go(1); },
        dot(b) { const k = Number(b.dataset.i); go(k - i); },
        play() { const orb = el.querySelector(".vo-orb"); orb.classList.add("talk"); sayAs(VOICES[i], `Hi, I’m ${VOICES[i].name}. Ask me about your leave, hours or approvals.`, () => orb.classList.remove("talk")); },
        cancel() { closeSheet(s); },
        done() { S.kais.voice = VOICES[i].id; S.kais.voiceIntro = true; save(); closeSheet(s); next?.(); },
      });
      // swipe between voices
      const car = el.querySelector("[data-car]"); let x0 = null;
      car.addEventListener("pointerdown", (e) => { x0 = e.clientX; });
      car.addEventListener("pointerup", (e) => { if (x0 === null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); });
      draw();
    },
  });
}

// ── 3. Voice screen ──
function openVoice() {
  const c = kaisChat(), agent = KAIS_AGENTS.find((a) => a.id === (c ? c.agent : KAIS.agent)), v = curVoice();
  VOICE.on = true; VOICE.muted = false; VOICE.paused = false;
  const s = openSheet({
    cls: "full vo-sheet",
    raw: `<div class="vmode vo vo2" data-state="idle" style="${orbVars(v)}">
      <div class="vo2-top">
        <button class="vo2-ib" data-s="end" aria-label="Back">${I("chevL")}</button>
        <h2>Speaking to ${agent ? esc(agent.name) : "Kais"}</h2>
        <button class="vo2-ib" data-s="cc" aria-label="Toggle captions" aria-pressed="true">${I("msg")}</button>
      </div>
      <div class="vm-state" data-vm-state>Starting…</div>
      <div class="vo2-stage"><button class="vo2-orb" data-s="orb" aria-label="Talk to Kais"><i></i><i></i><i></i><i></i><i></i></button></div>
      <div class="vm-cap kmd" data-vm-cap aria-live="polite"></div>
      <div class="vo2-bar">
        <button class="vo2-ib" data-s="voice" aria-label="Change voice">${I("sliders")}</button>
        <button class="vo2-mic" data-s="mute" aria-label="Mute microphone" aria-pressed="false"><span>${I("mic")}</span></button>
        <button class="vo2-ib" data-s="end" aria-label="End voice">${I("x")}</button>
      </div>
    </div>`,
    onClose() { vmStop(); },
    onMount(el) {
      const root = el.querySelector(".vmode");
      onS(el, {
        end() { closeSheet(s); },
        cc(b) { VOICE.captions = !VOICE.captions; b.setAttribute("aria-pressed", VOICE.captions); b.classList.toggle("off", !VOICE.captions); if (!VOICE.captions) el.querySelector("[data-vm-cap]").innerHTML = ""; },
        mute(b) {
          if (VOICE.paused) return;
          VOICE.muted = !VOICE.muted; b.setAttribute("aria-pressed", VOICE.muted); b.classList.toggle("off", VOICE.muted);
          if (VOICE.muted) { try { VOICE.rec?.abort(); } catch {} vmSet("muted"); } else vmListen();
        },
        pause(b) {
          VOICE.paused = !VOICE.paused; b.setAttribute("aria-pressed", VOICE.paused); b.innerHTML = I(VOICE.paused ? "play" : "pause");
          b.setAttribute("aria-label", VOICE.paused ? "Resume" : "Pause");
          if (VOICE.paused) { VOICE.muted = true; try { VOICE.rec?.abort(); } catch {} if ("speechSynthesis" in window) speechSynthesis.cancel(); vmSet("muted"); root.dataset.state = "paused"; el.querySelector("[data-vm-state]").textContent = "Paused"; }
          else { VOICE.muted = false; vmListen(); }
        },
        voice() { voiceChooser(() => { const nv = curVoice(); root.setAttribute("style", orbVars(nv)); const vn = el.querySelector("[data-vname]"); if (vn) vn.textContent = "· " + nv.name; }); },
        orb() { unlockSpeech(); if (VOICE.state === "speaking") { speechSynthesis.cancel(); vmListen(); } else if (!VOICE.rec && !VOICE.paused) { VOICE.empty = 0; vmListen(); } },
      });
      unlockSpeech(); VOICE.empty = 0; VOICE.fatal = false; vmMeter(); setTimeout(vmListen, 400);
    },
  });
}
act("kaisVoice", () => (S.kais.voiceIntro ? openVoice() : voiceIntro(openVoice)));
act("voicePick", () => voiceChooser());
