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

  // ── Menu → Check for updates: one sheet that checks the web app and (in the Android app) the installed APK ──
  const assets = (t) => (t.match(/(?:styles|extra|tesla)\.css\?v=\d+|js\/[\w-]+\.js\?v=\d+/g) || []).sort().join("|");
  const localAssets = () => assets([...document.querySelectorAll("link[href], script[src]")].map((e) => e.getAttribute("href") || e.getAttribute("src")).join(" "));
  window.kebsBuild = () => { const m = document.querySelector('link[href*="tesla.css"]')?.getAttribute("href").match(/v=(\d+)/); return m ? m[1] : "—"; };
  window.kebsCheckUpdates = () => {
    const N = window.KebsNative, native = !!(N && N.versionCode);
    const s = openSheet({ title: "Software update", body: `<div class="upd2" data-u></div>`, foot: `<div data-f></div>`,
      onMount(el) {
        const box = el.querySelector("[data-u]"), foot = el.querySelector("[data-f]");
        const ver = () => `<div class="upd2-ver"><span>App${native ? ` · build ${N.versionCode()}` : " · web"}</span><span>Web build ${esc(kebsBuild())}</span></div>`;
        const show = (ic, cls, title, text, btns = "") => { box.innerHTML = `<span class="upd2-ic ${cls}">${ic}</span><h3>${title}</h3><p class="muted">${text}</p>${ver()}`; foot.innerHTML = btns; };
        const run = async () => {
          show(`<span class="upd2-spin"></span>`, "busy", "Checking for updates…", "Looking for a newer version of KEBS.");
          if (!navigator.onLine || (typeof NET !== "undefined" && NET.state === "offline")) return show(I("wifiOff"), "warn", "You’re offline", "Connect to Wi-Fi or mobile data to check for updates.", `<button class="btn primary block" data-s="retry">${I("refresh")}Try again</button>`);
          try {
            const started = Date.now();
            const [web, rel] = await Promise.all([
              fetch("index.html?check=" + Date.now(), { cache: "no-store" }).then((r) => (r.ok ? r.text() : Promise.reject())),
              native ? fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { cache: "no-store" }).then((r) => r.json()).catch(() => null) : Promise.resolve(null),
            ]);
            await new Promise((x) => setTimeout(x, Math.max(0, 700 - (Date.now() - started)))); // let "Checking…" register
            S.settings.lastUpdateCheck = Date.now(); save();
            const webNew = assets(web) !== localAssets();
            const code = rel ? parseInt((rel.tag_name || "").replace(/\D+/g, ""), 10) : 0, apk = rel && (rel.assets || []).find((a) => /\.apk$/i.test(a.name));
            const appNew = native && code && apk && code > N.versionCode();
            if (appNew) return show(I("download"), "new", "App update available", `KEBS ${esc(rel.name || "")} is ready. It installs over this version and keeps your data.${webNew ? " The latest screens come with it." : ""}`,
              `<button class="btn primary block" data-s="apk">${I("download")}Download &amp; install</button>`), (el._apk = apk.browser_download_url);
            if (webNew) return show(I("sparkles"), "new", "A new version is ready", "KEBS has new features and fixes. Updating takes a second and keeps everything you’ve saved.", `<button class="btn primary block" data-s="reload">${I("refresh")}Update now</button>`);
            show(typeof successTick === "function" ? successTick() : I("checkCircle"), typeof successTick === "function" ? "tick" : "ok", "You’re up to date", `KEBS is on the latest version. Checked just now.`, `<button class="btn outline block" data-s="close">Done</button>`);
          } catch { show(I("alert"), "bad", "Couldn’t check for updates", "Something went wrong reaching KEBS. Try again in a moment.", `<button class="btn primary block" data-s="retry">${I("refresh")}Try again</button>`); }
        };
        onS(el, {
          retry: run, close() { closeSheet(s); },
          reload(b) { b.disabled = true; b.textContent = "Updating…"; setTimeout(() => location.reload(), 300); },
          apk(b) { b.disabled = true; b.textContent = "Downloading…"; try { N.installUpdate(el._apk); } catch {} toast("Downloading the update — Android will ask you to install it", "info"); setTimeout(() => closeSheet(s), 1200); },
        });
        run();
      } });
  };
  act("checkUpdates", () => { if (typeof closeDrawer === "function") closeDrawer(); setTimeout(kebsCheckUpdates, 180); });
})();
