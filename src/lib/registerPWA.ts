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
    // Checa updates a cada 60s — captura erros p/ não vazar unhandled rejection ao Sentry.
    setInterval(() => {
      void (async () => {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          await reg?.update?.();
        } catch {
          /* falha transiente de rede — ignorada */
        }
      })();
    }, 60_000);
  } catch {
    /* noop */
  }
}

/**
 * Aplica uma atualização de SW que já esteja em "waiting", do jeito seguro:
 * força uma checagem, pede SKIP_WAITING e espera o `controllerchange`
 * antes de retornar — quem chama recarrega em seguida e cai no SW novo.
 *
 * NUNCA apaga caches aqui: o Cache Storage é compartilhado por TODAS as
 * abas abertas sob o mesmo SW. Apagar o precache com o SW antigo ainda no
 * comando foi a causa do loop "Atualizando o app..." de 2026-11-07 — as
 * abas sobreviventes ficavam sem os chunks antigos (apagados) e sem os
 * novos (o SW novo ainda não assumira), e cada reload repetia o erro.
 * Quem limpa precache antigo é o próprio SW novo, na ativação.
 *
 * Retorna true se havia um SW esperando e ele foi acionado.
 */
export async function applyServiceWorkerUpdate(timeoutMs = 4000): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    try {
      await reg.update();
    } catch {
      /* rede intermitente — segue com o que houver */
    }
    const waiting = reg.waiting;
    if (!waiting) return false;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(finish, timeoutMs);
      function finish() {
        clearTimeout(timer);
        navigator.serviceWorker.removeEventListener("controllerchange", onChange);
        resolve();
      }
      function onChange() {
        finish();
      }
      navigator.serviceWorker.addEventListener("controllerchange", onChange);
      waiting.postMessage({ type: "SKIP_WAITING" });
    });
    return true;
  } catch {
    return false;
  }
}
