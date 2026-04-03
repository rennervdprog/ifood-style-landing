import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import RoleGuard from "@/components/RoleGuard";
import InstallPrompt from "@/components/InstallPrompt";
import Index from "./pages/Index";
import StorePage from "./pages/StorePage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import PedidosPage from "./pages/PedidosPage";
import PerfilPage from "./pages/PerfilPage";
import AuthPage from "./pages/AuthPage";
import AdminDashboard from "./pages/AdminDashboard";
import DriverDashboard from "./pages/DriverDashboard";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import PartnerOnboarding from "./pages/PartnerOnboarding";
import CadastroEntregador from "./pages/CadastroEntregador";
import CadastroLojista from "./pages/CadastroLojista";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="id-delivery-theme">
      <AuthProvider>
        <CartProvider>
          <Toaster />
          <InstallPrompt />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/loja/:id" element={<StorePage />} />
              <Route path="/carrinho" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/pedidos" element={<PedidosPage />} />
              <Route path="/perfil" element={<PerfilPage />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route
                path="/admin"
                element={
                  <RoleGuard allowedRoles={["lojista", "admin"]} redirectTo="/" requireApproval>
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
              <Route path="/:slug" element={<StorePage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
