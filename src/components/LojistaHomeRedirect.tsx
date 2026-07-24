import { Navigate } from "react-router-dom";
import { useUserRouting } from "@/hooks/useUserRouting";

/**
 * Wrapper de /admin que respeita a fonte da verdade: se o lojista é pdv_only,
 * redireciona direto pra /admin/pdv **antes** de montar o AdminDashboardV2,
 * eliminando o double-redirect e o spinner extra do useStorePlan.
 */
const LojistaHomeRedirect = ({ children }: { children: React.ReactNode }) => {
  const { loading, isPdvOnly, storeId } = useUserRouting();
  if (loading) return null; // RoleGuard já mostrou o spinner
  if (isPdvOnly) {
    const target = storeId ? `/admin/pdv?storeId=${storeId}` : "/admin/pdv";
    return <Navigate to={target} replace />;
  }
  return <>{children}</>;
};

export default LojistaHomeRedirect;