import { Component, ErrorInfo, ReactNode } from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";

interface Props { children: ReactNode }
interface State { hasError: boolean; error?: Error; isChunkError: boolean }

/**
 * ErrorBoundary global — captura erros de lazy imports (chunk não encontrado)
 * e erros de renderização evitando tela branca.
 *
 * Chunk errors ocorrem quando o service worker entrega um bundle antigo
 * após um novo deploy. A solução é forçar um hard reload.
 */
class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, isChunkError: false };

  public static getDerivedStateFromError(error: Error): State {
    // Detectar chunk error (bundle antigo no cache)
    const isChunkError =
      error.message?.includes("Failed to fetch dynamically imported module") ||
      error.message?.includes("Importing a module script failed") ||
      error.message?.includes("Loading chunk") ||
      error.name === "ChunkLoadError";

    return { hasError: true, error, isChunkError };
  }

  private async hardReload(goHome = false) {
    // Último recurso MANUAL: desregistra o SW e navega com cache-buster.
    // NÃO apaga caches: o Cache Storage é compartilhado por todas as abas
    // abertas sob o mesmo SW — apagar o precache com o SW antigo ainda no
    // comando travou as abas no loop "Atualizando o app..." de 2026-11-07
    // (sem os chunks antigos no cache e sem o SW novo no comando, cada
    // reload repetia o erro de chunk).
    try {
      const regs = await navigator.serviceWorker?.getRegistrations();
      if (regs) await Promise.all(regs.map((r) => r.unregister()));
    } catch {}
    // goHome=true (botão manual, último recurso) vai para "/" — o reload
    // automático usa goHome=false e volta para a mesma rota.
    const target = goHome ? "/" : window.location.pathname + window.location.search;
    const sep = target.includes("?") ? "&" : "?";
    window.location.replace(target + sep + "_v=" + Date.now());
  }

  // Recuperação automática de chunk error SEM tocar em caches nem
  // desregistrar o SW: se há um SW novo esperando, aciona ele
  // (SKIP_WAITING) e espera assumir (controllerchange, até 4s) antes de
  // navegar de volta para a mesma rota com cache-buster. Sem SW novo, a
  // navegação com cache-buster busca o HTML atual do servidor.
  private async recoverInPlace() {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) {
        try { await reg.update(); } catch {}
        if (reg.waiting) {
          await new Promise<void>((resolve) => {
            const timer = setTimeout(finish, 4000);
            function finish() {
              clearTimeout(timer);
              navigator.serviceWorker.removeEventListener("controllerchange", onChange);
              resolve();
            }
            function onChange() { finish(); }
            navigator.serviceWorker.addEventListener("controllerchange", onChange);
            reg.waiting?.postMessage({ type: "SKIP_WAITING" });
          });
        }
      }
    } catch {}
    const target = window.location.pathname + window.location.search;
    const sep = target.includes("?") ? "&" : "?";
    window.location.replace(target + sep + "_v=" + Date.now());
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);

    // Chunk error: recuperar NA MESMA ROTA, sem apagar caches e sem
    // desregistrar o SW (ver recoverInPlace). Orçamento COMPARTILHADO
    // entre abas (localStorage, não sessionStorage): no máximo 2
    // tentativas automáticas por janela de 10 minutos em TODO o
    // navegador — com várias abas abertas, o contador por aba não
    // impedia o loop de uma aba re-disparando a outra (2026-11-07).
    // Esgotado o orçamento, fica só a tela com o botão manual.
    if (
      error.message?.includes("Failed to fetch dynamically imported module") ||
      error.message?.includes("Importing a module script failed") ||
      error.message?.includes("Loading chunk") ||
      error.name === "ChunkLoadError"
    ) {
      const budgetKey = "eb_chunk_recovery_v2";
      const WINDOW_MS = 10 * 60 * 1000;
      const MAX_TRIES = 2;
      try {
        const now = Date.now();
        let rec: { count: number; firstAt: number } = { count: 0, firstAt: now };
        try {
          const raw = localStorage.getItem(budgetKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed.count === "number" && typeof parsed.firstAt === "number" && now - parsed.firstAt < WINDOW_MS) {
              rec = parsed;
            }
          }
        } catch {}
        if (rec.count < MAX_TRIES) {
          localStorage.setItem(budgetKey, JSON.stringify({ count: rec.count + 1, firstAt: rec.firstAt }));
          // Pequeno delay para feedback.
          setTimeout(() => this.recoverInPlace(), 600);
        }
      } catch {}
    }
  }

  public render() {
    if (!this.state.hasError) return this.props.children;

    // Chunk error: mostrar tela com botão manual caso o auto-reload falhe
    if (this.state.isChunkError) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <RefreshCw className="h-6 w-6 text-primary animate-spin" />
          </div>
          <div className="text-center space-y-1">
            <p className="font-bold text-foreground">Atualizando o app...</p>
            <p className="text-sm text-muted-foreground">Nova versão disponível. Recarregando.</p>
          </div>
          <button
            onClick={() => {
              try { localStorage.removeItem("eb_chunk_recovery_v2"); } catch {}
              try { sessionStorage.removeItem("eb_chunk_reload_count"); } catch {}
              this.hardReload(true);
            }}
            className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm active:scale-95 transition-transform"
          >
            <RefreshCw className="h-4 w-4" />
            Recarregar agora
          </button>
          <p className="text-[11px] text-muted-foreground/70 mt-1">Se a tela não mudar em alguns segundos, toque no botão.</p>
          <p className="text-[11px] text-muted-foreground/70">Se o problema continuar, feche as outras abas do ItaSuper — uma aba antiga aberta mantém a versão velha no comando.</p>
        </div>
      );
    }

    // Erro genérico: mostrar botão para tentar novamente
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-5 p-6">
        <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <div className="text-center space-y-2 max-w-sm">
          <p className="text-lg font-black text-foreground">Algo deu errado</p>
          <p className="text-sm text-muted-foreground">
            Ocorreu um erro inesperado. Tente recarregar a página.
          </p>
          {this.state.error?.message && (
            <p className="text-[11px] text-muted-foreground/60 font-mono bg-muted/30 rounded-lg px-3 py-2 mt-2">
              {this.state.error.message.slice(0, 100)}
            </p>
          )}
        </div>
        <button
          onClick={() => {
            sessionStorage.removeItem("eb_chunk_reload");
            window.location.reload();
          }}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm active:scale-95 transition-transform"
        >
          <RefreshCw className="h-4 w-4" />
          Recarregar página
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
