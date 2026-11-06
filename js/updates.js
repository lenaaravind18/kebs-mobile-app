// Keeps the installed app current.
// 1) Web changes: when a newer version of the site is live, the app refreshes itself (straight away if it was
//    in the background, otherwise with a one-tap "Refresh" toast). Everything is saved locally, so nothing is lost.
// 2) Native changes (Android app only): checks GitHub for a newer signed APK and offers to install it in-app.
(() => {
  const sig = (t) => (t.match(/(?:styles|extra|tesla)\.css\?v=\d+|js\/[\w-]+\.js\?v=\d+/g) || []).join("|") + "#" + t.length;
  let mine = null, offered = false, hiddenAt = 0;
  async function liveSig() {
    const r = await fetch("index.html?check=" + Date.now(), { cache: "no-store" });
    return r.ok ? sig(await r.text()) : null;
  }
  async function checkWeb(fromBackground) {
    try {
      const live = await liveSig(); if (!live) return;
      if (mine === null) { mine = live; return; }
      if (live === mine || offered) return;
      if (fromBackground) { location.reload(); return; }
      offered = true;
      const t = document.createElement("div"); t.className = "toast info upd-toast";
      t.innerHTML = I("info") + "<span>A new version of KEBS is ready</span><button type=\"button\">Refresh</button>";
      t.querySelector("button").onclick = () => location.reload();
      $("#toasts").append(t);
    } catch {}
  }
  addEventListener("load", () => setTimeout(() => checkWeb(false), 1500));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { hiddenAt = Date.now(); return; }
    checkWeb(Date.now() - hiddenAt > 30000);
    checkNative();
  });
  setInterval(() => !document.hidden && checkWeb(false), 10 * 60 * 1000);

  // ── native app updates ──
  const REPO = "lenaaravind18/kebs-mobile-app";
  let nativeAsked = 0;
  async function checkNative(force) {
    const N = window.KebsNative; if (!N || !N.versionCode || (!force && Date.now() - nativeAsked < 6 * 3600 * 1000)) return;
    try {
      const rel = await (await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { cache: "no-store" })).json();
      const code = parseInt((rel.tag_name || "").replace(/\D+/g, ""), 10), apk = (rel.assets || []).find((a) => /\.apk$/i.test(a.name));
      if (!code || !apk || code <= N.versionCode()) { if (force) toast("You’re on the latest version of the app", "info"); return; }
      nativeAsked = Date.now();
      openSheet({
        title: "Update available",
        body: `<div class="upd"><img src="icon.svg" alt="" width="56" height="56"><p><b>KEBS ${esc(rel.name || "")}</b><br><span class="muted small">A new version of the app is ready. It installs over this one and keeps your data.</span></p></div>`,
        foot: `<button class="btn ghost" data-s="later">Later</button><button class="btn acc" data-s="go">Update now</button>`,
        onMount(el) {
          onS(el, {
            later() { closeSheet(); },
            go(b) { b.disabled = true; b.textContent = "Downloading…"; N.installUpdate(apk.browser_download_url); toast("Downloading the update — Android will ask you to install it", "info"); setTimeout(closeSheet, 1200); },
          });
        },
      });
    } catch { if (force) toast("Couldn’t check for updates. Check your connection.", "bad"); }
  }
  window.kebsNativeUpdate = () => checkNative(true); // e.g. the lock screen on an app too old for fingerprint unlock
  addEventListener("load", () => setTimeout(checkNative, 4000));
})();
