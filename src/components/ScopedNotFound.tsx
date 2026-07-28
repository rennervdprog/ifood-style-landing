import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Home, ArrowLeft } from "lucide-react";

interface Props {
  /** Rótulo curto do escopo, ex: "Admin", "PDV", "Entregador". */
  scope: string;
  /** Rota "home" do escopo — botão principal. Ex: "/admin", "/entregador". */
  homePath: string;
}

/**
 * 404 escopado por sub-árvore de rotas.
 * Ex.: em `/admin/foo-invalida`, ao invés de cair no catch-all `/:slug` (loja) ou
 * no 404 genérico, mostra um 404 contextual com CTA para a home do domínio.
 */
export function ScopedNotFound({ scope, homePath }: Props) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error(`[404:${scope}] rota não encontrada:`, location.pathname);
  }, [scope, location.pathname]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center px-6">
      <div className="text-6xl mb-4">🧭</div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{scope}</div>
      <h1 className="text-3xl font-bold text-foreground mb-2">Página não encontrada</h1>
      <p className="text-sm text-muted-foreground mb-8 max-w-xs">
        A rota <code className="text-xs">{location.pathname}</code> não existe dentro de {scope}.
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={() => navigate(homePath)}
          className="flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-2xl py-3 px-6 font-semibold hover:bg-primary/90 transition-colors"
        >
          <Home className="h-4 w-4" />
          Ir para {scope}
        </button>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center gap-2 bg-muted text-foreground rounded-2xl py-3 px-6 font-semibold hover:bg-muted/70 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
      </div>
    </div>
  );
}

export default ScopedNotFound;