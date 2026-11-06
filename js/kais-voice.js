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
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/\*\*/g, "").replace(/^- /gm, "").replace(/\n+/g, ". "));
  u.lang = "en-IN"; u.pitch = v.pitch; u.rate = v.rate;
  const sv = sysVoice(v); if (sv) u.voice = sv;
  u.onend = () => done?.(); u.onerror = () => done?.();
  speechSynthesis.speak(u);
}
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
    raw: `<div class="vmode vo" data-state="idle" style="${orbVars(v)}">
      <div class="vo-top">
        <button class="vo-ib" data-s="end" aria-label="Close voice">${I("chevL")}</button>
        <span class="vo-who"><img src="kais.svg" alt="">${agent ? esc(agent.name) : "Kais"}<em data-vname>· ${v.name}</em></span>
        <span class="grow"></span>
        <button class="vo-ib" data-s="cc" aria-label="Toggle captions" aria-pressed="true">${I("msg")}</button>
        <button class="vo-ib" data-s="voice" aria-label="Change voice">${I("sliders")}</button>
      </div>
      <div class="vo-stage"><button class="vo-orb" data-s="orb" aria-label="Talk to Kais"></button></div>
      <div class="vm-state" data-vm-state>Starting…</div>
      <div class="vm-cap kmd" data-vm-cap aria-live="polite"></div>
      <div class="vo-bar">
        <button class="vo-ib lg" data-s="pause" aria-label="Pause" aria-pressed="false">${I("pause")}</button>
        <button class="vo-wave" data-s="mute" aria-label="Mute microphone" aria-pressed="false"><span class="vo-mic">${I("mic")}</span><i></i><i></i><i></i><i></i></button>
        <button class="vo-ib lg end" data-s="end" aria-label="End voice">${I("x")}</button>
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
        voice() { voiceChooser(() => { const nv = curVoice(); root.setAttribute("style", orbVars(nv)); el.querySelector("[data-vname]").textContent = "· " + nv.name; }); },
        orb() { if (VOICE.state === "speaking") { speechSynthesis.cancel(); vmListen(); } else if (!VOICE.rec && !VOICE.paused) vmListen(); },
      });
      vmMeter(); setTimeout(vmListen, 400);
    },
  });
}
act("kaisVoice", () => (S.kais.voiceIntro ? openVoice() : voiceIntro(openVoice)));
act("voicePick", () => voiceChooser());
