// App lock: real device authentication.
// Android app → the system fingerprint / face prompt (KebsNative.authenticate, BiometricPrompt), PIN/pattern fallback.
// Browser → the device's platform authenticator (fingerprint, Face ID, Windows Hello) via WebAuthn.
// Note: this gates the app on this device only; there is no server-side check.
const DeviceAuth = {
  isNative: () => !!(window.KebsNative && typeof window.KebsNative.authenticate === "function"),
  isOldNative: () => !!window.KebsNative && typeof window.KebsNative.authenticate !== "function",
  // "ok" | "none-enrolled" | "no-hardware" | "update-app" | "unsupported"
  async status() {
    if (DeviceAuth.isNative()) { try { return window.KebsNative.biometricStatus(); } catch { return "unavailable"; } }
    if (DeviceAuth.isOldNative()) return "update-app";
    if (!window.PublicKeyCredential || !navigator.credentials) return "unsupported";
    try { return (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()) ? "ok" : "no-hardware"; } catch { return "unsupported"; }
  },
  message(st) {
    return {
      "none-enrolled": "Add a fingerprint or screen lock in your phone’s settings first.",
      "no-hardware": "This device has no fingerprint, face or screen-lock authentication.",
      "update-app": "Update the KEBS app to use fingerprint unlock.",
      unsupported: "This browser can’t use your device’s fingerprint.",
      unavailable: "Device authentication isn’t available right now.",
    }[st] || "Device authentication isn’t available.";
  },
  _native(title, subtitle) {
    return new Promise((res) => {
      const id = uid();
      const on = (e) => { if (e.detail?.id !== id) return; window.removeEventListener("kebsauth", on); res({ ok: !!e.detail.ok, error: e.detail.error || "" }); };
      window.addEventListener("kebsauth", on);
      try { window.KebsNative.authenticate(title, subtitle, id); } catch { window.removeEventListener("kebsauth", on); res({ ok: false, error: "unavailable" }); }
    });
  },
  _rand(n = 32) { const a = new Uint8Array(n); crypto.getRandomValues(a); return a; },
  _b64(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); },
  _unb64(s) { const b = atob(s.replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(b, (c) => c.charCodeAt(0)); },
  // turn the lock on: verifies the user once (and, in a browser, registers a device credential)
  async enroll() {
    const st = await DeviceAuth.status();
    if (st !== "ok") return { ok: false, error: st };
    if (DeviceAuth.isNative()) return DeviceAuth._native("Turn on app lock", "Confirm it’s you to secure KEBS");
    try {
      const cred = await navigator.credentials.create({ publicKey: {
        challenge: DeviceAuth._rand(), rp: { name: "KEBS Workspace" },
        user: { id: DeviceAuth._rand(16), name: S.email || "kebs-user", displayName: fullName() },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
        timeout: 60000, attestation: "none",
      } });
      if (!cred) return { ok: false, error: "cancelled" };
      S.settings.secureCred = DeviceAuth._b64(cred.rawId); save();
      return { ok: true };
    } catch (e) { return { ok: false, error: e?.name === "NotAllowedError" ? "cancelled" : "unavailable" }; }
  },
  // unlock: asks for the fingerprint / face / device PIN
  async verify() {
    if (DeviceAuth.isNative()) return DeviceAuth._native("Unlock KEBS", "Use your fingerprint or screen lock");
    const st = await DeviceAuth.status();
    if (st !== "ok") return { ok: false, error: st };
    try {
      const got = await navigator.credentials.get({ publicKey: {
        challenge: DeviceAuth._rand(), userVerification: "required", timeout: 60000,
        allowCredentials: S.settings.secureCred ? [{ type: "public-key", id: DeviceAuth._unb64(S.settings.secureCred), transports: ["internal"] }] : [],
      } });
      return { ok: !!got };
    } catch (e) { return { ok: false, error: e?.name === "NotAllowedError" ? "cancelled" : "unavailable" }; }
  },
};
