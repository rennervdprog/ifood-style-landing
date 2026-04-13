import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isCapacitorNative } from "@/lib/capacitorNative";

/**
 * On Capacitor Android PARCEIRO app, restrict navigation to partner-only routes.
 * On Capacitor Android CLIENTE app, block access to partner routes.
 * 
 * Detection: The parceiro app injects __CAP_PARTNER_REDIRECTED flag in index.html.
 * If that flag is absent and we're in Capacitor, it's the cliente app.
 */
const PARTNER_ROUTES = [
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

const CLIENT_ALLOWED_ROUTES = [
  "/",
  "/cliente",
  "/loja",
  "/carrinho",
  "/checkout",
  "/pedidos",
  "/perfil",
  "/auth",
  "/termos-de-uso",
  "/politica-de-privacidade",
];

let isPartnerApp: boolean | null = null;

function detectPartnerApp(): boolean {
  if (isPartnerApp !== null) return isPartnerApp;
  isPartnerApp = !!(window as any).__CAP_PARTNER_REDIRECTED;
  return isPartnerApp;
}

const CapacitorRouteGuard = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isCapacitorNative()) return;

    const path = location.pathname;

    if (detectPartnerApp()) {
      // PARCEIRO app: only allow partner routes
      const isAllowed = PARTNER_ROUTES.some(
        (route) => path === route || path.startsWith(route + "/")
      ) || path === "/auth" || path === "/termos-de-uso" || path === "/politica-de-privacidade";

      if (!isAllowed) {
        navigate("/portal-parceiro", { replace: true });
      }
    } else {
      // CLIENTE app: block partner-only routes, send to home
      const isPartnerRoute = PARTNER_ROUTES.some(
        (route) => path === route || path.startsWith(route + "/")
      );

      if (isPartnerRoute) {
        navigate("/", { replace: true });
      }
    }
  }, [location.pathname, navigate]);

  return null;
};

export default CapacitorRouteGuard;
