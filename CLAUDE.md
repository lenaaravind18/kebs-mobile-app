# KEBS Workspace — mobile app

HR / workforce mobile web app (attendance, timesheets, leave, approvals, payroll, Kais AI assistant).
Live: https://kebs-mobile-app.vercel.app · Repo: github.com/lenaaravind18/kebs-mobile-app

## Web app (repo root)
- Vanilla JS SPA, no build step. Hash routing: `route(pattern, render, {mount, dock})`, actions via `act(name, fn)`
  and `data-act` / `data-go`, sheets via `openSheet({...})` / `closeSheet()`, state `S` in localStorage (`kebs.app.v1`), `save()`, `rerender()`.
- CSS cascade: `styles.css` → `extra.css` → `tesla.css`. New styles are appended to the end of `tesla.css`.
- **Always bump the `?v=N` query of any changed CSS/JS file in `index.html`** (cache busting + the in-app updater
  uses these to detect a new version).
- iPhone mockup frame at ≥620px wide; on phones the shell zooms with `--z`. Safe areas: `--sat` / `--sab`.
- Icons: `I(name)` (Fluent, fallback `js/icons.js`), tiles `msIcon(id)` (`js/icons-ms.js`).
- Charts: `js/charts.js` (capsuleBars, areaChart, activityRings, progressRing, curveRings — `.ring` gets `--t` colour).
- Kais: `js/views-kais.js`, voice screen `js/kais-voice.js`, per-agent tint uses `MS_STYLE["ag-"+id]`.
- `js/updates.js`: auto-refresh when a newer site is live; Android in-app update from latest GitHub release.
- `js/native-speech.js`: maps Android native speech (KebsNative bridge) to SpeechRecognition / speechSynthesis.
- Local preview: `node server.mjs` (port 5270).

## Deploy (only when the user says "ship it")
- `git push origin main` then `npx vercel --prod --yes` (project is linked via `.vercel/`, never commit `.vercel` or `.env`).
- Commit author email: slenaaravind@kaartech.com.

## Android app (`native/`)
- Capacitor 7 shell, package `app.vercel.kebs_mobile_app.twa`, loads the live site, edge to edge.
- `MainActivity.java` bridge `window.KebsNative`: insets(), setBars(), versionCode(), installUpdate(url),
  speech (startListening/stopListening/abortListening/speak/stopSpeaking), back gesture → `window.kebsBack()`,
  app lock biometricStatus() / authenticate(title, subtitle, id) → `kebsauth` event (BiometricPrompt, PIN fallback).
- Web app lock: `js/device-auth.js` (`DeviceAuth`) uses the native prompt in the app, WebAuthn in browsers.
- Built by GitHub Actions (`.github/workflows/android.yml`) on any push touching `native/**`; signed with repo
  secrets `KEBS_KEYSTORE_B64`, `KEBS_STORE_PASSWORD`, `KEBS_KEY_ALIAS`, `KEBS_KEY_PASSWORD`; publishes a release
  `build-<run>0` (versionCode = run number × 10) that installed apps offer as an in-app update.
- Web-only changes reach the app without a new APK. Only native changes need a build.
- The signing keystore is NOT in the repo (owner keeps a copy). Never commit it.

## User preferences (design)
- Soft/calm orange gradients, no harsh solid orange; curved (round-cap) rings and donuts; no chips where plain text works;
  dock not curved; minimal borders; mobile type scale (regular body, semibold labels, bold titles ≥18px, nothing <11px).
- Ask before shipping; show changes in the preview first.
