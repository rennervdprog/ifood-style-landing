/**
 * Detecta novo build publicado comparando o BUILD_ID embutido no bundle
 * com o /version.json servido no domínio. Avisa com um toast
 * "Nova versão disponível" — o reload só acontece quando o usuário toca
 * em "Atualizar".
 *
 * O aviso NÃO é guardado no painel do lojista (/admin e /admin-teste):
 * o toast não interrompe nada (não recarrega sozinho), então o lojista
 * pode decidir quando atualizar. Nas demais rotas críticas (checkout,
 * carrinho, PDV público, motoboy em rota) ele continua guardado e só
 * aparece ao sair da rota, para não atrapalhar venda/atendimento.
 *
 * Não roda em: dev, preview Lovable, iframe.
 */
import { BUILD_ID } from "@/lib/buildInfo";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";

const POLL_MS = 60_000;
// Rotas em que o aviso fica GUARDADO até sair da rota (não interromper
// venda/atendimento em andamento). O painel NÃO está aqui: o toast não
// interrompe nada — o reload só acontece no toque em "Atualizar".
const CRITICAL_ROUTES = [
  /^\/checkout/,
  /^\/cart/,
  /^\/pdv/,
  /^\/motoboy/,
  /^\/driver/,
];
// Painel do lojista (original e /admin-teste — mesmo watcher, sem variante
// Teste): o aviso aparece aqui também, e fica na tela até o usuário decidir
// (não some sozinho em 15 s). Inclui o /admin/pdv — o toast não interrompe
// a venda, só o toque em "Atualizar" recarrega.
const PANEL_ROUTES = [/^\/admin/];

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

function isOnPanelRoute(): boolean {
  const p = window.location.pathname;
  return PANEL_ROUTES.some((re) => re.test(p));
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

let notifiedForBuild: string | null = null;

async function applyUpdate(remoteId: string, opts?: { persistent?: boolean }) {
  // Anti-loop persistente (entre reloads): se já tentamos este build
  // recentemente e ainda estamos no BUILD_ID antigo, não força reload
  // — apenas avisa o usuário para evitar tela preta/laranja em loop.
  const key = "vw:lastTriedBuildId";
  let alreadyTried = false;
  try {
    alreadyTried = localStorage.getItem(key) === remoteId;
    localStorage.setItem(key, remoteId);
  } catch {}

  if (notifiedForBuild === remoteId) return;
  notifiedForBuild = remoteId;

  console.info(`[VersionWatcher] Nova versão detectada: ${BUILD_ID} → ${remoteId}${alreadyTried ? " (já tentada)" : ""}${opts?.persistent ? " (painel — aviso fixo)" : ""}`);

  // Notificação não-bloqueante — o usuário decide quando atualizar.
  // No painel o toast é persistente (duration: Infinity, documentado no
  // Sonner): não some sozinho sem o usuário ver/decidir. Se ele dispensar
  // no X, respeitamos — o aviso volta no próximo carregamento da página.
  toast("Nova versão disponível", {
    description: "Toque em Atualizar quando quiser recarregar.",
    duration: opts?.persistent ? Infinity : 15_000,
    action: {
      label: "Atualizar",
      onClick: async () => {
        try {
          if ("serviceWorker" in navigator) {
            const reg = await navigator.serviceWorker.getRegistration();
            reg?.waiting?.postMessage({ type: "SKIP_WAITING" });
            if ("caches" in window) {
              const keys = await caches.keys();
              await Promise.all(keys.map((k) => caches.delete(k)));
            }
          }
        } catch {}
        try { window.location.reload(); } catch {}
      },
    },
  });
}

async function tick() {
  if (document.hidden) return;
  const remote = await fetchRemoteBuildId();
  if (!remote || remote === BUILD_ID) return;

  // No painel o aviso aparece e fica até o usuário decidir.
  if (isOnPanelRoute()) {
    await applyUpdate(remote, { persistent: true });
    return;
  }

  // Nas demais rotas críticas: guarda pra aplicar quando sair
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
      // Se voltou para o painel, o aviso é fixo; fora dele, 15 s.
      applyUpdate(id, { persistent: isOnPanelRoute() });
    }
  });

  console.info(`[VersionWatcher] ✅ Started (buildId=${BUILD_ID})`);
}