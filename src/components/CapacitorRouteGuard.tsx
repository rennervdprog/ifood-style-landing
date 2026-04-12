import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isCapacitorNative } from "@/lib/capacitorNative";

/**
 * On Capacitor Android, restrict navigation to partner-only routes.
 * Any other route redirects to /portal-parceiro.
 */
const ALLOWED_ROUTES = [
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
];

const CapacitorRouteGuard = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isCapacitorNative()) return;

    const path = location.pathname;
    const isAllowed = ALLOWED_ROUTES.some(
      (route) => path === route || path.startsWith(route + "/")
    );

    if (!isAllowed) {
      navigate("/portal-parceiro", { replace: true });
    }
  }, [location.pathname, navigate]);

  return null;
};

export default CapacitorRouteGuard;
