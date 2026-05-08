import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isCapacitorNative } from "@/lib/capacitorNative";
import { detectAndPersistNativeAppMode, getCapacitorAppMode, persistCapacitorAppMode, type CapacitorAppMode } from "@/lib/capacitorAppMode";
import { useAuth } from "@/contexts/AuthContext";
import { resolvePartnerDashboard } from "@/lib/partnerDashboard";

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
  "/entregador2",
  "/cadastro-entregador",
  "/cadastro-lojista",
  "/cadastro-motoboy-loja",
  "/parceiro",
  "/painel",
  "/super-admin",
  "/planos",
  "/moderador",
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
  "/entregador2",
  "/super-admin",
  "/painel",
  "/parceiro",
  "/moderador",
  "/cadastro-entregador",
  "/cadastro-lojista",
  "/cadastro-motoboy-loja",
  "/planos",
  "/auth",
  "/termos-de-uso",
   "/politica-de-privacidade",
   "/auth",
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
   "/cupons",
   "/sac",
];

const CapacitorRouteGuard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [appMode, setAppMode] = useState<CapacitorAppMode | null>(() => getCapacitorAppMode());

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
           (async () => {
             const dest = await resolvePartnerDashboard(user.id);
             navigate(dest, { replace: true });
           })();
         } else if (!authLoading) {
           navigate("/portal-parceiro", { replace: true });
         }
       } else if (path === "/portal-parceiro" && user && !authLoading) {
         (async () => {
           const dest = await resolvePartnerDashboard(user.id);
           if (dest !== "/portal-parceiro") {
             navigate(dest, { replace: true });
           }
         })();
       }
     } else if (currentMode === "client") {
       const isPartnerRoute = PARTNER_ROUTES.some(
         (route) => path === route || path.startsWith(route + "/")
       );
 
       const isWhitelistedClientRoute = CLIENT_ALLOWED_PREFIXES.some(
         (route) => path === route || path.startsWith(route + "/")
       );
 
       if (isPartnerRoute || !isWhitelistedClientRoute) {
         if (path !== "/cliente" && path !== "/") {
           navigate("/cliente", { replace: true });
         }
       }
 
       if (path === "/") {
         navigate("/cliente", { replace: true });
       }
     }
  }, [location.pathname, navigate, user?.id, authLoading, appMode]);

  return null;
};

export default CapacitorRouteGuard;
