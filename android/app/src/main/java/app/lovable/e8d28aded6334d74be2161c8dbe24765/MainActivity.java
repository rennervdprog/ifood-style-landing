package app.lovable.e8d28aded6334d74be2161c8dbe24765;

import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebView;
import android.webkit.WebSettings;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String PREFS_NAME = "itasuper_native_cache";
    private static final String VERSION_KEY = "cleared_for_version";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        enableWebViewDebuggingIfDebugBuild();
        tuneWebViewForSmoothness();
        clearWebViewCacheAfterNativeUpdate();
    }

    /**
     * Habilita inspeção via chrome://inspect e conexão do Playwright (CDP)
     * ao WebView do app. Só ativa em builds debug — nunca em produção.
     */
    private void enableWebViewDebuggingIfDebugBuild() {
        try {
            if ((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
                WebView.setWebContentsDebuggingEnabled(true);
            }
        } catch (Exception ignored) {}
    }

    /**
     * Fluidez: prioridade alta de render, pré-raster fora do viewport
     * (scroll longo de cardápio fica sem "stutter") e layer hardware.
     * Roda 1x logo após o Bridge inicializar o WebView.
     */
    private void tuneWebViewForSmoothness() {
        try {
            if (bridge == null || bridge.getWebView() == null) return;
            WebView wv = bridge.getWebView();
            WebSettings s = wv.getSettings();
            s.setRenderPriority(WebSettings.RenderPriority.HIGH);
            s.setCacheMode(WebSettings.LOAD_DEFAULT);
            s.setOffscreenPreRaster(true);
            wv.setLayerType(View.LAYER_TYPE_HARDWARE, null);
            // Fundo do WebView casando com o app (evita faixa preta atrás
            // do webview quando o teclado abre e o body encolhe).
            wv.setBackgroundColor(0xFFFFFFFF);
        } catch (Exception ignored) {}
    }

    private void clearWebViewCacheAfterNativeUpdate() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        String currentVersion = getNativeVersionName();
        String clearedVersion = prefs.getString(VERSION_KEY, null);

        if (currentVersion.equals(clearedVersion)) return;

        prefs.edit().putString(VERSION_KEY, currentVersion).apply();

        try {
            if (bridge != null && bridge.getWebView() != null) {
                WebView webView = bridge.getWebView();
                webView.clearCache(true);
                webView.clearHistory();
                CookieManager.getInstance().flush();

                webView.postDelayed(() -> webView.evaluateJavascript(
                    "(async()=>{try{if('serviceWorker'in navigator){const r=await navigator.serviceWorker.getRegistrations();await Promise.all(r.map(x=>x.unregister()))}if('caches'in window){const k=await caches.keys();await Promise.all(k.map(x=>caches.delete(x)))}}catch(e){}})()",
                    null
                ), 800);
                webView.postDelayed(webView::reload, 1400);
            }
        } catch (Exception ignored) {}
    }

    private String getNativeVersionName() {
        try {
            PackageInfo packageInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
            if (packageInfo.versionName != null) return packageInfo.versionName;
        } catch (PackageManager.NameNotFoundException ignored) {}

        return "1.25.70";
    }
}
