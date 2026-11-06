// Android app: the system web view has no speech recognition or text-to-speech, so the KEBS shell provides
// both natively. This file plugs them in as the standard SpeechRecognition / speechSynthesis APIs, so the
// voice code everywhere else works unchanged. In browsers it does nothing.
(() => {
  const N = window.KebsNative;
  if (!N || !N.hasSpeech || !N.hasSpeech()) return;

  // ── speech recognition ──
  let active = null;
  class NativeRecognition {
    constructor() { this.lang = "en-IN"; this.interimResults = false; this.continuous = false; this.maxAlternatives = 1; }
    start() { active = this; N.startListening(this.lang || "en-IN"); }
    stop() { N.stopListening(); }
    abort() { N.abortListening(); }
  }
  const define = (name, value) => { try { Object.defineProperty(window, name, { value, configurable: true, writable: true }); } catch {} };
  define("SpeechRecognition", NativeRecognition);
  define("webkitSpeechRecognition", NativeRecognition);

  // ── text to speech ──
  const utters = new Map();
  let current = null;
  class Utterance {
    constructor(text) { this.text = text || ""; this.rate = 1; this.pitch = 1; this.volume = 1; this.lang = "en-IN"; this.voice = null; }
  }
  const synth = {
    paused: false,
    onvoiceschanged: null,
    get speaking() { return !!current; },
    get pending() { return false; },
    getVoices() { return []; },
    addEventListener() {}, removeEventListener() {},
    speak(u) {
      if (!u.text.trim() || u.volume === 0) { setTimeout(() => u.onend?.(), 0); return; }
      const id = "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      utters.set(id, u); current = id;
      N.speak(u.text, u.rate || 1, u.pitch || 1, id);
      u.onstart?.();
    },
    cancel() { if (current) N.stopSpeaking(); },
    pause() {}, resume() {},
  };
  define("SpeechSynthesisUtterance", Utterance);
  define("speechSynthesis", synth);

  addEventListener("kebsspeech", (e) => {
    const { type, text } = e.detail || {};
    if (type === "ttsend") {
      const u = utters.get(text); utters.delete(text);
      if (current === text) current = null;
      u?.onend?.();
      return;
    }
    const r = active; if (!r) return;
    if (type === "audiostart") r.onaudiostart?.();
    else if (type === "speechstart") r.onspeechstart?.();
    else if (type === "partial" || type === "final") {
      if (type === "partial" && !r.interimResults) return;
      const alt = [{ transcript: text, confidence: 1 }]; alt.isFinal = type === "final";
      r.onresult?.({ results: [alt], resultIndex: 0 });
    } else if (type === "error") r.onerror?.({ error: text });
    else if (type === "end") { active = null; r.onend?.(); }
  });
})();
