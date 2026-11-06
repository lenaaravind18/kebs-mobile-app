package app.vercel.kebs_mobile_app.twa;

import android.Manifest;
import android.app.DownloadManager;
import android.content.pm.PackageManager;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import java.util.ArrayList;
import java.util.Locale;
import org.json.JSONObject;
import androidx.core.app.ActivityCompat;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.net.Uri;
import java.io.File;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * KEBS draws edge to edge: the web app paints behind the status bar and the gesture bar, like a native app.
 * The system bar sizes are handed to the page (window.KebsNative.insets() and the "kebsinsets" event),
 * and the page tells us whether the bar icons should be light or dark (window.KebsNative.setBars()).
 */
public class MainActivity extends BridgeActivity {
    private float top = 0, bottom = 0;
    private WebView webRef;
    // speech: Android WebView has no Web Speech API, so the app provides it natively
    private SpeechRecognizer recognizer;
    private TextToSpeech tts;
    private String pendingLang = null;
    private String lastUtterance = null;
    private static final int REQ_MIC = 7101;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window w = getWindow();
        WindowCompat.setDecorFitsSystemWindows(w, false);
        w.setStatusBarColor(Color.TRANSPARENT);
        w.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            w.setNavigationBarContrastEnforced(false);
            w.setStatusBarContrastEnforced(false);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            w.getAttributes().layoutInDisplayCutoutMode = android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }

        final WebView web = getBridge().getWebView();
        webRef = web;
        tts = new TextToSpeech(this, (status) -> { if (status == TextToSpeech.SUCCESS) tts.setLanguage(new Locale("en", "IN")); });
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) {}
            @Override public void onDone(String id) { emit("ttsend", id); }
            @Override public void onError(String id) { emit("ttsend", id); }
            @Override public void onStop(String id, boolean interrupted) { emit("ttsend", id); }
        });
        web.setBackgroundColor(Color.WHITE);
        web.addJavascriptInterface(new Bars(), "KebsNative");

        // Back gesture: let the web app close sheets / go back a screen; leave the app only from Home
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                web.evaluateJavascript("window.kebsBack ? kebsBack() : \"none\"", (res) -> {
                    if ("\"handled\"".equals(res)) return;
                    if (!"\"exit\"".equals(res) && web.canGoBack()) { web.goBack(); return; }
                    moveTaskToBack(true);
                });
            }
        });

        final float density = getResources().getDisplayMetrics().density;
        ViewCompat.setOnApplyWindowInsetsListener(web, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            top = bars.top / density;
            // keyboard open: shrink the web view above it, and the page needs no bottom inset
            boolean kb = ime.bottom > bars.bottom;
            bottom = kb ? 0 : bars.bottom / density;
            ViewGroup.MarginLayoutParams lp = (ViewGroup.MarginLayoutParams) v.getLayoutParams();
            int want = kb ? ime.bottom : 0;
            if (lp.bottomMargin != want) { lp.bottomMargin = want; v.setLayoutParams(lp); }
            push(web);
            return insets;
        });
    }

    private void push(WebView web) {
        String js = "(function(){var r=document.documentElement;r.style.setProperty('--nat-t','" + top + "px');"
            + "r.style.setProperty('--nat-b','" + bottom + "px');r.classList.add('native');"
            + "window.dispatchEvent(new Event('kebsinsets'));})()";
        web.post(() -> web.evaluateJavascript(js, null));
    }

    private void emit(String type, String text) {
        if (webRef == null) return;
        final String js = "window.dispatchEvent(new CustomEvent('kebsspeech',{detail:{type:'" + type + "',text:" + JSONObject.quote(text == null ? "" : text) + "}}))";
        webRef.post(() -> webRef.evaluateJavascript(js, null));
    }

    private void listen(String lang) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            pendingLang = lang;
            ActivityCompat.requestPermissions(this, new String[]{ Manifest.permission.RECORD_AUDIO }, REQ_MIC);
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) { emit("error", "service-not-allowed"); emit("end", ""); return; }
        if (recognizer == null) {
            recognizer = SpeechRecognizer.createSpeechRecognizer(this);
            recognizer.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle b) { emit("audiostart", ""); }
                @Override public void onBeginningOfSpeech() { emit("speechstart", ""); }
                @Override public void onRmsChanged(float v) {}
                @Override public void onBufferReceived(byte[] b) {}
                @Override public void onEndOfSpeech() {}
                @Override public void onError(int code) {
                    String e = code == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS ? "not-allowed"
                        : (code == SpeechRecognizer.ERROR_NETWORK || code == SpeechRecognizer.ERROR_NETWORK_TIMEOUT) ? "network"
                        : code == SpeechRecognizer.ERROR_AUDIO ? "audio-capture"
                        : (code == SpeechRecognizer.ERROR_NO_MATCH || code == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) ? "no-speech" : "aborted";
                    emit("error", e); emit("end", "");
                }
                @Override public void onResults(Bundle b) {
                    ArrayList<String> r = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    emit("final", r != null && !r.isEmpty() ? r.get(0) : ""); emit("end", "");
                }
                @Override public void onPartialResults(Bundle b) {
                    ArrayList<String> r = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (r != null && !r.isEmpty() && !r.get(0).isEmpty()) emit("partial", r.get(0));
                }
                @Override public void onEvent(int t, Bundle b) {}
            });
        }
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang == null || lang.isEmpty() ? "en-IN" : lang)
            .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        recognizer.startListening(i);
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        super.onRequestPermissionsResult(code, perms, res);
        if (code != REQ_MIC) return;
        String lang = pendingLang; pendingLang = null;
        if (res.length > 0 && res[0] == PackageManager.PERMISSION_GRANTED) listen(lang);
        else { emit("error", "not-allowed"); emit("end", ""); }
    }

    @Override
    public void onDestroy() {
        if (recognizer != null) recognizer.destroy();
        if (tts != null) tts.shutdown();
        super.onDestroy();
    }

    /** Downloads a newer signed APK into the app's own folder, then hands it to Android's installer. */
    private void downloadAndInstall(String url) {
        File dir = getExternalFilesDir("updates");
        if (dir == null) return;
        for (File old : dir.listFiles() == null ? new File[0] : dir.listFiles()) old.delete();
        File apk = new File(dir, "KEBS-update.apk");
        DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
        DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url))
            .setTitle("KEBS update")
            .setMimeType("application/vnd.android.package-archive")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
            .setDestinationUri(Uri.fromFile(apk));
        final long id = dm.enqueue(req);
        BroadcastReceiver done = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent intent) {
                if (intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1) != id) return;
                try { unregisterReceiver(this); } catch (Exception ignored) {}
                Uri uri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", apk);
                Intent install = new Intent(Intent.ACTION_VIEW)
                    .setDataAndType(uri, "application/vnd.android.package-archive")
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(install);
            }
        };
        ContextCompat.registerReceiver(this, done, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), ContextCompat.RECEIVER_EXPORTED);
    }

    /** App lock: the system fingerprint / face prompt, with the phone's PIN, pattern or password as a fallback. */
    private static final int AUTHS = BiometricManager.Authenticators.BIOMETRIC_WEAK | BiometricManager.Authenticators.DEVICE_CREDENTIAL;

    private String biometricStatus() {
        int r = BiometricManager.from(this).canAuthenticate(AUTHS);
        if (r == BiometricManager.BIOMETRIC_SUCCESS) return "ok";
        if (r == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED) return "none-enrolled";
        if (r == BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE || r == BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE) return "no-hardware";
        return "unavailable";
    }

    private void authEmit(String id, boolean ok, String err) {
        if (webRef == null) return;
        final String js = "window.dispatchEvent(new CustomEvent('kebsauth',{detail:{id:" + JSONObject.quote(id) + ",ok:" + ok + ",error:" + JSONObject.quote(err == null ? "" : err) + "}}))";
        webRef.post(() -> webRef.evaluateJavascript(js, null));
    }

    private void authenticate(String title, String subtitle, String id) {
        String st = biometricStatus();
        if (!"ok".equals(st)) { authEmit(id, false, st); return; }
        BiometricPrompt prompt = new BiometricPrompt(this, ContextCompat.getMainExecutor(this), new BiometricPrompt.AuthenticationCallback() {
            @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult r) { authEmit(id, true, ""); }
            @Override public void onAuthenticationError(int code, CharSequence msg) {
                boolean cancel = code == BiometricPrompt.ERROR_USER_CANCELED || code == BiometricPrompt.ERROR_NEGATIVE_BUTTON || code == BiometricPrompt.ERROR_CANCELED;
                boolean lock = code == BiometricPrompt.ERROR_LOCKOUT || code == BiometricPrompt.ERROR_LOCKOUT_PERMANENT;
                authEmit(id, false, cancel ? "cancelled" : lock ? "lockout" : String.valueOf(msg));
            }
            @Override public void onAuthenticationFailed() { /* wrong finger: the prompt stays open for a retry */ }
        });
        BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
            .setTitle(title == null || title.isEmpty() ? "Unlock KEBS" : title)
            .setSubtitle(subtitle == null ? "" : subtitle)
            .setAllowedAuthenticators(AUTHS)
            .build();
        prompt.authenticate(info);
    }

    private class Bars {
        @JavascriptInterface
        public String biometricStatus() { return MainActivity.this.biometricStatus(); }

        @JavascriptInterface
        public void authenticate(final String title, final String subtitle, final String id) { runOnUiThread(() -> MainActivity.this.authenticate(title, subtitle, id)); }

        @JavascriptInterface
        public int versionCode() {
            try { return (int) androidx.core.content.pm.PackageInfoCompat.getLongVersionCode(getPackageManager().getPackageInfo(getPackageName(), 0)); }
            catch (Exception e) { return 0; }
        }

        @JavascriptInterface
        public boolean hasSpeech() { return true; }

        @JavascriptInterface
        public void startListening(final String lang) { runOnUiThread(() -> listen(lang)); }

        @JavascriptInterface
        public void stopListening() { runOnUiThread(() -> { if (recognizer != null) recognizer.stopListening(); }); }

        @JavascriptInterface
        public void abortListening() { runOnUiThread(() -> { if (recognizer != null) recognizer.cancel(); emit("end", ""); }); }

        @JavascriptInterface
        public void speak(final String text, final float rate, final float pitch, final String id) {
            runOnUiThread(() -> {
                if (tts == null) { emit("ttsend", id); return; }
                tts.setSpeechRate(rate); tts.setPitch(pitch);
                lastUtterance = id;
                if (tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, id) != TextToSpeech.SUCCESS) emit("ttsend", id);
            });
        }

        @JavascriptInterface
        public void stopSpeaking() { runOnUiThread(() -> { if (tts != null) tts.stop(); if (lastUtterance != null) emit("ttsend", lastUtterance); }); }

        @JavascriptInterface
        public void installUpdate(final String url) {
            if (url == null || !url.startsWith("https://github.com/lenaaravind18/kebs-mobile-app/releases/")) return;
            runOnUiThread(() -> downloadAndInstall(url));
        }

        @JavascriptInterface
        public String insets() { return "{\"t\":" + top + ",\"b\":" + bottom + "}"; }

        /** lightStatus: white icons on the status bar; lightNav: white icons on the gesture bar */
        @JavascriptInterface
        public void setBars(final boolean lightStatus, final boolean lightNav) {
            runOnUiThread(() -> {
                WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
                c.setAppearanceLightStatusBars(!lightStatus);
                c.setAppearanceLightNavigationBars(!lightNav);
            });
        }
    }
}
