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
    // Modo "prompt": NÃO recarrega sozinho. O novo SW fica em waiting até
    // o próximo refresh natural do usuário, evitando perder o que ele
    // estava montando (modal de produto, checkout, etc.).
    registerSW({
      immediate: true,
      onNeedRefresh() {
        // Silencioso de propósito — o update entra na próxima abertura.
        console.info("[PWA] Nova versão disponível (será aplicada no próximo refresh)");
      },
      onOfflineReady() {
        console.info("[PWA] Pronto para uso offline");
      },
    });
  } catch {
    /* noop */
  }
}