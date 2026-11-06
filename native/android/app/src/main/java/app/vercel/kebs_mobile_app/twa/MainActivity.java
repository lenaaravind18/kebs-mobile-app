package app.vercel.kebs_mobile_app.twa;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

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

    private class Bars {
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
