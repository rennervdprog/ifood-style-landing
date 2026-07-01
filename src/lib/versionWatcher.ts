/**
 * Detecta novo build publicado comparando o BUILD_ID embutido no bundle
 * com o /version.json servido no domínio. Se mudou, força reload — mas
 * NUNCA no meio de checkout, PDV com sessão aberta ou app do motoboy em rota.
 *
 * Não roda em: dev, preview Lovable, iframe.
 */
import { BUILD_ID } from "@/lib/buildInfo";
import { Capacitor } from "@capacitor/core";

const POLL_MS = 60_000;
const CRITICAL_ROUTES = [
  /^\/checkout/,
  /^\/cart/,
  /^\/pdv/,
  /^\/motoboy/,
  /^\/driver/,
];

function isBlockedContext(): boolean {
  if (!import.meta.env.PROD) return true;
  if (typeof window === "undefined") return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host.endsWith(".lovableproject.com")) return true;
  if (host.endsWith(".lovableproject-dev.com")) return true;
  return false;
}

function isOnCriticalRoute(): boolean {
  const p = window.location.pathname;
  return CRITICAL_ROUTES.some((re) => re.test(p));
}

let started = false;
let pendingBuildId: string | null = null;

async function fetchRemoteBuildId(): Promise<string | null> {
  try {
    const url = `/version.json?t=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.buildId === "string" ? data.buildId : null;
  } catch {
    return null;
  }
}

async function applyUpdate(remoteId: string) {
  // Anti-loop: se já tentamos aplicar este mesmo buildId nesta aba
  // e após o reload ainda estamos no BUILD_ID antigo (SW servindo cache velho),
  // não recarrega de novo — evita tela branca em loop.
  try {
    const lastTried = sessionStorage.getItem("vw:lastTriedBuildId");
    if (lastTried === remoteId) {
      console.warn(`[VersionWatcher] Build ${remoteId} já tentado nesta sessão. Abortando loop.`);
      return;
    }
    sessionStorage.setItem("vw:lastTriedBuildId", remoteId);
  } catch {}

  console.info(`[VersionWatcher] Nova versão: ${BUILD_ID} → ${remoteId}. Recarregando...`);
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      reg?.waiting?.postMessage({ type: "SKIP_WAITING" });
      // Limpa caches do workbox pra garantir que o novo bundle seja baixado
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    }
  } catch {}
  setTimeout(() => {
    try { window.location.reload(); } catch {}
  }, 500);
}

async function tick() {
  if (document.hidden) return;
  const remote = await fetchRemoteBuildId();
  if (!remote || remote === BUILD_ID) return;

  // Em rota crítica: guarda pra aplicar quando sair
  if (isOnCriticalRoute()) {
    pendingBuildId = remote;
    return;
  }
  await applyUpdate(remote);
}

export function initVersionWatcher() {
  if (started) return;
  if (isBlockedContext()) return;
  // Em Capacitor nativo (APK empacotado sem hot-reload) também roda,
  // pois o webview carrega o mesmo domínio de produção.
  if (Capacitor.isNativePlatform() && !navigator.onLine) return;
  started = true;

  // Primeiro tick após 5s (deixa a UI hidratar)
  setTimeout(tick, 5_000);
  setInterval(tick, POLL_MS);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) tick();
  });
  window.addEventListener("online", tick);

  // Se saiu de rota crítica e há update pendente, aplica
  window.addEventListener("popstate", () => {
    if (pendingBuildId && !isOnCriticalRoute()) {
      const id = pendingBuildId;
      pendingBuildId = null;
      applyUpdate(id);
    }
  });

  console.info(`[VersionWatcher] ✅ Started (buildId=${BUILD_ID})`);
}