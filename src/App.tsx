import { lazy, Suspense, useEffect, useCallback, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BrowserRouter, Route, Routes, useNavigate, useLocation, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { StoreProvider } from "@/contexts/StoreContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import RoleGuard from "@/components/RoleGuard";
import InstallPrompt from "@/components/InstallPrompt";
import NotificationPrompt from "@/components/NotificationPrompt";
import DownloadAppPrompt from "@/components/DownloadAppPrompt";
import CapacitorPermissionsOnboarding from "@/components/CapacitorPermissionsOnboarding";
import DebugOverlay from "@/components/DebugOverlay";
import { initCapacitorNative, isCapacitorNative, consumePendingPushNavigation } from "@/lib/capacitorNative";
import { initCapacitorLifecycle } from "@/lib/capacitorLifecycle";
import { initRealtimeWatchdog } from "@/lib/realtimeWatchdog";
import { initAutoUpdate } from "@/lib/capacitorAutoUpdate";
import { checkAppVersion } from "@/lib/appVersionCheck";
import CapacitorRouteGuard from "@/components/CapacitorRouteGuard";
import StoreAppGuard from "@/components/StoreAppGuard";
import ErrorBoundary from "@/components/ErrorBoundary";
import { TermsUpdateModal, CURRENT_TERMS_VERSION } from "@/components/TermsUpdateModal";

// Lazy-loaded pages — each becomes its own chunk
const Index = lazy(() => import("./pages/Index"));
const StoreDirectory = lazy(() => import("./pages/StoreDirectory"));
const ClientHome = lazy(() => import("./pages/ClientHome"));
const StorePage = lazy(() => import("./pages/StorePage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const PedidosPage = lazy(() => import("./pages/PedidosPage"));
const PerfilPage = lazy(() => import("./pages/PerfilPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const PartnerLogin = lazy(() => import("./pages/PartnerLogin"));
const AdminDashboardV2 = lazy(() => import("./pages/AdminDashboardV2"));
const MatrizDashboard = lazy(() => import("./pages/MatrizDashboard"));
const PdvPage = lazy(() => import("./pages/PdvPage"));
const DriverDashboard = lazy(() => import("./pages/DriverDashboard"));
const DriverDashboardV2 = lazy(() => import("./pages/DriverDashboardV2"));
 const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard").catch(() => {
   window.location.reload();
   return { default: () => null };
 }));
const SuperAdminDashboardV2 = lazy(() => import("./pages/SuperAdminDashboardV2").catch(() => {
  window.location.reload();
  return { default: () => null };
}));
const PartnerOnboarding = lazy(() => import("./pages/PartnerOnboarding"));
const CadastroEntregador = lazy(() => import("./pages/CadastroEntregador"));
const CadastroLojista = lazy(() => import("./pages/CadastroLojista"));
const CadastroMotoboyLoja = lazy(() => import("./pages/CadastroMotoboyLoja"));
const TermosDeUso = lazy(() => import("./pages/TermosDeUso"));
const PoliticaPrivacidade = lazy(() => import("./pages/PoliticaPrivacidade"));
const PlanosPage = lazy(() => import("./pages/PlanosPage"));
const ModeradorDashboard = lazy(() => import("./pages/ModeradorDashboard"));
const SupportAgentDashboard = lazy(() => import("./pages/SupportAgentDashboard"));
const LinksPage = lazy(() => import("./pages/LinksPage"));
 const DownloadApp = lazy(() => import("./pages/DownloadApp"));
const NotFound = lazy(() => import("./pages/NotFound"));

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
  </div>
);

const APP_VERSION = "1.6.21";

// On Capacitor, capacitorLifecycle.ts already calls focusManager.setFocused(true)
// on every app resume — which triggers refetchOnWindowFocus internally.
// Keeping refetchOnWindowFocus:true causes a double-refetch on every resume.
// Disable it here and rely solely on explicit invalidations + focusManager.
const isNativeApp = typeof window !== "undefined" &&
  (window as any).Capacitor?.isNativePlatform?.() === true;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,           // 60s global — dados considerados frescos por 1min
      gcTime: 1000 * 60 * 15,         // 15min cache — reduz cold re-fetches
      refetchOnWindowFocus: !isNativeApp, // Capacitor lifecycle handles this
      refetchOnReconnect: true,
      refetchOnMount: true,
      retry: 1,
      // Queries de dados em tempo real (pedidos) sobrescrevem com staleTime menor
    },
  },
});

/** Listens for push notification taps and navigates via React Router */
const PushNavigator = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // On mount: check if there's a pending push navigation from cold start
  // Try multiple times because Capacitor's push event may fire after mount
  useEffect(() => {
    const tryConsume = () => {
      const pending = consumePendingPushNavigation();
      if (pending) {
        console.log("[PushNav] 🚀 Replaying pending push navigation:", pending);
        navigate(pending, { replace: true });
        return true;
      }
      return false;
    };
    // Try immediately, then again after short delays to catch late events
    if (!tryConsume()) {
      const t1 = setTimeout(tryConsume, 200);
      const t2 = setTimeout(tryConsume, 800);
      const t3 = setTimeout(tryConsume, 2000);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const path = (e as CustomEvent).detail?.path;
      if (!path) return;
      console.log("[PushNav] 🎯 Navigating to:", path);

      // Clear pending since we're handling it now
      consumePendingPushNavigation();

      // Parse path and query
      const [pathname, search] = path.split("?");
      const currentFull = location.pathname + (location.search || "");
      const targetFull = pathname + (search ? `?${search}` : "");
      if (currentFull === targetFull) {
        // Already on the page — force refresh by navigating away and back
        navigate("/", { replace: true });
        setTimeout(() => navigate(path, { replace: true }), 50);
      } else {
        navigate(path, { replace: true });
      }
    };

    window.addEventListener("capacitor-push-navigate", handler);
    return () => window.removeEventListener("capacitor-push-navigate", handler);
  }, [navigate, location]);

  return null;
};

/** Verifica e exibe modal de novos termos — precisa estar dentro do AuthProvider */
const TermsChecker = () => {
  const { user } = useAuth();
  const [needsTermsUpdate, setNeedsTermsUpdate] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);

  useEffect(() => {
    if (!user || termsChecked) return;
    const check = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("terms_version_accepted")
        .eq("user_id", user.id)
        .maybeSingle();
      const v = (data as any)?.terms_version_accepted || "1.0";
      if (v < CURRENT_TERMS_VERSION) setNeedsTermsUpdate(true);
      setTermsChecked(true);
    };
    check();
  }, [user, termsChecked]);

  if (!needsTermsUpdate || !user) return null;
  return (
    <TermsUpdateModal
      onAccepted={() => { setNeedsTermsUpdate(false); setTermsChecked(false); }}
    />
  );
};

const App = () => {
  // Anti-cache: força atualização completa quando a versão do app muda.
  // Limpa localStorage, caches do Service Worker e recarrega a página.
  useEffect(() => {
    // Em Capacitor o capacitorAutoUpdate.ts já cuida de detectar bundle novo
    // (compara hash de /assets/*) e limpar caches. Rodar este efeito também
    // causa reload duplo / conflito com o SW controllerchange.
    if (isNativeApp) return;

    const storedVersion = localStorage.getItem("app_version");

    if (storedVersion !== APP_VERSION) {
      console.log(`[Cache] ${storedVersion ?? "primeira visita"} → ${APP_VERSION}. Limpando cache...`);

      // Salvar nova versão ANTES de qualquer operação para evitar loop
      localStorage.setItem("app_version", APP_VERSION);
      // Marcar que o reload de versão já foi feito (evita conflito com SW controllerchange)
      localStorage.setItem("sw-update-reload-ts", String(Date.now()));
      queryClient.clear();

      // Limpar caches do SW e recarregar só se havia versão anterior
      if (storedVersion) {
        const reload = () => { (globalThis as any).location.reload(); };
        if (typeof caches !== "undefined") {
          caches.keys()
            .then(keys => Promise.all(keys.map(k => caches.delete(k))))
            .catch(() => {})
            .finally(reload);
        } else {
          reload();
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // ⚡ Fire-and-forget: don't chain these, run in parallel so first paint
    // is never blocked by native setup or auto-update checks.
    initCapacitorNative().catch(() => {});
    initCapacitorLifecycle().catch(() => {});
    initRealtimeWatchdog();
    // Auto-update inicia imediatamente — agenda interno usa 1s antes do 1º check
    try { initAutoUpdate(); } catch {}
    // Aviso não-bloqueante de nova versão nativa disponível.
    setTimeout(() => { 
      const mode = (import.meta.env.VITE_CAPACITOR_APP_MODE || "cliente") as "cliente" | "parceiro";
      checkAppVersion(mode).catch(() => {}); 
    }, 4000);

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      queryClient.invalidateQueries();
    };
    const handleOnline = () => {
      queryClient.invalidateQueries();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("online", handleOnline);

    // 🚀 Prefetch das rotas mais usadas em apps Capacitor durante o tempo ocioso.
    // Evita "tela laranja de carregamento" quando o usuário entra em /pedidos
    // pela primeira vez — o chunk já está em cache.
    if (isCapacitorNative()) {
      const prefetch = () => {
        import("./pages/PedidosPage").catch(() => {});
        import("./pages/StorePage").catch(() => {});
        import("./pages/CartPage").catch(() => {});
        import("./pages/PerfilPage").catch(() => {});
      };
      // requestIdleCallback se disponível, senão setTimeout
      const w = window as any;
      if (typeof w.requestIdleCallback === "function") {
        w.requestIdleCallback(prefetch, { timeout: 3000 });
      } else {
        setTimeout(prefetch, 1500);
      }
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="id-delivery-theme">
      <AuthProvider>
        <StoreProvider>
        <CartProvider>
          <Toaster />
          <CapacitorPermissionsOnboarding />
          <InstallPrompt />
          <NotificationPrompt />
          <DebugOverlay />
          <BrowserRouter>
            <PushNavigator />
            <CapacitorRouteGuard />
            <StoreAppGuard />
            <TermsChecker />
            <DownloadAppPrompt />
            <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public landing / Client home */}
                <Route path="/" element={<StoreDirectory />} />
                <Route path="/cliente" element={<ClientHome />} />
                {/* Admin dashboard at /index */}
                <Route
                  path="/painel"
                  element={
                    <RoleGuard allowedRoles={["admin"]} redirectTo="/">
                      <Index />
                    </RoleGuard>
                  }
                />
                <Route path="/loja/:id" element={<StorePage />} />
                <Route path="/carrinho" element={<CartPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/pedidos" element={<PedidosPage />} />
                <Route path="/perfil" element={<PerfilPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/portal-parceiro" element={<PartnerLogin />} />
                <Route path="/admin" element={<RoleGuard allowedRoles={["lojista", "lojista_matriz", "lojista_unidade", "admin"]} redirectTo="/" requireApproval><AdminDashboardV2 /></RoleGuard>} />
                <Route path="/matriz" element={<RoleGuard allowedRoles={["lojista_matriz", "admin"]} redirectTo="/"><MatrizDashboard /></RoleGuard>} />
                <Route path="/admin2" element={<Navigate to="/admin" replace />} />
                <Route path="/admin/pdv" element={<RoleGuard allowedRoles={["lojista", "admin"]} redirectTo="/" requireApproval><PdvPage /></RoleGuard>} />
                <Route
                  path="/entregador"
                  element={
                    <RoleGuard allowedRoles={["motoboy", "admin"]} redirectTo="/" requireApproval>
                      <DriverDashboardV2 />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/entregador1"
                  element={
                    <RoleGuard allowedRoles={["motoboy", "admin"]} redirectTo="/" requireApproval>
                      <DriverDashboard />
                    </RoleGuard>
                  }
                />
                <Route path="/entregador2" element={<Navigate to="/entregador" replace />} />
                <Route
                  path="/super-admin"
                  element={
                    <RoleGuard allowedRoles={["admin"]} redirectTo="/">
                      <SuperAdminDashboardV2 />
                    </RoleGuard>
                  }
                />
<Route
  path="/super-admin1"
  element={
    <RoleGuard allowedRoles={["admin"]} redirectTo="/">
      <SuperAdminDashboard />
    </RoleGuard>
  }
/>
                <Route path="/super-admin2" element={<Navigate to="/super-admin" replace />} />
                <Route path="/parceiro" element={<PartnerOnboarding />} />
                {/* Cadastro de motoboy de plataforma descontinuado — redireciona para motoboy de loja */}
                <Route path="/cadastro-entregador" element={<Navigate to="/cadastro-motoboy-loja" replace />} />
                <Route path="/cadastro-lojista" element={<CadastroLojista />} />
                <Route path="/cadastro-motoboy-loja" element={<CadastroMotoboyLoja />} />
                <Route path="/termos-de-uso" element={<TermosDeUso />} />
                <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
                <Route path="/planos" element={<PlanosPage />} />
                <Route path="/moderador" element={<ModeradorDashboard />} />
                <Route path="/suporte" element={<RoleGuard allowedRoles={["suporte","admin"]} redirectTo="/auth"><SupportAgentDashboard /></RoleGuard>} />
                <Route path="/links" element={<LinksPage />} />
                 <Route path="/download" element={<DownloadApp />} />
                {/* Client store access via slug - must be last */}
                <Route path="/:slug" element={<StorePage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            </ErrorBoundary>
          </BrowserRouter>
        </CartProvider>
        </StoreProvider>
      </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
