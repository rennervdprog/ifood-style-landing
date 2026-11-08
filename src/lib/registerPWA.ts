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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Espera o SW da versão nova terminar de instalar e ficar em "waiting"
 * (baixado e pronto para assumir). Resolve com o worker em espera, ou
 * null se o prazo acabar. Quem espera aqui NÃO está segurando nenhuma
 * interação do usuário — é trabalho de fundo.
 */
export async function waitForWaitingWorker(
  reg: ServiceWorkerRegistration,
  timeoutMs: number,
): Promise<ServiceWorker | null> {
  if (reg.waiting) return reg.waiting;
  const deadline = Date.now() + timeoutMs;
  return new Promise<ServiceWorker | null>((resolve) => {
    let done = false;
    const finish = (w: ServiceWorker | null) => {
      if (done) return;
      done = true;
      try {
        reg.removeEventListener("updatefound", onUpdateFound);
      } catch {}
      resolve(w);
    };
    const trackInstalling = (worker: ServiceWorker | null) => {
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && reg.waiting) finish(reg.waiting);
      });
    };
    const onUpdateFound = () => trackInstalling(reg.installing);
    try {
      reg.addEventListener("updatefound", onUpdateFound);
    } catch {}
    trackInstalling(reg.installing);
    // Rede de segurança: checagem periódica (alguns navegadores não
    // disparam todos os eventos com a aba em segundo plano).
    void (async () => {
      while (!done) {
        if (reg.waiting) return finish(reg.waiting);
        if (Date.now() >= deadline) return finish(null);
        await sleep(1000);
      }
    })();
  });
}

/**
 * Dispara a checagem de atualização do SW e espera a versão nova ficar
 * PRONTA (baixada e instalada, em "waiting"). O versionWatcher usa isto
 * para só avisar o usuário quando a troca é instantânea — o aviso nunca
 * aparece enquanto a versão nova ainda está baixando.
 */
export async function ensureUpdateReady(timeoutMs = 300_000): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    try {
      await reg.update();
    } catch {
      /* rede intermitente — a espera observa o que houver */
    }
    return (await waitForWaitingWorker(reg, timeoutMs)) != null;
  } catch {
    return false;
  }
}

/**
 * Aplica a atualização cujo SW já está em "waiting": pede SKIP_WAITING
 * e espera o `controllerchange`. Retorna true SOMENTE se o SW novo
 * assumiu de verdade — quem chama só recarrega nesse caso.
 *
 * NUNCA apagar caches aqui: o Cache Storage é compartilhado por TODAS
 * as abas abertas sob o mesmo SW (foi a causa do loop "Atualizando o
 * app..." de 2026-11-07 de manhã). Quem limpa o precache antigo é o
 * próprio SW novo, na ativação.
 *
 * Correção 2026-11-07 (noite — loop do "Atualizando…"): a versão anterior
 * esperava a instalação DEPOIS do clique (até 20 s) e quem chamava
 * recarregava a página MESMO quando a troca não acontecia. Com o
 * precache de ~6 MB numa rede móvel lenta, a instalação estourava o
 * prazo, o reload devolvia a página na versão velha (SW antigo no
 * comando) e o aviso reaparecia — loop infinito. Agora a instalação é
 * aguardada em segundo plano, ANTES do aviso (ensureUpdateReady), e
 * esta função só confirma uma troca que já está pronta.
 */
export async function applyServiceWorkerUpdate(timeoutMs = 8000): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    const waiting = reg.waiting ?? (await waitForWaitingWorker(reg, 5000));
    if (!waiting) return false;
    return await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => finish(false), timeoutMs);
      function finish(ok: boolean) {
        clearTimeout(timer);
        navigator.serviceWorker.removeEventListener("controllerchange", onChange);
        resolve(ok);
      }
      function onChange() {
        finish(true);
      }
      navigator.serviceWorker.addEventListener("controllerchange", onChange);
      waiting.postMessage({ type: "SKIP_WAITING" });
    });
  } catch {
    return false;
  }
}
