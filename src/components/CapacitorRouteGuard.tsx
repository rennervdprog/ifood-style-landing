import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isCapacitorNative } from "@/lib/capacitorNative";
import { detectAndPersistNativeAppMode, getCapacitorAppMode, persistCapacitorAppMode, type CapacitorAppMode } from "@/lib/capacitorAppMode";
import { useAuth } from "@/contexts/AuthContext";
import { resolvePartnerDashboard } from "@/lib/partnerDashboard";
import { queryClient } from "@/lib/queryClient";
import { USER_ROUTING_QUERY_KEY, type UserRoutingSnapshot } from "@/hooks/useUserRouting";

// Tenta ler o destino direto do cache do useUserRouting; se estiver quente,
// evita um round-trip completo e o spinner de "blocking".
function readCachedHome(userId: string): string | null {
  const snap = queryClient.getQueryData<UserRoutingSnapshot>([USER_ROUTING_QUERY_KEY, userId]);
  return snap?.homeRoute ?? null;
}

/**
 * On Capacitor Android PARCEIRO app, restrict navigation to partner-only routes.
 * On Capacitor Android CLIENTE app, block access to partner routes.
 *
 * Detection priority:
 * 1) native appId (app.itasuper.parceiro / app.itasuper.cliente) — definitive
 * 2) explicit `?capApp=partner|client` in the initial native URL
 * 3) persisted app mode in storage
 * 4) legacy partner flag for backward compatibility
 */
export const PARTNER_ROUTES = [
  "/portal-parceiro",
  "/admin",
  "/entregador",
  "/cadastro-entregador",
  "/cadastro-lojista",
  "/cadastro-motoboy-loja",
  "/parceiro",
  "/painel",
  "/super-admin",
  "/planos",
  "/moderador",
  "/matriz",
  "/suporte",
  "/revendedor",
  "/seja-revendedor",
];

/**
 * No APK Parceiro, somente estas rotas são permitidas. Qualquer outra
 * (inclusive catch-all `/:slug` que renderia uma loja como cliente) é
 * redirecionada para `/portal-parceiro` (ou painel adequado se logado).
 */
const PARTNER_ALLOWED_PREFIXES = [
  "/portal-parceiro",
  "/admin",
  "/entregador",
  "/super-admin",
  "/painel",
  "/parceiro",
  "/moderador",
  "/matriz",
  "/suporte",
  "/cadastro-entregador",
  "/cadastro-lojista",
  "/cadastro-motoboy-loja",
  "/planos",
  "/auth",
  "/termos-de-uso",
   "/politica-de-privacidade",
 ];
 
 /**
  * No APK Cliente, bloqueia acesso às rotas de parceiro.
  */
 const CLIENT_ALLOWED_PREFIXES = [
   "/cliente",
   "/loja",
   "/carrinho",
   "/checkout",
   "/pedidos",
   "/perfil",
   "/auth",
   "/termos-de-uso",
   "/politica-de-privacidade",
   "/pesquisa",
   "/categorias",
   "/historico",
   "/favoritos",
   "/cupons",
   "/ajuda",
   "/configuracoes",
   "/notificacoes",
   "/sac",
];

const CapacitorRouteGuard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [appMode, setAppMode] = useState<CapacitorAppMode | null>(() => getCapacitorAppMode());
  const [blocking, setBlocking] = useState(false);

  useEffect(() => {
    if (!isCapacitorNative()) return;

    const path = location.pathname;
    const currentMode = getCapacitorAppMode() || appMode;

    if (!currentMode) {
      const looksLikePartnerRoute = PARTNER_ROUTES.some(
        (route) => path === route || path.startsWith(route + "/")
      );
      if (looksLikePartnerRoute) {
        persistCapacitorAppMode("partner");
        setAppMode("partner");
      } else {
        detectAndPersistNativeAppMode().then((mode) => {
          if (mode) setAppMode(mode);
        });
      }
      return;
    }

     if (currentMode === "partner") {
       console.log("[CapRouteGuard] Partner Mode active. Path:", path);
       const isAllowed = PARTNER_ALLOWED_PREFIXES.some(
         (route) => path === route || path.startsWith(route + "/")
       );
 
       const isDashboardRoute = ["/super-admin", "/admin", "/entregador"].some(
         (route) => path === route || path.startsWith(route + "/")
       );
 
       if (!isAllowed) {
          if (!authLoading && user) {
            const cachedDest = readCachedHome(user.id);
            if (cachedDest) {
              navigate(cachedDest, { replace: true });
              setBlocking(false);
              return;
            }
            setBlocking(true);
            (async () => {
              const dest = await resolvePartnerDashboard(user.id);
              navigate(dest, { replace: true });
              setBlocking(false);
            })();
          } else if (!authLoading) {
           navigate("/portal-parceiro", { replace: true });
           setBlocking(false);
         }
       } else if (path === "/portal-parceiro" && user && !authLoading) {
         setBlocking(false);
          const cachedDest = readCachedHome(user.id);
          if (cachedDest && cachedDest !== "/portal-parceiro") {
            navigate(cachedDest, { replace: true });
          } else {
            (async () => {
              const dest = await resolvePartnerDashboard(user.id);
              if (dest !== "/portal-parceiro") {
                navigate(dest, { replace: true });
              }
            })();
          }
       } else {
         setBlocking(false);
       }
     } else if (currentMode === "client") {
       const isPartnerRoute = PARTNER_ROUTES.some(
         (route) => path === route || path.startsWith(route + "/")
       );
 
       // BLACKLIST: no APK Cliente só bloqueamos rotas de parceiro/admin.
       // Tudo mais (incluindo `/:slug` de loja, `/loja/:id`, `/cidade/*`,
       // `/busca`, `/pesquisa`, etc.) é liberado — evita ficar preso em /cliente
       // ao clicar em cards de loja/produto que resolvem para slug dinâmico.
       if (isPartnerRoute) {
         navigate("/cliente", { replace: true });
         return;
       }

       // `/` → `/cliente` (home padrão do APK Cliente).
       if (path === "/") {
         navigate("/cliente", { replace: true });
       }
     }
  }, [location.pathname, navigate, user?.id, authLoading, appMode]);

  if (blocking) {
    // Sem spinner — o Suspense global já cobre com delay se necessário.
    return <div className="fixed inset-0 z-[9999] bg-background" />;
  }
  return null;
};

export default CapacitorRouteGuard;
