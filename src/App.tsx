import { memo, Suspense, useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/integrations/supabase/client";
import { BrowserRouter, Routes, useNavigate, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { StoreProvider } from "@/contexts/StoreContext";
import { ThemeProvider } from "@/components/ThemeProvider";
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
import { useDelayedFallback } from "@/lib/useDelayedFallback";
import { useNativeNavStackTracker } from "@/lib/nativeNavStack";

// Rotas divididas por domínio (MVC feature-based). Cada arquivo importa suas
// próprias páginas de `src/routes/lazyPages` — App.tsx só compõe o shell.
import { publicRoutes } from "@/routes/domains/public.routes";
import { clienteRoutes } from "@/routes/domains/cliente.routes";
import { authRoutes } from "@/routes/domains/auth.routes";
import { lojistaRoutes } from "@/routes/domains/lojista.routes";
import { driverRoutes } from "@/routes/domains/driver.routes";
import { adminRoutes } from "@/routes/domains/admin.routes";
import { revendedorRoutes } from "@/routes/domains/revendedor.routes";
import { storeRoutes } from "@/routes/domains/store.routes";

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
      {publicRoutes}
      {authRoutes}
      {clienteRoutes}
      {lojistaRoutes}
      {driverRoutes}
      {adminRoutes}
      {revendedorRoutes}
      {/* store.routes contém o catch-all `/:slug` e o `*` 404 — deixe por último */}
      {storeRoutes}
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
