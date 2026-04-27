import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isCapacitorNative } from "@/lib/capacitorNative";
import { getCapacitorAppMode, isPartnerCapacitorApp, persistCapacitorAppMode } from "@/lib/capacitorAppMode";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

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
  "/auth",
  "/termos-de-uso",
  "/politica-de-privacidade",
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
  "/cadastro-entregador",
  "/cadastro-lojista",
  "/cadastro-motoboy-loja",
  "/planos",
  "/auth",
  "/termos-de-uso",
  "/politica-de-privacidade",
];

const CapacitorRouteGuard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

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
      // APK PARCEIRO: bloqueia TUDO que não seja explicitamente uma rota de parceiro.
      // Inclui: "/", "/cliente", "/loja/:id", "/carrinho", "/checkout", "/pedidos",
      // "/perfil" e qualquer "/:slug" (catch-all que vira página de loja-cliente).
      const isAllowed = PARTNER_ALLOWED_PREFIXES.some(
        (route) => path === route || path.startsWith(route + "/")
      );
      if (!isAllowed) {
        // Se já está logado, tenta levar direto pro painel correto.
        // Se não, volta pro login do parceiro.
        if (!authLoading && user) {
          (async () => {
            try {
              const { data: adminRole } = await supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", user.id)
                .eq("role", "admin")
                .maybeSingle();
              if (adminRole) {
                navigate("/super-admin", { replace: true });
                return;
              }
              const { data: profile } = await supabase
                .from("profiles")
                .select("role")
                .eq("user_id", user.id)
                .maybeSingle();
              const role = (profile as any)?.role as string | undefined;
              if (role === "lojista") navigate("/admin", { replace: true });
              else if (role === "motoboy") navigate("/entregador", { replace: true });
              else navigate("/portal-parceiro", { replace: true });
            } catch {
              navigate("/portal-parceiro", { replace: true });
            }
          })();
        } else {
          navigate("/portal-parceiro", { replace: true });
        }
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
  }, [location.pathname, navigate, user?.id, authLoading]);

  return null;
};

export default CapacitorRouteGuard;
