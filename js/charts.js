// Chart kit, fitness-app style (Apple Health / Fitness, Oura): capsule bars with soft tracks, a dashed goal line and
// a tap-to-read value bubble; smooth area charts with a gradient fill and a highlighted latest point; concentric
// activity rings with round caps. All return HTML strings; one delegated listener handles taps.

let CH_ID = 0;

// Range colours: green when on track, amber when partway, red when low. good: "high" (more is better, e.g. hours
// against a goal) or "low" (less is better, e.g. spend). "accent" keeps the brand colour.
const RANGE_C = { good: "var(--ok)", mid: "#f5a524", low: "var(--danger)" };
function rangeColor(r, good = "high") { const x = good === "low" ? 1 - r : r; return x >= 0.75 ? RANGE_C.good : x >= 0.4 ? RANGE_C.mid : RANGE_C.low; }

/** Vertical capsule bars. values: numbers; labels: short x labels; active: index highlighted (e.g. today). */
function capsuleBars({ values, labels, max, goal, goalLabel, active = values.length - 1, fmt = (v) => String(v), height = 132, future = [], tone = "high" }) {
  const top = Math.max(max || 0, ...values, goal || 0) || 1;
  const pct = (v) => Math.max(0, Math.min(100, (v / top) * 100));
  return `<div class="ch-bars" style="--h:${height}px" data-chart="bars">
    ${goal ? `<span class="ch-goal" style="bottom:calc(18px + (var(--h) + 4px) * ${(pct(goal) / 100).toFixed(4)})"><em>${esc(goalLabel || fmt(goal))}</em></span>` : ""}
    ${values.map((v, i) => `<button type="button" class="ch-col ${i === active ? "on" : ""} ${future.includes(i) ? "future" : ""} ${goal && v >= goal ? "met" : ""}" ${tone !== "accent" && v ? `style="--bc:${rangeColor(goal ? v / goal : v / top, tone)}"` : ""} data-v="${esc(fmt(v))}" aria-label="${esc(labels[i])}: ${esc(fmt(v))}">
      <span class="ch-track"><i style="height:${v ? Math.max(6, pct(v)) : 0}%"></i></span><small>${esc(labels[i])}</small></button>`).join("")}
    <span class="ch-tip" aria-hidden="true"></span>
  </div>`;
}

/** Smooth area chart (monotone curve) with gradient fill; tap a point to read it. */
function areaChart({ values, labels, fmt = (v) => String(v), height = 128, color = "trend" }) {
  const id = "ch" + CH_ID++, W = 320, H = height, P = 14, n = values.length;
  if (color === "trend") { const a = values[0], b = values[n - 1]; color = b >= a * 1.01 ? RANGE_C.good : b <= a * 0.97 ? RANGE_C.low : RANGE_C.mid; }
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const x = (i) => P + (i * (W - 2 * P)) / Math.max(1, n - 1), y = (v) => H - 22 - ((v - lo) / span) * (H - 48);
  const pts = values.map((v, i) => [x(i), y(v)]);
  // monotone cubic (Fritsch–Carlson) so the curve never overshoots the data
  const d = (() => {
    if (n < 2) return `M${pts[0][0]},${pts[0][1]}`;
    const s = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / (p[0] - pts[i][0]));
    const m = pts.map((_, i) => (i === 0 ? s[0] : i === n - 1 ? s[n - 2] : s[i - 1] * s[i] <= 0 ? 0 : (s[i - 1] + s[i]) / 2));
    let path = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 0; i < n - 1; i++) { const h = pts[i + 1][0] - pts[i][0]; path += ` C${pts[i][0] + h / 3},${pts[i][1] + (m[i] * h) / 3} ${pts[i + 1][0] - h / 3},${pts[i + 1][1] - (m[i + 1] * h) / 3} ${pts[i + 1][0]},${pts[i + 1][1]}`; }
    return path;
  })();
  const last = pts[n - 1];
  return `<div class="ch-area" data-chart="area" style="--c:${color}">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${color};stop-opacity:.28"/><stop offset="1" style="stop-color:${color};stop-opacity:0"/></linearGradient></defs>
      ${[0.25, 0.5, 0.75].map((g) => `<line x1="${P}" x2="${W - P}" y1="${(H - 22) * g + 6}" y2="${(H - 22) * g + 6}" class="ch-grid"/>`).join("")}
      <path d="${d} L${last[0]},${H - 22} L${pts[0][0]},${H - 22} Z" fill="url(#${id})"/>
      <path d="${d}" fill="none" style="stroke:${color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    </svg>
    ${pts.map((p, i) => `<button type="button" class="ch-pt ${i === n - 1 ? "on" : ""}" style="left:${(p[0] / W) * 100}%;top:${(p[1] / H) * 100}%" data-v="${esc(fmt(values[i]))}" data-l="${esc(labels[i])}" aria-label="${esc(labels[i])}: ${esc(fmt(values[i]))}"></button>`).join("")}
    <div class="ch-x">${labels.map((l, i) => `<small style="left:${(x(i) / W) * 100}%">${esc(l)}</small>`).join("")}</div>
    <span class="ch-tip on" style="left:${(last[0] / W) * 100}%;top:${(last[1] / H) * 100}%">${esc(fmt(values[n - 1]))}</span>
  </div>`;
}

/** Concentric activity rings. rings: [{ p: 0..1, color }], outermost first. */
function activityRings(rings, size = 86, stroke = 9, gap = 3) {
  const c = size / 2;
  return `<svg class="ch-rings" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">${rings.map((r, i) => {
    const R = c - stroke / 2 - i * (stroke + gap), C = 2 * Math.PI * R, len = Math.max(0.001, Math.min(1, r.p)) * C;
    return `<circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke-width="${stroke}" style="stroke:${r.color};opacity:.18"/>
      <circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke-width="${stroke}" stroke-linecap="round" style="stroke:${r.color}" stroke-dasharray="${len.toFixed(2)} ${C.toFixed(2)}" transform="rotate(-90 ${c} ${c})"/>`;
  }).join("")}</svg>`;
}

// taps: bars show a value bubble over the tapped column; area points move the tooltip
document.addEventListener("click", (e) => {
  const col = e.target.closest(".ch-col");
  if (col) {
    e.preventDefault(); e.stopPropagation();
    const box = col.closest(".ch-bars");
    box.querySelectorAll(".ch-col").forEach((c) => c.classList.toggle("on", c === col));
    const tip = box.querySelector(".ch-tip"), fill = col.querySelector("i"), r = col.getBoundingClientRect(), b = box.getBoundingClientRect(), f = fill.getBoundingClientRect();
    const k = b.width / box.offsetWidth || 1;
    tip.textContent = col.dataset.v; tip.style.left = `${(r.left - b.left + r.width / 2) / k}px`; tip.style.top = `${(Math.min(f.top, r.bottom - 30) - b.top) / k}px`; tip.classList.add("on");
    return;
  }
  const pt = e.target.closest(".ch-pt");
  if (pt) {
    e.preventDefault(); e.stopPropagation();
    const box = pt.closest(".ch-area"), tip = box.querySelector(".ch-tip");
    box.querySelectorAll(".ch-pt").forEach((p) => p.classList.toggle("on", p === pt));
    tip.textContent = `${pt.dataset.l} · ${pt.dataset.v}`; tip.style.left = pt.style.left; tip.style.top = pt.style.top; tip.classList.add("on");
  }
}, true);

/** Single progress ring with rounded ends and a centred label (the classic ring, curved). */
function progressRing(p, { size = 56, stroke = 6, color = "var(--ok)", label = "" } = {}) {
  const c = size / 2, R = c - stroke / 2, C = 2 * Math.PI * R, len = Math.max(0.001, Math.min(1, p)) * C;
  return `<span class="ch-pring" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke-width="${stroke}" style="stroke:var(--panel-2)"/>
    <circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke-width="${stroke}" stroke-linecap="round" style="stroke:${color}" stroke-dasharray="${len.toFixed(2)} ${C.toFixed(2)}" transform="rotate(-90 ${c} ${c})"/>
  </svg><b>${label}</b></span>`;
}

// Every classic progress ring (.ring with --p and --t) gets an SVG arc with rounded ends drawn over its track.
function curveRings(root = document) {
  root.querySelectorAll(".ring:not(.curved)").forEach((el) => {
    const st = el.getAttribute("style") || "", p = parseFloat((st.match(/--p:\s*([\d.]+)/) || [])[1]);
    if (isNaN(p)) return;
    const col = (st.match(/--t:\s*([^;]+)/) || [])[1] || "var(--t, var(--accent))";
    const size = 100, sw = el.classList.contains("lg") ? 11 : 10, R = (size - sw) / 2, C = 2 * Math.PI * R, len = Math.max(0.001, Math.min(100, p) / 100) * C;
    el.insertAdjacentHTML("afterbegin", `<svg class="ring-arc" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="50" cy="50" r="${R}" fill="none" stroke-width="${sw}" style="stroke:var(--panel-2)"/>${p > 0 ? `<circle cx="50" cy="50" r="${R}" fill="none" stroke-width="${sw}" stroke-linecap="round" style="stroke:${col}" stroke-dasharray="${len.toFixed(2)} ${C.toFixed(2)}" transform="rotate(-90 50 50)"/>` : ""}</svg>`);
    el.classList.add("curved");
  });
}
let RING_Q = 0;
new MutationObserver(() => { if (!RING_Q) RING_Q = requestAnimationFrame(() => { RING_Q = 0; curveRings(); }); }).observe(document.getElementById("shell") || document.body, { childList: true, subtree: true });
