import { Navigate, Outlet } from "react-router-dom";
import { useUserRouting } from "@/hooks/useUserRouting";
import { useStorePlan } from "@/hooks/useStorePlan";

/**
 * Gate do módulo PDV (add-on pago).
 * Só libera /admin/pdv* e /admin/cardapio para lojas com `pdv_enabled`
 * ou plano `pdv_only`. Admin da plataforma passa direto.
 */
export function PdvAccessLayout() {
  const { loading, isAdmin, isPdvOnly, storeId } = useUserRouting();
  const plan = useStorePlan(storeId);

  if (isAdmin) return <Outlet />;
  if (loading || plan.isLoading) return null;
  if (isPdvOnly || plan.pdvEnabled || plan.planType === "pdv_only") return <Outlet />;
  return <Navigate to="/admin" replace />;
}

export default PdvAccessLayout;
