import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isCapacitorNative } from "@/lib/capacitorNative";

/**
 * On Capacitor Android PARCEIRO app, restrict navigation to partner-only routes.
 * The parceiro app injects a redirect script to /portal-parceiro in index.html,
 * so we detect it by checking if the initial entry was /portal-parceiro.
 * 
 * For the CLIENTE app (and white-label store apps), this guard does nothing.
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
  "/termos-de-uso",
  "/politica-de-privacidade",
  "/planos",
  "/auth",
];

let isPartnerApp: boolean | null = null;

function detectPartnerApp(): boolean {
  if (isPartnerApp !== null) return isPartnerApp;

  // Partner app has __CAP_PARTNER_REDIRECTED flag injected in index.html
  isPartnerApp = !!(window as any).__CAP_PARTNER_REDIRECTED;
  return isPartnerApp;
}

const CapacitorRouteGuard = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isCapacitorNative()) return;
    if (!detectPartnerApp()) return; // Cliente/white-label app — no restrictions

    const path = location.pathname;
    const isAllowed = PARTNER_ROUTES.some(
      (route) => path === route || path.startsWith(route + "/")
    );

    if (!isAllowed) {
      navigate("/portal-parceiro", { replace: true });
    }
  }, [location.pathname, navigate]);

  return null;
};

export default CapacitorRouteGuard;
