// Shared helpers: DOM, escaping, dates, durations, i18n
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Math.random().toString(36).slice(2, 9);
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

const D = {
  iso(d) { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; },
  parse(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); },
  today() { return D.iso(new Date()); },
  add(s, n) { const d = D.parse(s); d.setDate(d.getDate() + n); return D.iso(d); },
  addMonths(s, n) { const d = D.parse(s); d.setDate(1); d.setMonth(d.getMonth() + n); return D.iso(d); },
  monday(s) { const d = D.parse(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return D.iso(d); },
  wd(s) { return (D.parse(s).getDay() + 6) % 7; }, // 0 = Mon
  isWeekend(s) { return D.wd(s) >= 5; },
  diff(a, b) { return Math.round((D.parse(b) - D.parse(a)) / 864e5); },
  f(s, o) { return D.parse(s).toLocaleDateString("en-GB", o); },
  short(s) { return D.f(s, { day: "2-digit", month: "short" }); },           // 05 Nov
  long(s) { return D.f(s, { day: "2-digit", month: "short", year: "numeric" }); }, // 05 Nov 2026
  dayName(s) { return D.f(s, { weekday: "long" }); },
  nice(s) { return D.f(s, { weekday: "long", day: "numeric", month: "short" }); }, // Thursday, 5 Nov
  range(a, b) { return a === b ? D.short(a) : `${D.short(a)} – ${D.short(b)}`; },
  days(a, b) { return D.diff(a, b) + 1; },
  workdays(a, b) { let n = 0; for (let d = a; d <= b; d = D.add(d, 1)) if (!D.isWeekend(d)) n++; return n; },
  time(ts) { return new Date(ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }); },
  hm(str) { // "09:30" -> "09:30 AM"
    if (!str) return "--:--";
    const [h, m] = str.split(":").map(Number);
    return `${String(((h + 11) % 12) + 1).padStart(2, "0")}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  },
  ago(ts) {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return "now"; if (s < 3600) return `${Math.floor(s / 60)}m`; if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
  },
};
const toMin = (hhmm) => { if (!hhmm) return 0; const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const fmtMin = (m) => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, "0")}m`;
const fmtClock = (sec) => [Math.floor(sec / 3600), Math.floor((sec % 3600) / 60), Math.floor(sec % 60)].map((n) => String(n).padStart(2, "0")).join(":");
const money = (n) => "INR " + Number(n).toLocaleString("en-IN");

// Apple emoji artwork (3D-style illustrations, as in the Figma quick-access tiles)
function emojiSrc(e) {
  const cps = [...e].map((c) => c.codePointAt(0).toString(16));
  const parts = cps.includes("200d") ? cps : cps.length === 2 && cps[1] === "fe0f" ? cps : cps.filter((c) => c !== "fe0f");
  return `https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.1.2/img/apple/64/${parts.join("-")}.png`;
}
const emo = (e, cls = "emo") => `<img class="${cls}" src="${emojiSrc(e)}" alt="" loading="lazy" draggable="false">`;
// KEBS petals (brand mark) as an inline SVG
const KEBS_MARK = `<svg viewBox="0 0 34 38" fill="currentColor" aria-hidden="true"><path d="M11.2534 4.7648V11.2569C11.2534 12.3885 10.2369 13.2422 9.14217 13.0238L4.09898 12.0112L0.111328 16.0812L8.90762 17.8283C10.8624 18.2253 12.8757 17.5901 14.2636 16.1409C15.3386 15.0092 15.9447 13.5002 15.9447 11.9319V0L11.2534 4.7648Z"/><path d="M22.7413 4.7648V11.1575C22.7413 12.3487 23.815 13.2422 24.9474 13.0039L29.8868 12.0112L33.889 16.0812L25.1035 17.8283C23.1513 18.2253 21.1403 17.5901 19.7542 16.1409C18.6609 15.029 18.0557 13.52 18.0557 11.9517V0L22.7413 4.7648Z"/><path d="M11.2534 33.2396V26.596C11.2534 25.5451 10.315 24.7518 9.27904 24.95L4.09898 25.9813L0.111328 21.9158L8.90762 20.1707C10.8624 19.7741 12.8757 20.4087 14.2636 21.8564C15.3386 22.9868 15.9447 24.4939 15.9447 26.0606V37.9991L11.2534 33.2396Z"/><path d="M22.747 33.2343V26.4842C22.747 25.4717 23.6462 24.7173 24.6235 24.9157L29.9013 25.968L33.889 21.9179L25.0928 20.1708C23.138 19.7738 21.1246 20.4091 19.7367 21.8583C18.6616 22.99 18.0557 24.4989 18.0557 26.0673V37.9991L22.747 33.2343Z"/></svg>`;

// Light i18n for chrome + greeting (Language Selection screen)
const LANGS = [
  { id: "en", native: "English", name: "English" }, { id: "te", native: "తెలుగు", name: "Telugu" }, { id: "hi", native: "हिंदी", name: "Hindi" },
  { id: "ta", native: "தமிழ்", name: "Tamil" }, { id: "kn", native: "ಕನ್ನಡ", name: "Kannada" }, { id: "gu", native: "ગુજરાતી", name: "Gujarati" }, { id: "mr", native: "मराठी", name: "Marathi" },
];
const STR = {
  home: { en: "Home", te: "హోమ్", hi: "होम", ta: "முகப்பு", kn: "ಮುಖಪುಟ", gu: "હોમ", mr: "होम" },
  inbox: { en: "Inbox", te: "ఇన్‌బాక్స్", hi: "इनबॉक्स", ta: "இன்பாக்ஸ்", kn: "ಇನ್‌ಬಾಕ್ಸ್", gu: "ઇનબોક્સ", mr: "इनबॉक्स" },
  alerts: { en: "Alerts", te: "అలర్ట్స్", hi: "सूचनाएं", ta: "அறிவிப்பு", kn: "ಸೂಚನೆ", gu: "સૂચના", mr: "सूचना" },
  apps: { en: "Apps", te: "యాప్స్", hi: "ऐप्स", ta: "ஆப்ஸ்", kn: "ಆ್ಯಪ್ಸ್", gu: "એપ્સ", mr: "ॲप्स" },
  morning: { en: "Good morning", te: "శుభోదయం", hi: "सुप्रभात", ta: "காலை வணக்கம்", kn: "ಶುಭೋದಯ", gu: "સુપ્રભાત", mr: "सुप्रभात" },
  afternoon: { en: "Good afternoon", te: "శుభ మధ్యాహ్నం", hi: "शुभ दोपहर", ta: "மதிய வணக்கம்", kn: "ಶುಭ ಮಧ್ಯಾಹ್ನ", gu: "શુભ બપોર", mr: "शुभ दुपार" },
  evening: { en: "Good evening", te: "శుభ సాయంత్రం", hi: "शुभ संध्या", ta: "மாலை வணக்கம்", kn: "ಶುಭ ಸಂಜೆ", gu: "શુભ સાંજ", mr: "शुभ संध्याकाळ" },
  quick: { en: "Quick access", te: "త్వరిత యాక్సెస్", hi: "त्वरित पहुँच", ta: "விரைவு அணுகல்", kn: "ತ್ವರಿತ ಪ್ರವೇಶ", gu: "ઝડપી ઍક્સેસ", mr: "जलद प्रवेश" },
  ask: { en: "Ask Kais anything…", te: "Kais ని అడగండి…", hi: "Kais से पूछें…", ta: "Kais-இடம் கேளுங்கள்…", kn: "Kais ಅನ್ನು ಕೇಳಿ…", gu: "Kais ને પૂછો…", mr: "Kais ला विचारा…" },
};
function T(k) { const l = (typeof S !== "undefined" && S.settings?.lang) || "en"; return STR[k]?.[l] || STR[k]?.en || k; }
