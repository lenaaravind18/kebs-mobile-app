package app.vercel.kebs_mobile_app.twa;

import android.app.DownloadManager;
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

    private class Bars {
        @JavascriptInterface
        public int versionCode() {
            try { return (int) androidx.core.content.pm.PackageInfoCompat.getLongVersionCode(getPackageManager().getPackageInfo(getPackageName(), 0)); }
            catch (Exception e) { return 0; }
        }

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
