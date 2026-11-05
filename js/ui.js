// UI primitives: routing registry, headers, sheets, toasts, pickers
const ROUTES = [];
const ACTIONS = {};
let DRAFT = null; // form draft for the current screen; cleared on navigation
function route(pattern, render, opts = {}) {
  ROUTES.push({ re: new RegExp("^" + pattern.replace(/:(\w+)/g, "(?<$1>[^/]+)") + "$"), render, ...opts });
}
function act(name, fn) { ACTIONS[name] = fn; }
function draft(key, defaults) { if (!DRAFT || DRAFT._k !== key) DRAFT = { _k: key, ...defaults }; return DRAFT; }

function topbar(title, { back = true, sub = "", right = "", left = "" } = {}) {
  const l = left || (back ? `<button class="ib" data-act="back" aria-label="Back">${I("back")}</button>` : `<span class="spacer"></span>`);
  return `<header class="top"><div class="pill">${l}<div class="ttl">${sub ? `<small>${esc(sub)}</small>` : ""}${title}</div>${right || `<span class="spacer"></span>`}</div></header>`;
}
const seg = (items, value, actName) => `<div class="seg-wrap"><div class="seg" role="tablist">${items.map(([v, l]) => `<button role="tab" class="${v === value ? "on" : ""}" aria-selected="${v === value}" data-act="${actName}" data-v="${v}">${l}</button>`).join("")}</div></div>`;
const emptyState = (icons, title, text, extra = "") => `<div class="empty"><div class="empty-art">${icons.map((n) => I(n)).join("")}</div><h3>${title}</h3><p>${text}</p>${extra}</div>`;
const statusChip = (s) => ({ pending: `<span class="chip warn">Pending</span>`, approved: `<span class="chip ok">Approved</span>`, rejected: `<span class="chip bad">Rejected</span>`, withdrawn: `<span class="chip">Withdrawn</span>`, draft: `<span class="chip">Not submitted</span>`, open: `<span class="chip acc">Open</span>`, resolved: `<span class="chip ok">Resolved</span>` }[s] || `<span class="chip">${esc(s)}</span>`);
const fmtSize = (b) => (b > 1e6 ? (b / 1e6).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1e3)) + " KB");

// ── sheets ──
const sheets = [];
function openSheet({ title = "", body = "", foot = "", cls = "", raw = null, onMount, onClose }) {
  const layer = $("#layer");
  const scrim = document.createElement("div"); scrim.className = "scrim";
  const el = document.createElement("section"); el.className = "sheet " + cls; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true");
  el.innerHTML = raw ?? `<div class="grab"></div><div class="sheet-head"><h3>${title}</h3><button class="ib sm" data-sheet-close aria-label="Close">${I("x")}</button></div><div class="sheet-body">${body}</div>${foot ? `<div class="sheet-foot">${foot}</div>` : ""}`;
  layer.append(scrim, el);
  const s = { el, scrim, onClose };
  sheets.push(s);
  scrim.addEventListener("click", () => closeSheet(s));
  el.addEventListener("click", (e) => { if (e.target.closest("[data-sheet-close]")) closeSheet(s); });
  onMount?.(el, s);
  setTimeout(() => el.querySelector("[autofocus]")?.focus(), 60);
  return s;
}
function closeSheet(s = sheets[sheets.length - 1]) {
  const i = sheets.indexOf(s); if (i < 0) return;
  sheets.splice(i, 1);
  s.el.classList.add("closing"); s.scrim.classList.add("closing");
  setTimeout(() => { s.el.remove(); s.scrim.remove(); }, 220);
  s.onClose?.();
}
function closeAllSheets() { while (sheets.length) closeSheet(); }
// local actions inside a sheet: data-s="name"
function onS(el, handlers) {
  el.addEventListener("click", (e) => { const b = e.target.closest("[data-s]"); if (b && el.contains(b) && handlers[b.dataset.s]) handlers[b.dataset.s](b, e); });
}

function toast(msg, kind = "ok") {
  const t = document.createElement("div");
  t.className = "toast " + kind;
  t.innerHTML = I(kind === "bad" ? "alert" : kind === "info" ? "info" : "checkCircle") + `<span>${esc(msg)}</span>`;
  $("#toasts").append(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 260); }, 2600);
}

function confirmSheet({ eyebrow = "", text, ok = "Confirm", danger = false, onOk }) {
  const s = openSheet({
    title: `<span class="eyebrow" style="color:${danger ? "var(--danger)" : "var(--accent)"}">${esc(eyebrow)}</span>`,
    body: `<p style="font-size:17px;font-weight:600;letter-spacing:-.3px">${text}</p>`,
    foot: `<button class="btn ${danger ? "danger" : "primary"} block" data-s="ok">${esc(ok)}</button>`,
    onMount(el) { onS(el, { ok() { closeSheet(s); onOk(); } }); },
  });
}

function pickOption({ title, options, value, onPick }) {
  const s = openSheet({
    title,
    body: `<div class="list">${options.map((o) => `<button class="opt-row" data-s="pick" data-v="${esc(o.v)}">${o.icon ? `<span class="ic">${I(o.icon)}</span>` : ""}<span class="grow"><span class="b">${esc(o.label)}</span>${o.sub ? `<span class="small muted" style="display:block">${esc(o.sub)}</span>` : ""}</span>${o.v === value ? `<span class="tick">${I("check")}</span>` : ""}</button>`).join("")}</div>`,
    onMount(el) { onS(el, { pick(b) { closeSheet(s); onPick(b.dataset.v); } }); },
  });
}

function pickPeople({ title = "Notify teammates", selected = [], onDone }) {
  let sel = new Set(selected), q = "";
  const s = openSheet({
    title,
    body: `<div class="searchbox" style="margin-bottom:8px">${I("search")}<input placeholder="Search people" data-q autofocus></div><div class="list" data-list></div>`,
    foot: `<button class="btn primary block" data-s="done">Done</button>`,
    onMount(el) {
      const draw = () => {
        const list = S.people.filter((p) => p.name.toLowerCase().includes(q));
        el.querySelector("[data-list]").innerHTML = list.map((p) => `<label class="li" style="cursor:pointer">${avatar(p.id, "sm")}<span class="grow"><span class="t" style="display:block">${esc(p.name)}</span><span class="s">${esc(p.role)}</span></span><input type="checkbox" class="check" value="${p.id}" ${sel.has(p.id) ? "checked" : ""}></label>`).join("") || `<p class="muted small" style="padding:12px 4px">No one matches “${esc(q)}”.</p>`;
        el.querySelector("[data-s=done]").textContent = sel.size ? `Add ${plural(sel.size, "person").replace("persons", "people")}` : "Done";
      };
      el.addEventListener("input", (e) => { if (e.target.matches("[data-q]")) { q = e.target.value.toLowerCase(); draw(); } });
      el.addEventListener("change", (e) => { if (e.target.matches(".check")) { e.target.checked ? sel.add(e.target.value) : sel.delete(e.target.value); draw(); } });
      onS(el, { done() { closeSheet(s); onDone([...sel]); } });
      draw();
    },
  });
}

function pickDates({ title = "Select date", mode = "range", start = null, end = null, half = false, dayType = "full", onDone }) {
  let month = (start || D.today()).slice(0, 8) + "01", st = start, en = end, dt = dayType;
  const hol = new Set(holidays().map((h) => h.date));
  const today = D.today();
  const s = openSheet({
    title, cls: "",
    body: `<div data-cal></div>`,
    foot: `<button class="btn primary block" data-s="done"></button>`,
    onMount(el) {
      const draw = () => {
        const first = D.parse(month), y = first.getFullYear(), m = first.getMonth();
        const lead = (first.getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate();
        const e2 = en || st;
        let cells = "";
        for (let i = 0; i < lead; i++) cells += `<span></span>`;
        for (let d = 1; d <= dim; d++) {
          const iso = `${month.slice(0, 8)}${String(d).padStart(2, "0")}`;
          const c = [iso === today && "today", hol.has(iso) && "hol", st && iso === st && "s", st && iso === e2 && "e", st && iso > st && iso < e2 && "in"].filter(Boolean).join(" ");
          cells += `<button class="${c}" data-s="day" data-d="${iso}"><span>${d}</span></button>`;
        }
        const multi = st && e2 && e2 !== st;
        const box = mode === "range"
          ? `<div class="range-box" style="margin-bottom:14px"><div><div class="k">Start date</div><div class="v ${st ? "" : "ph"}">${st ? D.long(st) : "Pick a date"}</div></div><span class="mid">${st ? plural(dt === "half" && !multi ? 0.5 : D.days(st, e2), "day") : "To"}</span><div><div class="k">End date</div><div class="v ${en || st ? "" : "ph"}">${e2 ? D.long(e2) : "Pick a date"}</div></div></div>`
          : `<div class="range-box" style="margin-bottom:14px;grid-template-columns:1fr"><div><div class="k">Selected day</div><div class="v ${st ? "" : "ph"}">${st ? D.nice(st) : "Pick a date"}</div></div></div>`;
        el.querySelector("[data-cal]").innerHTML = `${box}
          <div class="card"><div class="cal-head"><button class="ib sm" data-s="prev" aria-label="Previous month">${I("chevL")}</button><b>${first.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</b><button class="ib sm" data-s="next" aria-label="Next month">${I("chevR")}</button></div>
          <div class="cal">${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((x) => `<span class="dn">${x}</span>`).join("")}${cells}</div>
          ${half ? `<div class="choices" style="margin-top:12px"><button class="choice ${dt === "full" ? "on" : ""}" data-s="dt" data-v="full">Full day</button><button class="choice ${dt === "half" ? "on" : ""}" data-s="dt" data-v="half" ${multi ? "disabled style='opacity:.4'" : ""}>Half day</button></div>` : ""}
          <p class="tiny faint" style="margin-top:10px">${mode === "range" ? "Tap a start date, then an end date. " : ""}Dots mark public holidays.</p></div>`;
        const btn = el.querySelector("[data-s=done]");
        btn.disabled = !st;
        btn.textContent = st ? (mode === "range" ? `Selected dates: ${D.range(st, e2)}` : `Select ${D.short(st)}`) : "Select date";
      };
      onS(el, {
        prev() { month = D.addMonths(month, -1); draw(); },
        next() { month = D.addMonths(month, 1); draw(); },
        day(b) { const d = b.dataset.d; if (mode === "single") st = en = d; else if (!st || en || d < st) { st = d; en = null; } else en = d; if (en && en !== st) dt = "full"; draw(); },
        dt(b) { if (!b.disabled) { dt = b.dataset.v; draw(); } },
        done() { if (!st) return; closeSheet(s); onDone({ start: st, end: en || st, dayType: dt }); },
      });
      draw();
    },
  });
}

function pickFile(accept, cb) {
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = accept; inp.multiple = true;
  inp.onchange = () => { [...inp.files].forEach((f) => cb({ name: f.name, size: fmtSize(f.size), bytes: f.size, type: f.type })); };
  inp.click();
}

// shared form bits
function rangeField(k, from, to, { label = "Select", dayType } = {}) {
  if (!from) return `<button class="range-box" data-act="${k}" style="grid-template-columns:1fr auto"><div><div class="k">${esc(label.toUpperCase())}</div><div class="v" style="color:var(--accent)">Start to end date</div></div>${I("calendar")}</button>`;
  return `<button class="range-box" data-act="${k}"><div><div class="k">Start date</div><div class="v">${D.long(from)}</div></div><span class="mid">${dayType === "half" ? "½ day" : plural(D.days(from, to), "day")}</span><div><div class="k">End date</div><div class="v">${D.long(to)}</div></div></button>`;
}
function notifyField(ids, actName, note) {
  return `<div class="stack s6"><span class="lbl">Notify your teammates</span><span class="small muted">${note}</span>
    <div class="add-person" style="margin-top:6px">${ids.map((id) => `<span class="slot">${avatar(id)}<span class="ell" style="max-width:52px">${esc(person(id).name.split(" ")[0])}</span></span>`).join("")}<button class="slot" data-act="${actName}"><span class="plus">${I("plus")}</span>${ids.length ? "Edit" : "Add"}</button></div></div>`;
}
function alsoAway(from, to, kind) {
  if (!from) return `<div class="hrow"><span class="av sm" style="background:var(--panel-2);color:var(--ink-3)">${I("users")}</span><span class="small muted">Select a date above to see who is on ${kind} during the same period.</span></div>`;
  const off = S.offThisWeek.list.filter((o) => o.date >= from && o.date <= to);
  if (!off.length) return `<div class="hrow"><span class="av sm" style="background:var(--panel-2);color:var(--ink-3)">${I("users")}</span><span class="small muted">Nobody is on ${kind} during this period.</span></div>`;
  return `<div class="hrow"><div class="av-stack">${off.map((o) => avatar(o.id, "sm")).join("")}</div><span class="small muted">${off.map((o) => esc(person(o.id).name.split(" ")[0])).join(", ")} ${off.length > 1 ? "are" : "is"} away in this period.</span></div>`;
}
// Tesla CRM 3D file-type icon: page with folded corner + raised glossy badge in the format's colour
const FILE_KINDS = { pdf: ["PDF", "#F0453F", "#C8161B", "#9E1014"], xlsx: ["X", "#2A8A55", "#185C37", "#10462A"], docx: ["W", "#3E6FC0", "#214A8C", "#183A70"], pptx: ["P", "#DD5530", "#B03516", "#8A2810"], image: ["IMG", "#22A39A", "#127A72", "#0C5E58"], file: ["FILE", "#8A8F98", "#5F646D", "#4A4E55"] };
const FILE_EXT = { pdf: "pdf", xls: "xlsx", xlsx: "xlsx", csv: "xlsx", doc: "docx", docx: "docx", ppt: "pptx", pptx: "pptx", jpg: "image", jpeg: "image", png: "image", heic: "image", webp: "image", gif: "image" };
let FIC_ID = 0;
function fileIcon(name = "") {
  const [letter, from, to, edge] = FILE_KINDS[FILE_EXT[name.split(".").pop().toLowerCase()] || "file"];
  const id = "fic" + FIC_ID++, w = letter.length === 1 ? 17 : letter.length === 3 ? 25 : 29, fs = letter.length === 1 ? 11 : letter.length === 3 ? 8.6 : 7.6;
  return `<span class="fic" role="img" aria-label="${esc(name)}"><svg viewBox="0 0 40 44"><defs>
    <linearGradient id="${id}p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#E3E6EB"/></linearGradient>
    <linearGradient id="${id}f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F4F5F8"/><stop offset="1" stop-color="#C4C9D1"/></linearGradient>
    <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>
    <linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
    <path d="M9 1.5h17.5L36 11v28.5a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-35a3 3 0 0 1 3-3Z" fill="url(#${id}p)" stroke="#B9BEC7" stroke-width=".75"/>
    <path d="M9.6 2.4h16.4" stroke="#fff" stroke-width=".9" stroke-linecap="round" opacity=".9"/>
    <path d="M26.5 1.5V8.5a2.5 2.5 0 0 0 2.5 2.5H36Z" fill="url(#${id}f)" stroke="#B9BEC7" stroke-width=".75" stroke-linejoin="round"/>
    <g opacity=".55"><rect x="19" y="16" width="12" height="1.6" rx=".8" fill="${to}" opacity=".35"/><rect x="19" y="20.5" width="12" height="1.6" rx=".8" fill="#AEB4BE"/><rect x="19" y="25" width="9" height="1.6" rx=".8" fill="#AEB4BE"/></g>
    <rect x="1.5" y="17.5" width="${w}" height="17" rx="3" fill="${edge}"/><rect x="1.5" y="16" width="${w}" height="17" rx="3" fill="url(#${id}b)"/><rect x="1.5" y="16" width="${w}" height="8.5" rx="3" fill="url(#${id}s)"/>
    <text x="${1.5 + w / 2}" y="28.6" text-anchor="middle" fill="#fff" font-family="-apple-system, SF Pro Text, Inter, Segoe UI, Arial, sans-serif" font-weight="800" font-size="${fs}">${letter}</text></svg></span>`;
}
function attachList(list, removeAct) {
  return list.map((a, i) => `<div class="attach">${fileIcon(a.name)}<span class="grow"><span class="b ell" style="display:block">${esc(a.name)}</span><span class="tiny muted">${esc(a.size || "")}</span></span>${removeAct ? `<button class="ib sm" style="color:var(--danger)" data-act="${removeAct}" data-i="${i}" aria-label="Remove">${I("trash")}</button>` : ""}</div>`).join("");
}
