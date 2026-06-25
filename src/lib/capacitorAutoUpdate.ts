/**
 * Capacitor Auto-Update — versão "agressiva"
 *
 * O app Capacitor pode carregar o site remoto (config local) ou o bundle
 * empacotado no APK (workflow Android). Quando o HTML aponta para novos
 * assets hashados em /assets/*, limpamos caches/SW e forçamos reload.
 *
 * Estratégia:
 *  - Verifica logo no boot (1s) — pega update assim que abre o app.
 *  - Verifica de novo a cada 90s enquanto o app está em foreground.
 *  - Verifica em TODO resume do background (se passou >30s).
 *  - Faz fetch com cache-buster e header `Cache-Control: no-cache` para
 *    garantir que o WebView/CDN não devolva versão antiga.
 */
import { isCapacitorNative } from "@/lib/capacitorNative";

const CHECK_INTERVAL_MS = 90_000; // 90s — bom equilíbrio entre rapidez e bateria
const RESUME_THROTTLE_MS = 30_000;
const BUILD_HASH_KEY = "itasuper_build_hash";
const NATIVE_APP_VERSION_KEY = "itasuper_native_app_version";
let checking = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

/** Extract a fingerprint from index.html script/link tags */
async function fetchBuildHash(): Promise<string | null> {
  try {
    const res = await fetch(`/?_t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        Accept: "text/html",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Extrai assets Vite hashados do HTML publicado.
    // Vite usa hashes base62/underscore (ex.: index-BTFikeqv.js), não apenas hex,
    // então o regex antigo nunca detectava atualização no domínio publicado.
    const hashes = html.match(/\/assets\/[^"'<>\s]+\.(?:js|css|mjs|tsx?)/g);
    if (!hashes || hashes.length === 0) return null;

    return hashes.sort().join("|");
  } catch {
    return null;
  }
}

async function clearAllCaches() {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (e) {
    console.warn("[AutoUpdate] caches clear failed:", e);
  }

  try {
    const regs = await navigator.serviceWorker?.getRegistrations();
    if (regs) await Promise.all(regs.map((r) => r.unregister()));
  } catch (e) {
    console.warn("[AutoUpdate] SW unregister failed:", e);
  }
}

async function checkForUpdate(opts: { silent?: boolean } = {}) {
  if (checking) return;
  checking = true;

  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

    try {
      const { App } = await import("@capacitor/app");
      const info = await App.getInfo();
      const nativeVersion = info.version || null;
      const storedNativeVersion = localStorage.getItem(NATIVE_APP_VERSION_KEY);
      if (nativeVersion && nativeVersion !== storedNativeVersion) {
        localStorage.setItem(NATIVE_APP_VERSION_KEY, nativeVersion);
        localStorage.removeItem(BUILD_HASH_KEY);
        await clearAllCaches();
      }
    } catch {}

    const currentHash = await fetchBuildHash();
    if (!currentHash) return;

    const storedHash = localStorage.getItem(BUILD_HASH_KEY);

    if (!storedHash) {
      localStorage.setItem(BUILD_HASH_KEY, currentHash);
      return;
    }

    if (currentHash !== storedHash) {
      console.log("[AutoUpdate] 🚀 Nova versão detectada — limpando caches e recarregando…");
      localStorage.setItem(BUILD_HASH_KEY, currentHash);

      await clearAllCaches();

      // Preserva a rota atual (pathname + search + hash) para que o usuário
      // continue na mesma tela após o reload da nova versão.
      setTimeout(() => {
        const { pathname, search, hash } = window.location;
        const params = new URLSearchParams(search);
        params.set("_v", String(Date.now()));
        const qs = params.toString();
        window.location.replace(pathname + (qs ? "?" + qs : "") + (hash || ""));
      }, 300);
    } else if (!opts.silent) {
      console.log("[AutoUpdate] ✓ App atualizado");
    }
  } catch (e) {
    console.warn("[AutoUpdate] Check failed:", e);
  } finally {
    checking = false;
  }
}

/**
 * Inicia o auto-update checker. Chame uma vez de App.tsx.
 */
export function initAutoUpdate() {
  if (!isCapacitorNative()) return;

  console.log("[AutoUpdate] ✅ Auto-update iniciado (boot + a cada 90s + resume)");

  // 1) Verificação rápida no boot — pega update logo que abre o app
  setTimeout(() => checkForUpdate({ silent: true }), 1000);

  // 2) Verificação periódica
  intervalId = setInterval(() => checkForUpdate({ silent: true }), CHECK_INTERVAL_MS);

  // 3) Verificação em todo resume do background
  let lastResumeCheck = 0;
  import("@capacitor/app")
    .then(({ App }) => {
      App.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) return;
        const now = Date.now();
        if (now - lastResumeCheck < RESUME_THROTTLE_MS) return;
        lastResumeCheck = now;
        // Verificação imediata ao voltar do background
        setTimeout(() => checkForUpdate({ silent: true }), 500);
      });
    })
    .catch(() => {});
}

/** Força uma verificação manual — útil para botão "Buscar atualização" */
export async function forceCheckForUpdate() {
  await checkForUpdate({ silent: false });
}

export function stopAutoUpdate() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
