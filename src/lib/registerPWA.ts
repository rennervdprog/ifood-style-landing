/**
 * Registro do Service Worker da PWA com guards.
 * NÃO registra em: dev, preview Lovable, iframe, Capacitor nativo, ?sw=off.
 * O firebase-messaging-sw.js é separado e não é tocado aqui.
 */
import { Capacitor } from "@capacitor/core";

const APP_SW_PATH = "/sw.js";

function isRefusedContext(): boolean {
  if (!import.meta.env.PROD) return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  if (new URL(window.location.href).searchParams.get("sw") === "off") return true;
  if (Capacitor.isNativePlatform()) return true;
  return false;
}

async function unregisterAppSW() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs
      .filter((r) => {
        const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
        return url.endsWith(APP_SW_PATH);
      })
      .map((r) => r.unregister()),
  );
}

export async function registerPWA() {
  if (!("serviceWorker" in navigator)) return;
  if (isRefusedContext()) {
    await unregisterAppSW();
    return;
  }
  try {
    const { registerSW } = await import("virtual:pwa-register");
    // Garante que o browser sempre revalide o SW no servidor (não usa cache HTTP)
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && "updateViaCache" in reg) {
        // Best-effort: alguns navegadores não permitem setar depois
        (reg as any).updateViaCache = "none";
      }
    } catch {}
    // Modo auto-update: assim que o novo SW entra em "waiting", chamamos
    // updateSW() que dispara skipWaiting + reload — garante que mudanças
    // de UI apareçam no próximo refresh sem precisar Ctrl+Shift+R.
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        console.info("[PWA] Nova versão detectada — versionWatcher aplicará no momento seguro.");
        // Não recarregamos aqui: o versionWatcher aplica fora de rotas críticas.
      },
      onOfflineReady() {
        console.info("[PWA] Pronto para uso offline");
      },
      onRegisterError(error: unknown) {
        // SW pode falhar em rede intermitente / CDN cold — silencia p/ não spamar Sentry.
        console.warn("[PWA] Falha ao registrar SW (ignorada):", error);
      },
    });
    // Checa updates a cada 60s
    setInterval(() => { try { (updateSW as any); const reg = navigator.serviceWorker.getRegistration(); reg && (reg as any).then?.((r: any) => r?.update?.()); } catch {} }, 60_000);
  } catch {
    /* noop */
  }
}