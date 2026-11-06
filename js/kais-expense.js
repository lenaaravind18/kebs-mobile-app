// Kais: file an expense claim by chatting.
// "Claim my cab fare of ₹450 yesterday" → Kais fills what it understood and asks only for what's missing:
// receipt → amount → category → date → what it was for → cost centre → summary card (submit / save / add another).
// State lives on the chat (c.xf) so the conversation can continue across messages.

const KX_CAT_WORDS = [
  ["Local conveyance", /\b(cab|taxi|uber|ola|auto|rapido|metro|parking|fuel|petrol|diesel|toll|conveyance|commute|ride)\b/],
  ["Travel", /\b(flight|air ?ticket|airline|indigo|vistara|train|irctc|bus ticket|travel|trip|visa)\b/],
  ["Food & Beverages", /\b(food|lunch|dinner|breakfast|coffee|tea|snacks?|meals?|restaurant|starbucks|swiggy|zomato|team lunch)\b/],
  ["Accommodation", /\b(hotel|stay|lodging|airbnb|room|guest ?house)\b/],
  ["Internet", /\b(internet|wi-?fi|broadband|data pack|mobile bill|phone bill|recharge)\b/],
  ["Software", /\b(software|subscription|licen[cs]e|figma|saas|tool|app plan)\b/],
  ["Other", /\b(other|misc|miscellaneous|stationery|courier)\b/],
];
const kxStartIntent = (t) =>
  /\b(apply|file|raise|submit|create|make|start|log|add|new|record|upload|scan)\b.{0,30}\b(expense|claim|bill|receipt|reimburse?ment)s?\b/.test(t)
  || /\b(claim|reimburse)\b.{0,5}\b(my|for|the|a|an)\b/.test(t) || /^(claim|reimburse me)\b/.test(t) || /\bexpense (claim|for)\b/.test(t);

function kxAmount(t, loose) {
  const cur = /\$|usd|dollar/.test(t) ? "USD" : /€|eur/.test(t) ? "EUR" : /£|gbp|pound/.test(t) ? "GBP" : "INR";
  const re = loose ? /(?:₹|rs\.?|inr|\$|usd|€|eur|£|gbp)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k\b)?/i
    : /(?:₹|rs\.?\s*|inr\s*|\$|usd\s*|€|eur\s*|£|gbp\s*)(\d[\d,]*(?:\.\d+)?)\s*(k\b)?|(\d[\d,]*(?:\.\d+)?)\s*(k\b)?\s*(?:rs|rupees|inr|usd|dollars|bucks)\b|\b(?:for|of|spent|paid|cost|worth|amount)\s+(?:₹|rs\.?\s*|\$)?(\d[\d,]*(?:\.\d+)?)\s*(k\b)?/i;
  const m = t.match(re); if (!m) return null;
  const raw = m[1] || m[3] || m[5], k = m[2] || m[4] || m[6];
  const n = parseFloat(String(raw).replace(/,/g, "")) * (k ? 1000 : 1);
  return n > 0 ? { amt: n, cur } : null;
}
function kxCat(t) {
  const exact = EXP_CATS.find((c) => t === c.id.toLowerCase()); if (exact) return exact.id;
  return KX_CAT_WORDS.find(([, re]) => re.test(t))?.[0] || null;
}
const KX_MON = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
function kxDate(t) {
  const today = D.today();
  if (/\btoday\b/.test(t)) return today;
  if (/day before yesterday/.test(t)) return D.add(today, -2);
  if (/\byesterday\b/.test(t)) return D.add(today, -1);
  let m = t.match(/\b(\d+)\s+days?\s+ago\b/); if (m) return D.add(today, -Number(m[1]));
  if (/last week/.test(t)) return D.add(today, -7);
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const wi = days.findIndex((d) => t.includes(d));
  if (wi >= 0) { let d = D.add(today, -1); while (D.wd(d) !== wi) d = D.add(d, -1); return d; } // the most recent one
  m = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const y = Number(today.slice(0, 4));
  const pick = (d, mo) => { if (d < 1 || d > 31 || mo < 0) return null; let iso = `${y}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; if (iso > today) iso = `${y - 1}${iso.slice(4)}`; return iso; };
  m = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/); if (m) return pick(Number(m[1]), KX_MON.indexOf(m[2]));
  m = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})\b/); if (m) return pick(Number(m[2]), KX_MON.indexOf(m[1]));
  m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?\b/); if (m) return pick(Number(m[1]), Number(m[2]) - 1);
  return null;
}
function kxCc(t, strict) {
  const exact = COST_CENTRES.find((c) => t.includes(c.id.toLowerCase()) || t.includes(c.name.toLowerCase()));
  if (exact || strict || t.split(/\s+/).length > 3) return exact || null;
  const hits = COST_CENTRES.filter((c) => c.name.toLowerCase().split(/[\s–-]+/).filter((w) => w.length > 3 && w !== "kebs").some((w) => t.includes(w)));
  return hits.length === 1 ? hits[0] : null;
}
// what the person said up front: "claim my uber of ₹480 from yesterday for the Zifo visit"
function kxParse(x, text, first) {
  const t = text.toLowerCase();
  const a = kxAmount(t, false); if (a && !x.amt) { x.amt = a.amt; x.cur = a.cur; }
  const c = kxCat(t); if (c && !x.cat) x.cat = c;
  const d = kxDate(t); if (d && !x.date) x.date = d;
  if (first) {
    const m = text.match(/\b(?:at|from)\s+([A-Z][\w&'’.-]*(?:\s+[A-Z][\w&'’.-]*){0,3})/); if (m && !x.merchant) x.merchant = m[1];
    const f = text.match(/\bfor\s+(?:the\s+|a\s+|my\s+)?((?![₹$\d])[^,.]{4,60})/i); if (f && !x.desc && !/\b(expense|claim|reimburs|bill|receipt)/i.test(f[1])) x.desc = f[1].trim();
  }
}

const kxMissing = (f) => {
  const x = f.cur;
  if (!f.mode) return "mode";
  if (!x.file && !x.noReceipt) return "receipt";
  if (!(x.amt > 0)) return "amt";
  if (!x.cat) return "cat";
  if (!x.date) return "date";
  if (!x.desc && !x.merchant) return "desc";
  if (f.mode === "multi" && !f.allIn) return "more";
  if (!f.cc) return "cc";
  return "sum";
};
const kxItem = (x) => ({ ...x, inr: Math.round(x.amt * (CUR[x.cur || "INR"] || 1)) });
const kxRecentCc = () => S.claims.slice().sort((a, b) => (b.created || 0) - (a.created || 0)).map((c) => c.cc).find(Boolean);
const kxSay = (f) => { const x = f.cur; return [x.merchant || x.desc, x.amt ? fmtCur(kxItem(x).inr, x.cur || "INR") : null, x.cat, x.date ? D.short(x.date) : null].filter(Boolean).join(" · "); };

function kxAsk(c, lead = "") {
  const f = c.xf;
  const L = lead ? lead + "\n\n" : "";
  const hi = f.cur.amt && f.cur.amt * (CUR[f.cur.cur || "INR"] || 1) > HIGH_AMOUNT && !f.cur.highOk;
  if (hi) { f.step = "confirm"; return { text: `${L}**${fmtCur(f.cur.amt * (CUR[f.cur.cur || "INR"] || 1), f.cur.cur || "INR")}** is unusually high for one expense. Is that right?`, follow: ["Yes, that’s right", "No, change it"], steps: [] }; }
  const step = kxMissing(f); f.step = step;
  const n = f.items.length ? ` for expense ${f.items.length + 1}` : "";
  if (step === "mode") return { text: `${L}Is this a **single claim** (one receipt) or a **multi claim** (several receipts in one claim, like a trip)?`, card: { type: "xmode" }, follow: [], steps: [] };
  if (step === "receipt") return f.mode === "multi" && !f.items.length
    ? { text: `${L}Upload all the receipts for this claim — pick several at once and I’ll read each one.`, card: { type: "xup" }, follow: ["I don’t have receipts"], steps: [] }
    : { text: `${L}Do you have the receipt${n}? Upload a photo or PDF and I’ll read the amount, date and merchant for you.`, card: { type: "xup" }, follow: ["I don’t have a receipt"], steps: [] };
  if (step === "more") { const all = [...f.items, kxItem(f.cur)]; return { text: `${L}That’s ${plural(all.length, "receipt")} so far, **${money(all.reduce((a, y) => a + y.inr, 0))}** in total. Add another receipt, or is that all?`, follow: ["Add another receipt", "That’s all"], steps: [] }; }
  if (step === "amt") return { text: `${L}How much did you spend${n}?`, follow: ["₹250", "₹500", "₹1,000"], steps: [] };
  if (step === "cat") return { text: `${L}Which category is it?`, follow: EXP_CATS.map((x) => x.id), steps: [] };
  if (step === "date") return { text: `${L}When was it?`, follow: ["Today", "Yesterday", "2 days ago"], steps: [] };
  if (step === "desc") return { text: `${L}What was it for? A short note helps your approver — for example *Cab to the Zifo office*.`, steps: [] };
  if (step === "cc") { const r = kxRecentCc(); return { text: `${L}Which cost centre should I charge it to?${r ? ` You used **${ccName(r)}** last time.` : ""}`, follow: [...(r ? [ccName(r)] : []), ...COST_CENTRES.filter((x) => x.id !== r).map((x) => x.name)], steps: [] }; }
  const items = [...f.items, kxItem(f.cur)];
  const over = items.filter((x) => x.inr > expCat(x.cat).limit);
  return { text: `${L}Here’s your claim — ${plural(items.length, "expense")} for **${money(items.reduce((a, x) => a + x.inr, 0))}**.${over.length ? ` Heads up: ${over.map((x) => esc(x.merchant || x.desc || x.cat)).join(", ")} ${over.length > 1 ? "are" : "is"} over the policy limit, so add a reason in the note.` : ""} Submit it, or save it to finish later.`,
    card: { type: "xsum" }, follow: f.mode === "multi" ? ["Add another receipt", "Change the amount"] : ["Change the amount", "Make it a multi claim"], steps: [["receipt", "Checking each expense against policy"], ["sparkles", "Preparing your claim"]] };
}

// called by kaisRespond before the regular answers; returns null when this isn't an expense conversation
function kaisExpense(c, text) {
  const t = text.toLowerCase().trim();
  const last = c.msgs[c.msgs.length - 1];
  const files = last?.role === "user" ? last.files || [] : [];
  if (!c.xf) {
    if (text === "__xreceipt__" || !kxStartIntent(t)) return null;
    c.xf = { items: [], cur: { cur: "INR" }, cc: null, step: null, mode: null };
    kxParse(c.xf.cur, text, true);
    if (/\b(multi|multiple|several|trip|all my|receipts|bills)\b/.test(t) || files.length > 1) c.xf.mode = "multi";
    else if (/\b(single|one (bill|receipt))\b/.test(t) || c.xf.cur.amt) c.xf.mode = "single";
    if (files.length) kxTakeFiles(c.xf, files.map((n) => (typeof n === "string" ? { name: n } : n)));
    const got = kxSay(c.xf);
    const r = kxAsk(c, got ? `Sure — I’ll file that. So far I have **${got}**.` : "Sure — let’s file an expense claim.");
    r.steps = [["receipt", "Starting a new expense claim"], ["sparkles", "Picking out the details you gave"]];
    return r;
  }
  const f = c.xf, x = f.cur;
  if (/^(cancel|stop|never ?mind|forget it|exit|discard)\b/.test(t)) { delete c.xf; return { text: "Okay, I’ve dropped that claim — nothing was submitted.", follow: ["Show pending claims", "Apply for an expense"], steps: [] }; }

  // a receipt arrived (upload card, or a file attached in the composer)
  if (text === "__xreceipt__" || (files.length && f.step === "receipt")) {
    const list = text === "__xreceipt__" ? f.pendingFiles || [] : files.map((n) => (typeof n === "string" ? { name: n } : n));
    delete f.pendingFiles;
    const wrong = list.filter((y) => y && !rcFileOk(y)), okList = list.filter((y) => y && rcFileOk(y));
    if (!okList.length) return { text: `I can only read photos and PDFs — **${esc(wrong.map((y) => y.name).join(", "))}** ${wrong.length > 1 ? "aren’t" : "isn’t"} one. Try again with a photo of the receipt.`, card: { type: "xup" }, follow: ["I don’t have a receipt"], steps: [] };
    const read = kxTakeFiles(f, okList);
    const bad = read.filter((y) => y.unreadable);
    if (bad.length) {
      const r = kxAsk(c, `I couldn’t read **${esc(bad.map((y) => y.file.name).join(", "))}** — it looks blurry, dark or cut off.${read.length > bad.length ? ` The other ${plural(read.length - bad.length, "receipt")} read fine.` : ""} Retake it, or tell me the details yourself.`);
      r.follow = ["Retake photo", ...(r.follow || [])]; r.steps = [["scan", "Reading the receipt"], ["alert", "The image is too unclear to read"]];
      return r;
    }
    if (wrong.length) okList.length; // wrong ones are mentioned below
    const r = kxAsk(c, (wrong.length ? `I skipped **${esc(wrong.map((y) => y.name).join(", "))}** — only photos and PDFs work. ` : "") + (read.length > 1
      ? `I read ${read.length} receipts:\n${read.map((y) => `- **${y.merchant}** · ${fmtCur(kxItem(y).inr, y.cur || "INR")} · ${y.cat} · ${D.short(y.date)}`).join("\n")}\n\nTell me if anything’s off.`
      : `I read your receipt: **${kxSay(f)}**. Tell me if anything’s off.`));
    r.steps = [["scan", "Reading the receipt"], ["sparkles", "Extracting the amount, date and merchant"], ["tag", "Matching a category"]];
    return r;
  }

  if (/\b(retake|re-?upload|try again|another photo)\b/.test(t)) { delete x.file; delete x.unreadable; delete x.noReceipt; return kxAsk(c, "Sure — retake it in good light, with the whole receipt in the frame."); }
  if (f.step === "confirm") {
    if (/\b(yes|yeah|right|correct|confirm)\b/.test(t)) { x.highOk = true; return kxAsk(c, "Got it."); }
    const a = kxAmount(t, true);
    if (a && !/\b(no|change)\b/.test(t)) { x.amt = a.amt; x.cur = a.cur; return kxAsk(c, "Updated."); }
    x.amt = null; return { text: "Okay — how much was it?", follow: ["₹250", "₹500", "₹1,000"], steps: [] };
  }
  if (f.step === "mode") {
    if (/\b(multi|several|many|trip|more than one|multiple)\b/.test(t)) { f.mode = "multi"; return kxAsk(c, "A multi claim it is."); }
    if (/\b(single|one|just one)\b/.test(t)) { f.mode = "single"; return kxAsk(c, "A single claim it is."); }
    return { text: "Single claim or multi claim?", card: { type: "xmode" }, follow: [], steps: [] };
  }
  if (f.step === "more") {
    if (/\b(another|more|add|next|yes)\b/.test(t)) { f.items.push(kxItem(x)); f.cur = { cur: x.cur || "INR" }; return kxAsk(c, "Okay — the next one."); }
    if (/\b(all|done|no|finish|review|nothing)\b|that.?s it/.test(t)) { f.allIn = true; return kxAsk(c); }
    return { text: "Add another receipt, or is that all?", follow: ["Add another receipt", "That’s all"], steps: [] };
  }
  if (/make it a multi|switch to multi|multi claim/.test(t)) { f.mode = "multi"; f.allIn = false; return kxAsk(c, "Switched to a multi claim — you can add more receipts."); }
  // edits at any point: "change the amount to 600", "category is travel", "date was 3 nov"
  if (/\b(change|edit|update|make it|actually|wrong|fix)\b/.test(t) || f.step === "sum") {
    if (/add another|another expense|another receipt|one more|add more/.test(t)) { f.mode = "multi"; f.allIn = false; f.items.push(kxItem(x)); f.cur = { cur: x.cur || "INR" }; return kxAsk(c, "Sure — let’s add the next one."); }
    if (/^submit|^yes,? submit|send it/.test(t)) return kxDone(c, "submit");
    if (/upload (the )?receipt/.test(t)) { delete x.noReceipt; f.step = "receipt"; return kxAsk(c); }
    if (/^save|later|draft/.test(t)) return kxDone(c, "save");
    const before = JSON.stringify(x), ccBefore = f.cc;
    if (/amount|price|cost|₹|\d/.test(t)) { const a = kxAmount(t, true); if (a) { x.amt = a.amt; x.cur = a.cur; } else if (/amount/.test(t)) { x.amt = null; } }
    if (/categor|type/.test(t) || kxCat(t)) { const ct = kxCat(t); if (ct) x.cat = ct; else if (/categor/.test(t)) x.cat = null; }
    if (/date|when|day/.test(t) || kxDate(t)) { const d = kxDate(t); if (d) x.date = d; else if (/date/.test(t)) x.date = null; }
    if (/cost cent/.test(t)) { const cc = kxCc(t); f.cc = cc ? cc.id : null; }
    else { const cc = kxCc(t, true); if (cc) f.cc = cc.id; }
    if (/note|description|for\b/.test(t) && !/amount|date|categor/.test(t)) { const m = text.match(/(?:note|description)\s*(?:to|is|:)?\s*(.+)$/i); if (m) x.desc = m[1]; else x.desc = null; }
    const was = JSON.parse(before), cleared = Object.keys(was).some((key) => was[key] && !x[key]);
    if (JSON.stringify(x) !== before || f.cc !== ccBefore || f.step !== "sum") return kxAsk(c, cleared ? "Sure." : "Updated.");
    return kxAsk(c, "I can change the amount, category, date, note or cost centre — just tell me what to change.");
  }

  // answer for the current question
  if (f.step === "receipt") {
    if (/\b(no|don.?t|dont|skip|without|lost|later)\b/.test(t)) { x.noReceipt = true; kxParse(x, text, false); return kxAsk(c, "No problem — I’ll file it without one. Your approver may ask for it later."); }
    kxParse(x, text, true); x.noReceipt = x.noReceipt || !!(x.amt || x.cat); // typed details instead of uploading
    return kxAsk(c);
  }
  if (f.step === "amt") {
    const a = kxAmount(t, true);
    if (!a) return { text: "I didn’t catch an amount — try something like **₹450** or **$32**.", follow: ["₹250", "₹500", "₹1,000"], steps: [] };
    if (!(a.amt > 0)) return { text: "The amount has to be more than zero — how much was it?", follow: ["₹250", "₹500", "₹1,000"], steps: [] };
    x.amt = a.amt; x.cur = a.cur; kxParse(x, text, false); return kxAsk(c);
  }
  if (f.step === "cat") {
    const ct = kxCat(t);
    if (!ct) return { text: "Which of these fits best?", follow: EXP_CATS.map((e) => e.id), steps: [] };
    x.cat = ct; return kxAsk(c);
  }
  if (f.step === "date") {
    const d = kxDate(t);
    if (!d) return { text: "I didn’t get the date — say **today**, **yesterday** or a date like **3 Nov**.", follow: ["Today", "Yesterday"], steps: [] };
    if (d > D.today()) return { text: "That date is in the future — when did you actually spend it?", follow: ["Today", "Yesterday"], steps: [] };
    x.date = d; return kxAsk(c);
  }
  if (f.step === "desc") { x.desc = text.trim().slice(0, 80); if (!x.merchant) x.merchant = x.desc; return kxAsk(c); }
  if (f.step === "cc") {
    const cc = kxCc(t);
    if (!cc) return { text: "Pick one of these cost centres:", follow: COST_CENTRES.map((e) => e.name), steps: [] };
    f.cc = cc.id; return kxAsk(c, `Charging it to **${cc.name}**.`);
  }
  return kxAsk(c);
}
function kxTakeFiles(f, list) {
  const read = [];
  list.filter(Boolean).forEach((file, i) => {
    if (i === 0) { Object.assign(f.cur, kxFromFile(file, f.cur)); read.push(f.cur); }
    else { const y = { cur: "INR", ...kxFromFile(file, {}) }; f.items.push(kxItem(y)); read.push(y); }
  });
  if (list.length > 1) f.mode = "multi";
  return read;
}
function kxFromFile(file, x) {
  const e = kaisExtract(file); // the same demo extraction the upload screen uses
  if (e._err) return { file: { name: file.name, size: file.size || "", img: file.img || null }, rid: e.rid, unreadable: true };
  return { file: { name: file.name, size: file.size || "", img: file.img || null }, rid: e.rid, merchant: x.merchant || e.merchant, amt: x.amt || e.amt, cur: x.amt ? x.cur : e.cur,
    cat: x.cat || e.cat, date: x.date || e.date, taxPct: e.taxPct };
}

// submit or save → a real claim in My expenses
function kxDone(c, how) {
  const f = c.xf; if (!f) return null;
  const items = [...f.items, kxItem(f.cur)];
  if (how === "submit") {
    const missing = items.filter(needsReceipt);
    if (missing.length) { const m = missing[0]; if (m !== items[items.length - 1]) { const i = f.items.indexOf(f.items.find((y) => y.merchant === m.merchant && y.inr === m.inr)); if (i >= 0) { const cur = kxItem(f.cur); f.cur = { ...f.items[i] }; f.items[i] = cur; } }
      delete f.cur.noReceipt; f.step = "receipt";
      return { text: `I can’t submit yet — **${esc(m.merchant || m.desc || m.cat)}** is over **${money(RECEIPT_NEEDED_OVER)}**, so it needs a receipt. Upload it, or save the claim and add it later.`, card: { type: "xup" }, follow: ["Save it for later"], steps: [["shield", "Checking the receipt policy"]] };
    }
    const dups = items.filter((y) => rcDuplicate(y));
    if (dups.length && !f.dupOk) { f.dupOk = true; f.step = "sum";
      return { text: `This looks like a duplicate: **${esc(dups.map((y) => y.merchant || y.cat).join(", "))}** — same amount, merchant and date as an expense in **${esc(dupClaim(rcDuplicate(dups[0]))?.code || "another claim")}**. Submit anyway?`, follow: ["Submit anyway", "Save it for later", "Cancel"], steps: [["copy", "Looking for duplicate claims"]] };
    }
    if (!navigator.onLine) { const r = kxDone(c, "save"); r.text = `You’re offline, so I couldn’t submit. I saved it as **${claimOf(r.card.id).code}** — submit it from My expenses when you’re back online.`; r.card.offline = true; return r; }
  }
  const claim = { id: uid(), code: nextCode(), name: items.length > 1 ? `Kais claim – ${D.f(D.today(), { day: "numeric", month: "short" })}` : (items[0].desc || items[0].merchant || items[0].cat),
    status: how === "submit" ? "pending" : "saved", cc: f.cc, approver: "pr", entity: ENTITIES[0], billing: "Billable",
    desc: items.map((x) => x.desc).filter(Boolean).join("; "), cur: items[0].cur || "INR", receipts: [], created: Date.now(), submitted: how === "submit" ? Date.now() : null, paid: 0, note: "",
    comments: [{ who: "me", text: "Filed with Kais", ts: Date.now() }] };
  items.forEach((x) => {
    const r = { id: uid(), rid: x.rid || "RC" + Math.floor(1e7 + Math.random() * 9e7), merchant: x.merchant || x.desc || x.cat, cat: x.cat, cur: x.cur || "INR", amt: x.amt, inr: x.inr, date: x.date,
      pay: "Corporate card", paidBy: "Me", project: "p4", taxPct: x.taxPct || 5, desc: x.desc || "", people: [], file: x.file || { name: "no-receipt.txt" }, claim: claim.id };
    S.receipts.push(r); claim.receipts.push(r.id);
  });
  S.claims.unshift(claim); delete c.xf;
  if (how === "submit") try { navigator.vibrate?.([18, 40, 28]); } catch {}
  return { text: how === "submit" ? `Done — claim **${claim.code}** for **${fmtCur(claimTotal(claim), claim.cur)}** is with **${approverName(claim.approver)}** for approval. I’ll let you know when it’s reviewed.`
      : `Saved **${claim.code}** to your saved claims. You can add receipts and submit it whenever you’re ready.`,
    card: { type: "xdone", id: claim.id, how }, follow: ["Show pending claims", "Apply for another expense"], steps: [["send", how === "submit" ? "Submitting the claim" : "Saving the claim"]] };
}

// cards
function kaisExpenseCard(cd, mi) {
  const c = kaisChat(), f = c?.xf;
  if (cd.type === "xmode") {
    const live = f && f.step === "mode" && mi === c.msgs.length - 1;
    return live ? `<div class="kx-modes"><button class="kx-mode" data-act="kaisAsk" data-q="Single claim"><span class="kc-ic tint t-blue">${I("receipt")}</span><b>Single claim</b><small>One receipt</small></button><button class="kx-mode" data-act="kaisAsk" data-q="Multi claim"><span class="kc-ic tint t-violet">${I("copy")}</span><b>Multi claim</b><small>Several receipts, one claim</small></button></div>` : "";
  }
  if (cd.type === "xup") {
    const live = f && f.step === "receipt" && mi === c.msgs.length - 1;
    return `<div class="kc kx-up"><div class="hrow"><span class="kc-ic tint t-blue">${I("scan")}</span><span class="grow"><b>${f?.mode === "multi" && !f.items.length ? "Add the receipts" : "Add the receipt"}</b><span class="small muted" style="display:block">${f?.mode === "multi" && !f.items.length ? "Pick several at once · Kais reads each one" : "Photo or PDF · Kais reads it for you"}</span></span></div>
      ${live ? `<div class="hrow" style="margin-top:10px"><button class="btn primary sm" data-act="kxUpload" data-cam="1">${I("scan")}Take photo</button><button class="btn ghost sm" data-act="kxUpload">${I("upload")}${f?.mode === "multi" ? "Upload receipts" : "Upload"}</button></div>` : ""}</div>`;
  }
  if (cd.type === "xsum") {
    const live = f && f.step === "sum" && mi === c.msgs.length - 1;
    if (!live) return f ? `<div class="kc"><span class="small muted">This draft has changed — see the latest summary below.</span></div>` : "";
    const items = [...f.items, kxItem(f.cur)], tot = items.reduce((a, x) => a + x.inr, 0);
    return `<div class="kc kx-sum"><div class="hrow"><span class="grow"><span class="eyebrow">${f.mode === "multi" ? "Multi claim" : "Single claim"} · draft</span><b class="kx-tot">${money(tot)}</b></span><span class="small muted">${plural(items.length, "expense")}</span></div>
      <div class="kx-items">${items.map((x) => { const ct = expCat(x.cat); const ov = x.inr > ct.limit; return `<div class="kx-it"><span class="kc-ic tint ${ct.tint}">${I(ct.icon)}</span><span class="grow" style="min-width:0"><b class="ell" style="display:block">${esc(x.merchant || x.desc || x.cat)}</b><span class="tiny muted">${esc(x.cat)} · ${D.short(x.date)}${x.file ? " · with receipt" : " · no receipt"}</span>${ov ? `<span class="rc-warn">${I("alert")}Over the ${money(ct.limit)} limit</span>` : ""}${needsReceipt(x) ? `<span class="rc-warn">${I("receipt")}Receipt needed to submit</span>` : ""}${rcDuplicate(x) ? `<span class="rc-warn amber">${I("copy")}Possible duplicate</span>` : ""}</span><b class="num">${(CUR_SYM[x.cur || "INR"] || "") + Number(x.amt).toLocaleString(!x.cur || x.cur === "INR" ? "en-IN" : "en-US", { maximumFractionDigits: 2 })}</b></div>`; }).join("")}</div>
      <div class="kv"><span>Cost centre</span><span>${esc(ccName(f.cc))}</span></div><div class="kv"><span>Approver</span><span>${esc(approverName("pr"))}</span></div>
      <div class="kx-acts"><button class="btn primary sm" data-act="kxDo" data-k="submit">Submit claim</button><button class="btn ghost sm" data-act="kxDo" data-k="save">Save for later</button><button class="btn ghost sm" data-act="kxDo" data-k="form">Edit in form</button></div></div>`;
  }
  if (cd.type === "xdone") {
    const cl = claimOf(cd.id);
    return `<div class="kc"><button class="hrow" style="width:100%;text-align:left" data-go="#/expenses/claim/${cd.id}">${cd.how === "submit" ? `<span class="kx-ok">${I("check")}</span>` : `<span class="kc-ic tint t-amber">${I("wallet")}</span>`}<span class="grow" style="min-width:0"><b class="ell" style="display:block">${esc(cl ? claimTitle(cl) : "Claim")}</b><span class="small muted">${cl ? `${esc(cl.code)} · ${cd.how === "submit" ? "Waiting for approval" : "Saved"}` : "Removed"}</span></span>${I("chevR")}</button></div>`;
  }
  return "";
}

// card actions
act("kxUpload", (b) => pickReceipts({ multiple: kaisChat()?.xf?.mode === "multi" && !b.dataset.cam, capture: !!b.dataset.cam, onFiles(files) {
  const c = kaisChat(); if (!c?.xf || KAIS.streaming) return;
  c.xf.pendingFiles = files;
  c.msgs.push({ role: "user", text: files.length > 1 ? `Here are ${files.length} receipts` : "Here’s the receipt", files: files.map((y) => ({ name: y.name, size: y.size, img: y.img })) }); c.ts = Date.now();
  kaisRespond(c, "__xreceipt__");
} }));
act("kxDo", (b) => {
  const c = kaisChat(); if (!c?.xf || KAIS.streaming) return;
  const k = b.dataset.k;
  if (k === "form") {
    const f = c.xf, items = [...f.items, kxItem(f.cur)];
    RV = { mode: items.length > 1 ? "multi" : "single", i: 0, items: items.map((x) => ({ id: uid(), rid: x.rid || "RC" + Math.floor(1e7 + Math.random() * 9e7), merchant: x.merchant || x.desc || "", cat: x.cat, cur: x.cur || "INR", amt: x.amt, inr: x.inr, date: x.date, pay: "Corporate card", paidBy: "Me", project: "p4", taxPct: x.taxPct || 5, desc: x.desc || "", people: [], file: x.file || { name: "no-receipt.txt" }, claim: null })) };
    delete c.xf; save(); return go("#/expenses/review");
  }
  c.msgs.push({ role: "user", text: k === "submit" ? "Submit the claim" : "Save it for later", files: [] }); c.ts = Date.now();
  kaisRespond(c, k === "submit" ? "submit" : "save for later");
});
