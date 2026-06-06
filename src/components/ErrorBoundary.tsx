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
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {}
    try {
      const regs = await navigator.serviceWorker?.getRegistrations();
      if (regs) await Promise.all(regs.map((r) => r.unregister()));
    } catch {}
    // Cache-buster na URL para garantir HTML/assets novos.
    // Se for retry após chunk error, vai para "/" para não tentar
    // recarregar a mesma rota cujo chunk falhou (evita loop).
    const target = goHome ? "/" : window.location.pathname + window.location.search;
    const sep = target.includes("?") ? "&" : "?";
    window.location.replace(target + sep + "_v=" + Date.now());
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);

    // Chunk error: limpar caches e forçar hard reload automático (1x por sessão)
    if (
      error.message?.includes("Failed to fetch dynamically imported module") ||
      error.message?.includes("Importing a module script failed") ||
      error.message?.includes("Loading chunk") ||
      error.name === "ChunkLoadError"
    ) {
      const reloadKey = "eb_chunk_reload_count";
      const count = parseInt(sessionStorage.getItem(reloadKey) || "0", 10);
      if (count < 1) {
        sessionStorage.setItem(reloadKey, String(count + 1));
        // Pequeno delay para feedback. Vai para "/" para evitar pedir o mesmo
        // chunk quebrado de novo (causa do loop percebido pelo usuário).
        setTimeout(() => this.hardReload(true), 600);
      }
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
              sessionStorage.removeItem("eb_chunk_reload_count");
              this.hardReload(true);
            }}
            className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold text-sm active:scale-95 transition-transform"
          >
            <RefreshCw className="h-4 w-4" />
            Recarregar agora
          </button>
          <p className="text-[11px] text-muted-foreground/70 mt-1">Se a tela não mudar em alguns segundos, toque no botão.</p>
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
