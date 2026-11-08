/**
 * Detecta novo build publicado comparando o BUILD_ID embutido no bundle
 * com o /version.json servido no domínio.
 *
 * O aviso "Nova versão disponível" SÓ aparece quando a versão nova já
 * foi baixada e instalada pelo Service Worker (estado "waiting") —
 * assim, tocar em "Atualizar" troca na hora e recarrega já na versão
 * nova. Enquanto a versão nova ainda está baixando (o precache tem
 * ~6 MB), o watcher espera em segundo plano, sem mostrar nada.
 *
 * Histórico do porquê (2026-11-07): o aviso aparecia segundos após o
 * deploy, com a versão nova ainda baixando; o clique esperava a
 * instalação por até 20 s e, ao estourar o prazo, a página recarregava
 * MESMO ASSIM — de volta na versão velha, com o aviso reaparecendo:
 * loop do "Atualizando…". Nunca recarregar sem o SW novo ter assumido.
 *
 * O aviso é persistente (não some sozinho) em todo o site. Em rotas
 * críticas (checkout, carrinho, PDV público, motoboy em rota) ele fica
 * guardado e só aparece ao sair da rota, para não atrapalhar
 * venda/atendimento.
 *
 * Não roda em: dev, preview Lovable, iframe.
 */
import { BUILD_ID } from "@/lib/buildInfo";
import { applyServiceWorkerUpdate, ensureUpdateReady } from "@/lib/registerPWA";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";

const POLL_MS = 60_000;
// Rotas em que o aviso fica GUARDADO até sair da rota (não interromper
// venda/atendimento em andamento). O painel do lojista NÃO está aqui:
// o toast não interrompe nada — o reload só acontece no toque em
// "Atualizar".
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

// Anti-loop: se o usuário já tentou atualizar para este build nesta
// sessão e a troca não completou, não mostramos o aviso de novo — ele
// volta no próximo abrir do app (fechar e abrir resolve pelo SW em
// espera, que assume quando o app fecha por completo).
const SUPPRESS_KEY = "vw:updateSuppressedFor";

function isSuppressed(remoteId: string): boolean {
  try {
    return sessionStorage.getItem(SUPPRESS_KEY) === remoteId;
  } catch {
    return false;
  }
}

function suppress(remoteId: string) {
  try {
    sessionStorage.setItem(SUPPRESS_KEY, remoteId);
  } catch {}
}

let promptedForBuild: string | null = null;
let preparingBuild: string | null = null;

/**
 * Espera a versão nova ficar pronta (SW em "waiting") e SÓ ENTÃO
 * mostra o aviso. Se o download não completar (rede fora do ar etc.),
 * não mostra nada — o próximo ciclo tenta de novo.
 */
async function prepareAndPrompt(remoteId: string) {
  if (promptedForBuild === remoteId || preparingBuild === remoteId) return;
  if (isSuppressed(remoteId)) return;
  preparingBuild = remoteId;
  let ready = false;
  try {
    ready = await ensureUpdateReady();
  } catch {
    ready = false;
  } finally {
    if (preparingBuild === remoteId) preparingBuild = null;
  }
  if (!ready) {
    console.info(
      `[VersionWatcher] Nova versão ${remoteId} detectada, mas o download não completou — novo ciclo tenta de novo.`,
    );
    return;
  }
  if (promptedForBuild === remoteId || isSuppressed(remoteId)) return;
  promptedForBuild = remoteId;

  console.info(`[VersionWatcher] Versão pronta para instalar: ${BUILD_ID} → ${remoteId}`);

  toast("Nova versão disponível", {
    description: "Toque em Atualizar para recarregar na versão nova.",
    duration: Infinity,
    action: {
      label: "Atualizar",
      onClick: async () => {
        // A versão já está baixada e em espera: a troca é rápida.
        // O aviso de progresso é só o feedback do toque.
        const progressId = toast("Atualizando para a nova versão…", {
          description: "Pode levar alguns segundos. Não feche o app.",
          duration: Infinity,
        });
        let ok = false;
        try {
          ok = await applyServiceWorkerUpdate();
        } catch {}
        if (ok) {
          try {
            window.location.reload();
          } catch {}
          return;
        }
        // Sem reload às cegas: recarregar sem o SW novo ter assumido
        // devolve a página na versão velha e o aviso volta — o loop
        // de 2026-11-07. Suprime o aviso deste build nesta sessão e
        // orienta o destrave manual.
        try {
          toast.dismiss(progressId);
        } catch {}
        suppress(remoteId);
        toast("A atualização não completou", {
          description:
            "Feche o app por completo e abra de novo para entrar na versão nova.",
          duration: 12_000,
        });
      },
    },
  });
}

async function tick() {
  if (document.hidden) return;
  const remote = await fetchRemoteBuildId();
  if (!remote || remote === BUILD_ID) return;

  // Nas rotas críticas: guarda pra avisar quando sair da rota.
  if (isOnCriticalRoute()) {
    pendingBuildId = remote;
    return;
  }
  void prepareAndPrompt(remote);
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

  // Se saiu de rota crítica e há update pendente, prepara e avisa
  window.addEventListener("popstate", () => {
    if (pendingBuildId && !isOnCriticalRoute()) {
      const id = pendingBuildId;
      pendingBuildId = null;
      void prepareAndPrompt(id);
    }
  });

  console.info(`[VersionWatcher] ✅ Started (buildId=${BUILD_ID})`);
}
