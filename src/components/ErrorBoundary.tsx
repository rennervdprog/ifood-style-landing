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

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);

    // Chunk error: forçar hard reload automático (uma vez por sessão)
    if (
      error.message?.includes("Failed to fetch dynamically imported module") ||
      error.name === "ChunkLoadError"
    ) {
      const reloadKey = "eb_chunk_reload";
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, "1");
        window.location.reload();
      }
    }
  }

  public render() {
    if (!this.state.hasError) return this.props.children;

    // Chunk error: mostrar tela mínima enquanto recarrega
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
