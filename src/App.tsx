import { lazy, Suspense, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { StoreProvider } from "@/contexts/StoreContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import RoleGuard from "@/components/RoleGuard";
import InstallPrompt from "@/components/InstallPrompt";
import NotificationPrompt from "@/components/NotificationPrompt";
import { initCapacitorNative, isCapacitorNative } from "@/lib/capacitorNative";

// Lazy-loaded pages — each becomes its own chunk
const Index = lazy(() => import("./pages/Index"));
const StoreDirectory = lazy(() => import("./pages/StoreDirectory"));
const StorePage = lazy(() => import("./pages/StorePage"));
const CartPage = lazy(() => import("./pages/CartPage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const PedidosPage = lazy(() => import("./pages/PedidosPage"));
const PerfilPage = lazy(() => import("./pages/PerfilPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const PartnerLogin = lazy(() => import("./pages/PartnerLogin"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const DriverDashboard = lazy(() => import("./pages/DriverDashboard"));
const SuperAdminDashboard = lazy(() => import("./pages/SuperAdminDashboard"));
const PartnerOnboarding = lazy(() => import("./pages/PartnerOnboarding"));
const CadastroEntregador = lazy(() => import("./pages/CadastroEntregador"));
const CadastroLojista = lazy(() => import("./pages/CadastroLojista"));
const CadastroMotoboyLoja = lazy(() => import("./pages/CadastroMotoboyLoja"));
const TermosDeUso = lazy(() => import("./pages/TermosDeUso"));
const PoliticaPrivacidade = lazy(() => import("./pages/PoliticaPrivacidade"));
const PlanosPage = lazy(() => import("./pages/PlanosPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 min — avoid refetch on re-mount
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => {
  useEffect(() => {
    initCapacitorNative();
  }, []);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="id-delivery-theme">
      <AuthProvider>
        <StoreProvider>
        <CartProvider>
          <Toaster />
          <InstallPrompt />
          <NotificationPrompt />
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {/* Public store directory */}
                <Route path="/" element={<StoreDirectory />} />
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
                <Route
                  path="/admin"
                  element={
                    <RoleGuard allowedRoles={["lojista", "admin"]} redirectTo="/">
                      <AdminDashboard />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/entregador"
                  element={
                    <RoleGuard allowedRoles={["motoboy", "admin"]} redirectTo="/" requireApproval>
                      <DriverDashboard />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/super-admin"
                  element={
                    <RoleGuard allowedRoles={["admin"]} redirectTo="/">
                      <SuperAdminDashboard />
                    </RoleGuard>
                  }
                />
                <Route path="/parceiro" element={<PartnerOnboarding />} />
                <Route path="/cadastro-entregador" element={<CadastroEntregador />} />
                <Route path="/cadastro-lojista" element={<CadastroLojista />} />
                <Route path="/cadastro-motoboy-loja" element={<CadastroMotoboyLoja />} />
                <Route path="/termos-de-uso" element={<TermosDeUso />} />
                <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
                <Route path="/planos" element={<PlanosPage />} />
                {/* Client store access via slug - must be last */}
                <Route path="/:slug" element={<StorePage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </CartProvider>
        </StoreProvider>
      </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
