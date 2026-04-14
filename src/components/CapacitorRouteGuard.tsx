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
  // Check window flag (set by injected script before redirect)
  if ((window as any).__CAP_PARTNER_REDIRECTED) {
    try { sessionStorage.setItem("cap_partner", "1"); } catch {}
    isPartnerApp = true;
    return true;
  }
  // Check persisted flag (survives the full-page redirect)
  try {
    if (sessionStorage.getItem("cap_partner") === "1") {
      isPartnerApp = true;
      return true;
    }
  } catch {}
  isPartnerApp = false;
  return false;
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
