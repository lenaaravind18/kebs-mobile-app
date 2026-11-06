// Built-in iOS-style keyboard for the iPhone mockup on wide screens (≥620px). When a text field inside the
// phone gets focus, the keyboard slides up inside the device, the screen shrinks above it (sheets too), and
// taps type into the field. The real keyboard keeps working alongside it. Phones use their own keyboard.
(() => {
  const wide = matchMedia("(min-width: 620px)");
  const shell = document.getElementById("shell");
  const KB_H = 268;
  const LAYOUTS = {
    abc: [["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"], ["a", "s", "d", "f", "g", "h", "j", "k", "l"], ["⇧", "z", "x", "c", "v", "b", "n", "m", "⌫"]],
    num: [["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"], ["-", "/", ":", ";", "(", ")", "₹", "&", "@", "\""], ["#+=", ".", ",", "?", "!", "'", "⌫"]],
    sym: [["[", "]", "{", "}", "#", "%", "^", "*", "+", "="], ["_", "\\", "|", "~", "<", ">", "$", "€", "£", "•"], ["123", ".", ",", "?", "!", "'", "⌫"]],
  };
  let layer = "abc", shift = 1, lastShift = 0, field = null, hideT = 0;

  const el = document.createElement("div");
  el.className = "vkb";
  el.setAttribute("aria-hidden", "true");
  shell.appendChild(el);

  // only the Kais chat box opens the mockup keyboard; every other field just takes the real keyboard
  const typable = (t) => !!t && !t.disabled && !t.readOnly && shell.contains(t) && !!t.closest?.(".kcomposer") && t.matches("textarea, input");
  const returnLabel = () => {
    if (!field) return "return";
    if (field.closest(".kcomposer")) return "send";
    if (field.type === "search" || field.enterKeyHint === "search" || field.matches("[data-search]")) return "search";
    if (field.tagName === "TEXTAREA") return "return";
    return field.enterKeyHint === "send" ? "send" : field.form ? "go" : "done";
  };
  const autoShift = () => {
    if (!field || layer !== "abc" || shift === 2) return;
    const v = field.value ?? field.textContent ?? "", pos = field.selectionStart ?? v.length;
    const before = v.slice(0, pos);
    shift = !before.trim() || /[.!?]\s$/.test(before) || /\n$/.test(before) ? 1 : 0;
  };

  function draw() {
    const rows = LAYOUTS[layer];
    const key = (k) => {
      const cls = k === "⇧" ? `fn shift ${shift ? "on" : ""} ${shift === 2 ? "lock" : ""}` : k === "⌫" ? "fn del" : k === "#+=" || k === "123" ? "fn" : "ch";
      const label = k === "⇧" ? `<svg viewBox="0 0 24 24"><path d="M12 4 3.5 12.5H8V20h8v-7.5h4.5Z" fill="${shift ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>${shift === 2 ? '<path d="M8 22h8" stroke="currentColor" stroke-width="1.6"/>' : ""}</svg>`
        : k === "⌫" ? `<svg viewBox="0 0 24 24"><path d="M9 5h11a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 20 19H9l-6.5-7Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m11.5 9.5 5 5m0-5-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`
        : layer === "abc" && shift ? k.toUpperCase() : k;
      return `<button type="button" class="vk ${cls}" data-k="${k === "\"" ? "&quot;" : k}" tabindex="-1">${label}</button>`;
    };
    const ret = returnLabel();
    el.innerHTML = `<div class="vkb-bar"><span class="vkb-sug">${layer === "abc" ? '<i>I</i><i>The</i><i>I’m</i>' : ""}</span><button type="button" class="vkb-done" data-k="done" tabindex="-1">Done</button></div>
      ${rows.map((r, i) => `<div class="vkb-row r${i}">${r.map(key).join("")}</div>`).join("")}
      <div class="vkb-row r3"><button type="button" class="vk fn mode" data-k="${layer === "abc" ? "123" : "ABC"}" tabindex="-1">${layer === "abc" ? "123" : "ABC"}</button><button type="button" class="vk fn emo" data-k="🙂" tabindex="-1"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="9.3" cy="10" r="1.1" fill="currentColor"/><circle cx="14.7" cy="10" r="1.1" fill="currentColor"/><path d="M8.6 14c.9 1.4 2 2 3.4 2s2.5-.6 3.4-2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button><button type="button" class="vk space" data-k=" " tabindex="-1">space</button><button type="button" class="vk fn ret ${ret !== "return" ? "go" : ""}" data-k="enter" tabindex="-1">${ret}</button></div>`;
  }

  function show(t) {
    clearTimeout(hideT);
    if (field === t && el.classList.contains("on")) return;
    field = t; layer = t.type === "number" || t.type === "tel" || t.inputMode === "numeric" ? "num" : "abc";
    autoShift(); draw();
    shell.style.setProperty("--kbh", KB_H + "px");
    shell.classList.add("kb-vis"); document.documentElement.classList.add("kb-open");
    el.classList.add("on");
    setTimeout(() => { const sc = t.closest(".scroll, .sheet-body, .sheet"); if (!sc) return; const r = t.getBoundingClientRect(), s = sc.getBoundingClientRect(); if (r.bottom > s.bottom - 12 || r.top < s.top) sc.scrollBy({ top: (r.top + r.height / 2 - (s.top + s.height / 2)) / (parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--s")) || 1), behavior: "smooth" }); }, 260);
  }
  function hide() {
    el.classList.remove("on"); field = null;
    shell.classList.remove("kb-vis"); document.documentElement.classList.remove("kb-open");
  }

  // edit the focused field so the app's own input handlers run
  const fire = (t, data, type) => t.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: type, data }));
  function insert(text) {
    const t = field; if (!t) return;
    if (t.isContentEditable) { document.execCommand("insertText", false, text); return; }
    try {
      const s = t.selectionStart, e = t.selectionEnd;
      t.setRangeText(text, s, e, "end");
    } catch { t.value += text; }
    fire(t, text, "insertText");
  }
  function backspace() {
    const t = field; if (!t) return;
    if (t.isContentEditable) { document.execCommand("delete"); return; }
    try {
      const s = t.selectionStart, e = t.selectionEnd;
      if (s === e && s > 0) { const cut = /[\uD800-\uDBFF][\uDC00-\uDFFF]$/.test(t.value.slice(0, s)) ? 2 : 1; t.setRangeText("", s - cut, s, "end"); }
      else if (s !== e) t.setRangeText("", s, e, "end");
    } catch { t.value = t.value.slice(0, -1); }
    fire(t, null, "deleteContentBackward");
  }
  function enter() {
    const t = field; if (!t) return;
    const ev = new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true });
    const go = t.dispatchEvent(ev);
    if (!go) return;
    if (t.tagName === "TEXTAREA" || t.isContentEditable) insert("\n");
    else if (t.form) t.form.requestSubmit();
    else t.blur();
  }

  // keys: pointerdown keeps focus in the field; repeat delete while held
  let rep = 0;
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    const b = e.target.closest("[data-k]"); if (!b || !field) return;
    b.classList.add("down");
    const k = b.dataset.k;
    if (k === "⌫") { backspace(); rep = setTimeout(function again() { backspace(); rep = setTimeout(again, 70); }, 420); }
  });
  const up = (e) => {
    clearTimeout(rep);
    const b = e.target.closest?.("[data-k]"); el.querySelectorAll(".down").forEach((x) => x.classList.remove("down"));
    if (!b || !field || e.type !== "pointerup") return;
    const k = b.dataset.k;
    if (k === "⌫") { autoShift(); draw(); return; }
    if (k === "done") { field.blur(); return; }
    if (k === "⇧") { const now = Date.now(); shift = shift && now - lastShift < 320 ? 2 : shift ? 0 : 1; lastShift = now; draw(); return; }
    if (k === "123") { layer = "num"; draw(); return; }
    if (k === "ABC") { layer = "abc"; autoShift(); draw(); return; }
    if (k === "#+=") { layer = "sym"; draw(); return; }
    if (k === "enter") { enter(); if (field) { autoShift(); draw(); } return; }
    insert(layer === "abc" && shift ? k.toUpperCase() : k);
    if (shift === 1) shift = 0;
    if (k === " " && layer !== "abc") layer = "abc";
    autoShift(); draw();
  };
  el.addEventListener("pointerup", up);
  el.addEventListener("pointerleave", up);
  el.addEventListener("mousedown", (e) => e.preventDefault());

  document.addEventListener("focusin", (e) => { if (wide.matches && typable(e.target)) show(e.target); });
  document.addEventListener("focusout", () => { hideT = setTimeout(() => { if (!typable(document.activeElement)) hide(); }, 90); });
  // real keyboard typing keeps the suggestion/shift state in step
  document.addEventListener("input", (e) => { if (field && e.target === field && el.classList.contains("on") && e.isTrusted) { autoShift(); draw(); } });
  wide.addEventListener?.("change", () => { if (!wide.matches) hide(); });
  // route changes replace the field
  addEventListener("hashchange", () => setTimeout(() => { if (!typable(document.activeElement)) hide(); }, 120));
})();
