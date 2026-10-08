import { Navigate } from "react-router-dom";
import { useUserRouting } from "@/hooks/useUserRouting";
import { Loader2 } from "lucide-react";

/**
 * Wrapper de /admin que respeita a fonte da verdade: se o lojista é pdv_only,
 * redireciona direto pra /admin/pdv **antes** de montar o AdminDashboardV2,
 * eliminando o double-redirect e o spinner extra do useStorePlan.
 */
const LojistaHomeRedirect = ({ children }: { children: React.ReactNode }) => {
  const { loading, isPdvOnly, storeId } = useUserRouting();
  // Spinner em vez de tela branca enquanto o roteamento carrega
  // (antes: `return null`).
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (isPdvOnly) {
    const target = storeId ? `/admin/pdv?storeId=${storeId}` : "/admin/pdv";
    return <Navigate to={target} replace />;
  }
  return <>{children}</>;
};

export default LojistaHomeRedirect;
