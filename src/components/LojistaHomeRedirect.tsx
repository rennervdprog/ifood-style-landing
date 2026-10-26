import { Navigate } from "react-router-dom";
import { useUserRouting } from "@/hooks/useUserRouting";
import { Loader2 } from "lucide-react";

/**
 * Wrapper de /admin que respeita a fonte da verdade: se o lojista é pdv_only,
 * redireciona direto pra /admin/pdv **antes** de montar o AdminDashboardV2,
 * eliminando o double-redirect e o spinner extra do useStorePlan.
 *
 * Admin bypass (igual ao RoleGuard): o admin da plataforma não tem "loja
 * principal" — ele abre o painel de qualquer loja (inclusive via ?storeId=)
 * sem cair no PDV. Sem isso, um admin com várias lojas pode ser tratado
 * como pdv_only porque o get_user_routing_context escolhe um plano
 * arbitrário (LIMIT 1 sem ORDER BY) entre as lojas dele — foi o que jogou
 * todo /admin do Renner para o PDV da loja de teste Boutique.
 */
const LojistaHomeRedirect = ({ children }: { children: React.ReactNode }) => {
  const { loading, isAdmin, isPdvOnly, storeId } = useUserRouting();
  // Spinner em vez de tela branca enquanto o roteamento carrega
  // (antes: `return null`).
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  // Admin não é redirecionado: o redirect de pdv_only vale para o lojista
  // dono da loja, não para o admin simulando o painel de outra loja.
  if (isAdmin) {
    return <>{children}</>;
  }
  if (isPdvOnly) {
    const target = storeId ? `/admin/pdv?storeId=${storeId}` : "/admin/pdv";
    return <Navigate to={target} replace />;
  }
  return <>{children}</>;
};

export default LojistaHomeRedirect;
