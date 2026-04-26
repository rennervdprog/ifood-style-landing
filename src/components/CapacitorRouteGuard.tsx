import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isCapacitorNative } from "@/lib/capacitorNative";
import { getCapacitorAppMode, isPartnerCapacitorApp, persistCapacitorAppMode } from "@/lib/capacitorAppMode";

/**
 * On Capacitor Android PARCEIRO app, restrict navigation to partner-only routes.
 * On Capacitor Android CLIENTE app, block access to partner routes.
 *
 * Detection priority:
 * 1) explicit `?capApp=partner|client` in the initial native URL
 * 2) persisted app mode in storage
 * 3) legacy partner flag for backward compatibility
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
];

const CapacitorRouteGuard = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isCapacitorNative()) return;

    const path = location.pathname;
    const appMode = getCapacitorAppMode();

    if (!appMode) {
      const looksLikePartnerRoute = PARTNER_ROUTES.some(
        (route) => path === route || path.startsWith(route + "/")
      );
      persistCapacitorAppMode(looksLikePartnerRoute ? "partner" : "client");
    }

    if (isPartnerCapacitorApp()) {
      // PARCEIRO app: only allow partner routes
      const isAllowed = PARTNER_ROUTES.some(
        (route) => path === route || path.startsWith(route + "/")
      ) || path === "/termos-de-uso" || path === "/politica-de-privacidade";

      if (!isAllowed) {
        // Se estiver autenticado e for admin ou lojista, talvez esteja no lugar errado, 
        // mas a regra geral para o app parceiro é ficar nas rotas de parceiro.
        navigate("/portal-parceiro", { replace: true });
      }
    } else {
      // CLIENTE app: block partner-only routes, send to /cliente
      const isPartnerRoute = PARTNER_ROUTES.some(
        (route) => path === route || path.startsWith(route + "/")
      );

      if (isPartnerRoute) {
        navigate("/cliente", { replace: true });
      }

      // Also redirect landing page "/" to /cliente in client app
      if (path === "/") {
        navigate("/cliente", { replace: true });
      }
    }
  }, [location.pathname, navigate]);

  return null;
};

export default CapacitorRouteGuard;
