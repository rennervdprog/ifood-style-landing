import { lazy, memo, Suspense, useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/integrations/supabase/client";
import { BrowserRouter, Route, Routes, useNavigate, useLocation, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { StoreProvider } from "@/contexts/StoreContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import RoleGuard from "@/components/RoleGuard";
import LojistaHomeRedirect from "@/components/LojistaHomeRedirect";
import InstallPrompt from "@/components/InstallPrompt";
import NotificationPrompt from "@/components/NotificationPrompt";
import DownloadAppPrompt from "@/components/DownloadAppPrompt";
import CapacitorPermissionsOnboarding from "@/components/CapacitorPermissionsOnboarding";
import DebugOverlay from "@/components/DebugOverlay";
import { initCapacitorNative, isCapacitorNative, consumePendingPushNavigation } from "@/lib/capacitorNative";
import { initCapacitorLifecycle } from "@/lib/capacitorLifecycle";
import { initRealtimeWatchdog } from "@/lib/realtimeWatchdog";
import { initVersionWatcher } from "@/lib/versionWatcher";
import { checkAppVersion } from "@/lib/appVersionCheck";
import { getCapacitorAppMode } from "@/lib/capacitorAppMode";
import { isPartnerNativeSync } from "@/lib/capacitorAppMode";
import CapacitorRouteGuard from "@/components/CapacitorRouteGuard";
import StoreAppGuard from "@/components/StoreAppGuard";
import ErrorBoundary from "@/components/ErrorBoundary";
import { TermsUpdateModal } from "@/components/TermsUpdateModal";
import ClientPinChecker from "@/components/ClientPinChecker";
import RecoveryRedirect from "@/components/RecoveryRedirect";
import GlobalRealtimeSync from "@/components/GlobalRealtimeSync";
import { fetchPendingLegalChanges, type PendingLegalChanges } from "@/lib/legalDocuments";
import { APP_VERSION } from "@/lib/appVersion";
import { registerRoutePrefetch } from "@/lib/prefetchRoute";
import { useDelayedFallback } from "@/lib/useDelayedFallback";
import { useNativeNavStackTracker } from "@/lib/nativeNavStack";

// Lazy-loaded pages — each becomes its own chunk
const Index = lazy(() => import("./pages/Index"));
const StoreDirectory = lazy(() => import("./pages/StoreDirectory"));
const CityStoresPage = lazy(() => import("./pages/CityStoresPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const ClientHome = lazy(() => import("./pages/ClientHome"));
const ClientBuscaPage = lazy(() => import("./pages/cliente/busca/ClientBuscaPage"));
const StorePage = lazy(() => import("./pages/StorePage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const GuestCheckoutPage = lazy(() => import("./pages/GuestCheckoutPage"));
const PixDiretoPaymentPage = lazy(() => import("./pages/PixDiretoPaymentPage"));
const PublicOrderTracking = lazy(() => import("./pages/PublicOrderTracking"));
const PedidosPage = lazy(() => import("./pages/PedidosPage"));
const PerfilPage = lazy(() => import("./pages/PerfilPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const PartnerLogin = lazy(() => import("./pages/PartnerLogin"));
const AdminDashboardV2 = lazy(() => import("./pages/AdminDashboardV2"));
const MatrizDashboard = lazy(() => import("./pages/MatrizDashboard"));
const PdvPage = lazy(() => import("./pages/PdvPage"));
const PdvKdsPage = lazy(() => import("./pages/PdvKdsPage"));
const PdvCardapioPage = lazy(() => import("./pages/PdvCardapioPage"));
const DriverDashboardV2 = lazy(() => import("./pages/DriverDashboardV2"));
const SuperAdminDashboardV2 = lazy(() => import("./pages/SuperAdminDashboardV2").catch(() => {
  window.location.reload();
  return { default: () => null };
}));
const PartnerOnboarding = lazy(() => import("./pages/PartnerOnboarding"));
const CadastroLojista = lazy(() => import("./pages/CadastroLojista"));
const CadastroMotoboyLoja = lazy(() => import("./pages/CadastroMotoboyLoja"));
const TermosDeUso = lazy(() => import("./pages/TermosDeUso"));
const PoliticaPrivacidade = lazy(() => import("./pages/PoliticaPrivacidade"));
const PlanosPage = lazy(() => import("./pages/PlanosPage"));
const ModeradorDashboard = lazy(() => import("./pages/ModeradorDashboard"));
const ResellerDashboard = lazy(() => import("./pages/ResellerDashboard"));
const SejaRevendedor = lazy(() => import("./pages/SejaRevendedor"));
const ResellerAuth = lazy(() => import("./pages/ResellerAuth"));
const SupportAgentDashboard = lazy(() => import("./pages/SupportAgentDashboard"));
const LinksPage = lazy(() => import("./pages/LinksPage"));
 const DownloadApp = lazy(() => import("./pages/DownloadApp"));
const NotFound = lazy(() => import("./pages/NotFound"));
const KdsPage = lazy(() => import("./pages/KdsPage"));
const SandboxTestsPage = lazy(() => import("./pages/SandboxTestsPage"));
const BlogIndex = lazy(() => import("./pages/blog/BlogIndex"));
const BlogPost = lazy(() => import("./pages/blog/BlogPost"));
const BlogAdmin = lazy(() => import("./pages/admin/BlogAdmin"));
const BlogAdminEditor = lazy(() => import("./pages/admin/BlogAdminEditor"));
const VagaPromoPage = lazy(() => import("./pages/VagaPromoPage"));

// Register the highest-value chunks for hover/focus prefetch.
// Kept close to the lazy() definitions so paths and loaders stay in sync.
registerRoutePrefetch("/super-admin", () => import("./pages/SuperAdminDashboardV2"));
registerRoutePrefetch("/admin", () => import("./pages/AdminDashboardV2"));
registerRoutePrefetch("/admin/pdv", () => import("./pages/PdvPage"));
registerRoutePrefetch("/matriz", () => import("./pages/MatrizDashboard"));
registerRoutePrefetch("/entregador", () => import("./pages/DriverDashboardV2"));
registerRoutePrefetch("/revendedor", () => import("./pages/ResellerDashboard"));
registerRoutePrefetch("/revendedor/auth", () => import("./pages/ResellerAuth"));
registerRoutePrefetch("/portal-parceiro", () => import("./pages/PartnerLogin"));
registerRoutePrefetch("/planos", () => import("./pages/PlanosPage"));
registerRoutePrefetch("/cliente", () => import("./pages/ClientHome"));
registerRoutePrefetch("/cliente/busca", () => import("./pages/cliente/busca/ClientBuscaPage"));
registerRoutePrefetch("/cadastro-lojista", () => import("./pages/CadastroLojista"));

/**
 * Fallback do Suspense de rotas. Só aparece se o chunk demorar mais que 180ms
 * — chunks já em cache trocam de rota sem piscar spinner.
 */
const PageLoader = () => {
  const show = useDelayedFallback(180);
  if (!show) return null;
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );
};

/**
 * Árvore de rotas isolada e memoizada. Como não recebe props, o React nunca
 * a re-renderiza depois do primeiro mount — mudanças de estado no <App/>
 * (ex.: showAncillary flip, TermsChecker) deixam de invalidar todo o
 * `<Routes>` e cada página só re-renderiza quando o próprio path muda.
 */
const AppRoutes = memo(function AppRoutes() {
  return (
    <Routes>
      {/* Public landing / Client home */}
      <Route path="/" element={<StoreDirectory />} />
      <Route path="/lojas" element={<Navigate to="/" replace />} />
      <Route path="/lojas/:cidade" element={<CityStoresPage />} />
      <Route path="/cliente" element={<ClientHome />} />
      <Route path="/cliente/busca" element={<ClientBuscaPage />} />
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
      <Route path="/checkout-rapido" element={<GuestCheckoutPage />} />
      <Route path="/pix-direto/:orderId" element={<PixDiretoPaymentPage />} />
      <Route path="/p/:orderId" element={<PublicOrderTracking />} />
      <Route path="/pedidos" element={<PedidosPage />} />
      <Route path="/perfil" element={<PerfilPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/portal-parceiro" element={<PartnerLogin />} />
      <Route path="/admin" element={<RoleGuard allowedRoles={["lojista", "lojista_matriz", "lojista_unidade", "admin"]} redirectTo="/" requireApproval><LojistaHomeRedirect><AdminDashboardV2 /></LojistaHomeRedirect></RoleGuard>} />
      <Route path="/matriz" element={<RoleGuard allowedRoles={["lojista_matriz", "admin"]} redirectTo="/"><MatrizDashboard /></RoleGuard>} />
      <Route path="/admin2" element={<Navigate to="/admin" replace />} />
      <Route path="/admin/pdv" element={<RoleGuard allowedRoles={["lojista", "admin"]} redirectTo="/" requireApproval><PdvPage /></RoleGuard>} />
      <Route path="/admin/pdv/kds" element={<RoleGuard allowedRoles={["lojista", "admin"]} redirectTo="/" requireApproval><PdvKdsPage /></RoleGuard>} />
      <Route path="/admin/cardapio" element={<RoleGuard allowedRoles={["lojista", "admin"]} redirectTo="/" requireApproval><PdvCardapioPage /></RoleGuard>} />
      <Route path="/admin/pdv/cardapio" element={<Navigate to="/admin/cardapio" replace />} />
      <Route
        path="/entregador"
        element={
          <RoleGuard allowedRoles={["motoboy", "admin"]} redirectTo="/" requireApproval>
            <DriverDashboardV2 />
          </RoleGuard>
        }
      />
      <Route path="/entregador1" element={<Navigate to="/entregador" replace />} />
      <Route path="/entregador2" element={<Navigate to="/entregador" replace />} />
      <Route
        path="/super-admin"
        element={
          <RoleGuard allowedRoles={["admin"]} redirectTo="/">
            <SuperAdminDashboardV2 />
          </RoleGuard>
        }
      />
      <Route path="/super-admin1" element={<Navigate to="/super-admin" replace />} />
      <Route path="/super-admin2" element={<Navigate to="/super-admin" replace />} />
      <Route path="/super-admin/sandbox-tests" element={<RoleGuard allowedRoles={["admin"]} redirectTo="/"><SandboxTestsPage /></RoleGuard>} />
      <Route path="/parceiro" element={<PartnerOnboarding />} />
      <Route path="/revendedor" element={<ResellerDashboard />} />
      <Route path="/seja-revendedor" element={<SejaRevendedor />} />
      <Route path="/revendedor/entrar" element={<ResellerAuth />} />
      <Route path="/revendedor/cadastro" element={<ResellerAuth />} />
      <Route path="/cadastro-entregador" element={<Navigate to="/cadastro-motoboy-loja" replace />} />
      <Route path="/cadastro-lojista" element={<CadastroLojista />} />
      <Route path="/cadastro-motoboy-loja" element={<CadastroMotoboyLoja />} />
      <Route path="/termos-de-uso" element={<TermosDeUso />} />
      <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
      <Route path="/termos" element={<Navigate to="/termos-de-uso" replace />} />
      <Route path="/privacidade" element={<Navigate to="/politica-de-privacidade" replace />} />
      <Route path="/parceiro/login" element={<Navigate to="/portal-parceiro" replace />} />
      <Route path="/planos" element={<PlanosPage />} />
      <Route path="/moderador" element={<ModeradorDashboard />} />
      <Route path="/suporte" element={<RoleGuard allowedRoles={["suporte","admin"]} redirectTo="/auth"><SupportAgentDashboard /></RoleGuard>} />
      <Route path="/links" element={<LinksPage />} />
      <Route path="/download" element={<DownloadApp />} />
      <Route path="/kds/:token" element={<KdsPage />} />
      <Route path="/blog" element={<BlogIndex />} />
      <Route path="/blog/:slug" element={<BlogPost />} />
      <Route path="/admin/blog" element={<RoleGuard allowedRoles={["admin"]} redirectTo="/"><BlogAdmin /></RoleGuard>} />
      <Route path="/admin/blog/novo" element={<RoleGuard allowedRoles={["admin"]} redirectTo="/"><BlogAdminEditor /></RoleGuard>} />
      <Route path="/admin/blog/:id" element={<RoleGuard allowedRoles={["admin"]} redirectTo="/"><BlogAdminEditor /></RoleGuard>} />
      <Route path="/vaga/:cidade" element={<VagaPromoPage />} />
      {/* Slugs reservados: evitam cair no catch-all "/:slug" (StorePage) */}
      {[
        "baixar-app","landing","home","sobre","contato","termos","privacidade",
        "app","site","index"
      ].map((s) => (
        <Route key={s} path={`/${s}`} element={<NotFound />} />
      ))}
      <Route path="/:slug" element={<StorePage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
});

// On Capacitor, capacitorLifecycle.ts already calls focusManager.setFocused(true)
// on every app resume — which triggers refetchOnWindowFocus internally.
// queryClient extraído para `src/lib/queryClient.ts` para que módulos não-React
// (route resolvers) possam ler o mesmo cache sem duplicar queries.
const isNativeApp = typeof window !== "undefined" &&
  (window as any).Capacitor?.isNativePlatform?.() === true;

/** Listens for push notification taps and navigates via React Router */
const PushNavigator = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Mirror router transitions into our app-owned nav stack (Android back).
  useNativeNavStackTracker();

  // On mount: check if there's a pending push navigation from cold start
  // Try multiple times because Capacitor's push event may fire after mount
  useEffect(() => {
    const tryConsume = () => {
      const pending = consumePendingPushNavigation();
      if (pending) {
        console.log("[PushNav] 🚀 Replaying pending push navigation:", pending);
        navigate(pending, { replace: true });
        try { queryClient.invalidateQueries(); } catch {}
        try { window.dispatchEvent(new CustomEvent("capacitor-app-resume")); } catch {}
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

      // 🔄 Push tap can happen on cold start (no appStateChange fires) or while
      // the app was suspended without a clean resume event. Force-invalidate
      // every query and re-broadcast resume so dashboards (driver/lojista)
      // refetch immediately — fixes "push chega mas pedido não aparece".
      try { queryClient.invalidateQueries(); } catch {}
      try { window.dispatchEvent(new CustomEvent("capacitor-app-resume")); } catch {}

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
  const [pending, setPending] = useState<PendingLegalChanges | null>(null);
  const [termsChecked, setTermsChecked] = useState(false);

  useEffect(() => {
    if (!user || termsChecked) return;
    const check = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("terms_version_accepted, privacy_version_accepted")
        .eq("user_id", user.id)
        .maybeSingle();
      const termsAcc = (data as any)?.terms_version_accepted || null;
      const privAcc = (data as any)?.privacy_version_accepted || termsAcc || null;
      const result = await fetchPendingLegalChanges(termsAcc, privAcc);
      if (result && (result.needs_terms || result.needs_privacy)) {
        setPending(result);
      }
      setTermsChecked(true);
    };
    check();
  }, [user, termsChecked]);

  if (!pending || !user) return null;
  return (
    <TermsUpdateModal
      pending={pending}
      onAccepted={() => { setPending(null); }}
    />
  );
};

const App = () => {
  // Gate síncrono para não montar UI ancillary no caminho crítico do boot.
  // No APK Parceiro nunca mostramos banners de instalação/download/notificação
  // de web. Os demais só sobem depois do primeiro paint (idle callback).
  const partnerNative = isPartnerNativeSync();
  const [showAncillary, setShowAncillary] = useState(false);

  useEffect(() => {
    const w = window as any;
    const raise = () => setShowAncillary(true);
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(raise, { timeout: 1200 });
      return () => { try { w.cancelIdleCallback?.(id); } catch {} };
    }
    const t = setTimeout(raise, 800);
    return () => clearTimeout(t);
  }, []);

  // Anti-cache: força atualização completa quando a versão do app muda.
  // Limpa localStorage, caches do Service Worker e recarrega a página.
  useEffect(() => {
    // Em Capacitor o plugin @capgo/capacitor-updater cuida de baixar bundle
    // novo em background e aplicar no próximo cold start.
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
    // ⚡ Ordem crítica para cold start fluido em Capacitor:
    // 1) initCapacitorNative → registra push listeners (precisa cedo p/ cold-start taps).
    // 2) hideSplash → chamado logo após o primeiro paint (RAF x2) para
    //    remover a tela laranja assim que o React estiver montado com conteúdo.
    // 3) Todo o resto (watchdog, version check, nativeBoot, lifecycle)
    //    vai para requestIdleCallback — não compete com o primeiro render.
    initCapacitorNative().catch(() => {});

    // (hideSplash já foi chamado em main.tsx logo após o primeiro paint —
    // não repetir aqui pra não competir com o useEffect dos Providers.)

    const w = window as any;
    const runIdle = (fn: () => void, timeout = 2500) => {
      if (typeof w.requestIdleCallback === "function") {
        w.requestIdleCallback(fn, { timeout });
      } else {
        setTimeout(fn, 500);
      }
    };

    runIdle(() => {
      initCapacitorLifecycle().catch(() => {});
      import("@/lib/nativeBoot").then(({ nativeBoot }) => nativeBoot()).catch(() => {});
      initRealtimeWatchdog();
      initVersionWatcher();
    });

    // Aviso não-bloqueante de nova versão nativa — mais tarde ainda.
    setTimeout(() => {
      const mode = (import.meta.env.VITE_CAPACITOR_APP_MODE || "cliente") as "cliente" | "parceiro";
      checkAppVersion(mode).catch(() => {});
    }, 6000);

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
        const mode = getCapacitorAppMode();
        if (mode === "partner") {
          // App parceiro: só prefetch das telas do lojista/entregador.
          // Não baixar bundles de cliente (StorePage, CartPage, CheckoutPage)
          // — economiza ~300KB no 4G/5G.
          import("./pages/AdminDashboardV2").catch(() => {});
          import("./pages/PdvPage").catch(() => {});
          import("./pages/DriverDashboardV2").catch(() => {});
        } else {
          // App cliente (ou modo não detectado): prefetch das telas do cliente.
          import("./pages/PedidosPage").catch(() => {});
          import("./pages/StorePage").catch(() => {});
          import("./pages/CartPage").catch(() => {});
          import("./pages/PerfilPage").catch(() => {});
        }
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
          {showAncillary && <GlobalRealtimeSync />}
          {showAncillary && <CapacitorPermissionsOnboarding />}
          {showAncillary && !partnerNative && <InstallPrompt />}
          {showAncillary && !partnerNative && <NotificationPrompt />}
          {showAncillary && <DebugOverlay />}
          <BrowserRouter>
            <PushNavigator />
            {showAncillary && <RecoveryRedirect />}
            <CapacitorRouteGuard />
            {showAncillary && !partnerNative && <StoreAppGuard />}
            {showAncillary && <TermsChecker />}
            {showAncillary && !partnerNative && <ClientPinChecker />}
            {showAncillary && !partnerNative && <DownloadAppPrompt />}
            <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <AppRoutes />
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
