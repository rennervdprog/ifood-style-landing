import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isCapacitorNative } from "@/lib/capacitorNative";

/**
 * On Capacitor Android PARCEIRO app, restrict navigation to partner-only routes.
 * On Capacitor Android CLIENTE app, block access to partner routes.
 *
 * Detection priority:
 * 1) explicit `?capApp=partner|client` in the initial native URL
 * 2) persisted app mode in storage
 * 3) legacy partner flag for backward compatibility
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

const APP_MODE_KEY = "cap_app_mode";
const LEGACY_PARTNER_KEY = "cap_partner";

let isPartnerApp: boolean | null = null;

function persistAppMode(mode: "partner" | "client") {
  isPartnerApp = mode === "partner";

  try {
    sessionStorage.setItem(APP_MODE_KEY, mode);
    localStorage.setItem(APP_MODE_KEY, mode);

    if (mode === "partner") {
      sessionStorage.setItem(LEGACY_PARTNER_KEY, "1");
      localStorage.setItem(LEGACY_PARTNER_KEY, "1");
    } else {
      sessionStorage.removeItem(LEGACY_PARTNER_KEY);
      localStorage.removeItem(LEGACY_PARTNER_KEY);
    }
  } catch {}
}

function detectPartnerApp(): boolean {
  if (isPartnerApp !== null) return isPartnerApp;

  const params = new URLSearchParams(window.location.search);
  const explicitMode = params.get("capApp");

  if (explicitMode === "partner" || explicitMode === "client") {
    persistAppMode(explicitMode);
    return explicitMode === "partner";
  }

  if ((window as any).__CAP_PARTNER_REDIRECTED) {
    persistAppMode("partner");
    return true;
  }

  try {
    const storedMode = sessionStorage.getItem(APP_MODE_KEY) || localStorage.getItem(APP_MODE_KEY);
    if (storedMode === "partner" || storedMode === "client") {
      isPartnerApp = storedMode === "partner";
      return isPartnerApp;
    }

    const legacyPartner = sessionStorage.getItem(LEGACY_PARTNER_KEY) === "1" || localStorage.getItem(LEGACY_PARTNER_KEY) === "1";
    if (legacyPartner) {
      persistAppMode("partner");
      return true;
    }
  } catch {}

  persistAppMode("client");
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
