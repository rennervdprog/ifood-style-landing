import { Navigate, Outlet } from "react-router-dom";
import { useUserRouting } from "@/hooks/useUserRouting";
import { useStorePlan } from "@/hooks/useStorePlan";
import { Loader2 } from "lucide-react";

/**
 * Spinner de tela cheia enquanto o roteamento/plano carrega.
 * (PageLoader de App.tsx não é exportado; usa-se o mesmo padrão
 * de Loader2 + animate-spin dos demais fallbacks do app.)
 */
function PdvLoadingFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

/**
 * Gate do módulo PDV (add-on pago).
 * Só libera /admin/pdv* e /admin/cardapio para lojas com `pdv_enabled`
 * ou plano `pdv_only`. Admin da plataforma passa direto.
 */
export function PdvAccessLayout() {
  const { loading, isAdmin, isPdvOnly, storeId } = useUserRouting();
  const plan = useStorePlan(storeId);

  if (isAdmin) return <Outlet />;
  if (loading || plan.isLoading) return <PdvLoadingFallback />;
  if (isPdvOnly || plan.pdvEnabled || plan.planType === "pdv_only") return <Outlet />;
  return <Navigate to="/admin" replace />;
}

export default PdvAccessLayout;
