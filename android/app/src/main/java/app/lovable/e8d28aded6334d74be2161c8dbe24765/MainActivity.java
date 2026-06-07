package app.lovable.e8d28aded6334d74be2161c8dbe24765;

import android.content.SharedPreferences;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebStorage;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String PREFS_NAME = "itasuper_native_cache";
    private static final String VERSION_KEY = "cleared_for_version";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        clearWebViewCacheAfterNativeUpdate();
    }

    private void clearWebViewCacheAfterNativeUpdate() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String currentVersion = BuildConfig.VERSION_NAME;
        String clearedVersion = prefs.getString(VERSION_KEY, null);

        if (currentVersion.equals(clearedVersion)) return;

        prefs.edit().putString(VERSION_KEY, currentVersion).apply();

        try {
            WebStorage.getInstance().deleteAllData();
            CookieManager.getInstance().flush();
        } catch (Exception ignored) {}

        try {
            if (bridge != null && bridge.getWebView() != null) {
                WebView webView = bridge.getWebView();
                webView.clearCache(true);
                webView.clearHistory();
                webView.post(webView::reload);
            }
        } catch (Exception ignored) {}
    }
}
