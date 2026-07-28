/**
 * Lazy-loaded page components + prefetch registrations, centralizados.
 *
 * Antes: tudo vivia em `src/App.tsx` misturado com Providers e efeitos de
 * bootstrap. Agora cada domínio de rota (`src/routes/domains/*.routes.tsx`)
 * importa daqui — App.tsx só cuida do shell + providers.
 */
import { lazy } from "react";
import { registerRoutePrefetch } from "@/lib/prefetchRoute";

export const Index = lazy(() => import("@/pages/Index"));
export const StoreDirectory = lazy(() => import("@/pages/StoreDirectory"));
export const CityStoresPage = lazy(() => import("@/pages/CityStoresPage"));
export const ClientHome = lazy(() => import("@/pages/ClientHome"));
export const ClientBuscaPage = lazy(() => import("@/pages/cliente/busca/ClientBuscaPage"));
export const StorePage = lazy(() => import("@/pages/StorePage"));
export const CartPage = lazy(() => import("@/pages/CartPage"));
export const CheckoutPage = lazy(() => import("@/pages/CheckoutPage"));
export const GuestCheckoutPage = lazy(() => import("@/pages/GuestCheckoutPage"));
export const PixDiretoPaymentPage = lazy(() => import("@/pages/PixDiretoPaymentPage"));
export const PublicOrderTracking = lazy(() => import("@/pages/PublicOrderTracking"));
export const PedidosPage = lazy(() => import("@/pages/PedidosPage"));
export const PerfilPage = lazy(() => import("@/pages/PerfilPage"));
export const AuthPage = lazy(() => import("@/pages/AuthPage"));
export const PartnerLogin = lazy(() => import("@/pages/PartnerLogin"));
export const AdminDashboardV2 = lazy(() => import("@/pages/AdminDashboardV2"));
export const MatrizDashboard = lazy(() => import("@/pages/MatrizDashboard"));
export const PdvPage = lazy(() => import("@/pages/PdvPage"));
export const PdvKdsPage = lazy(() => import("@/pages/PdvKdsPage"));
export const PdvCardapioPage = lazy(() => import("@/pages/PdvCardapioPage"));
export const DriverDashboardV2 = lazy(() => import("@/pages/DriverDashboardV2"));
export const SuperAdminDashboardV2 = lazy(() =>
  import("@/pages/SuperAdminDashboardV2").catch(() => {
    window.location.reload();
    return { default: () => null };
  }),
);
export const PartnerOnboarding = lazy(() => import("@/pages/PartnerOnboarding"));
export const CadastroLojista = lazy(() => import("@/pages/CadastroLojista"));
export const CadastroMotoboyLoja = lazy(() => import("@/pages/CadastroMotoboyLoja"));
export const TermosDeUso = lazy(() => import("@/pages/TermosDeUso"));
export const PoliticaPrivacidade = lazy(() => import("@/pages/PoliticaPrivacidade"));
export const PlanosPage = lazy(() => import("@/pages/PlanosPage"));
export const ModeradorDashboard = lazy(() => import("@/pages/ModeradorDashboard"));
export const ResellerDashboard = lazy(() => import("@/pages/ResellerDashboard"));
export const SejaRevendedor = lazy(() => import("@/pages/SejaRevendedor"));
export const ResellerAuth = lazy(() => import("@/pages/ResellerAuth"));
export const SupportAgentDashboard = lazy(() => import("@/pages/SupportAgentDashboard"));
export const LinksPage = lazy(() => import("@/pages/LinksPage"));
export const DownloadApp = lazy(() => import("@/pages/DownloadApp"));
export const NotFound = lazy(() => import("@/pages/NotFound"));
export const KdsPage = lazy(() => import("@/pages/KdsPage"));
export const SandboxTestsPage = lazy(() => import("@/pages/SandboxTestsPage"));
export const BlogIndex = lazy(() => import("@/pages/blog/BlogIndex"));
export const BlogPost = lazy(() => import("@/pages/blog/BlogPost"));
export const BlogAdmin = lazy(() => import("@/pages/admin/BlogAdmin"));
export const BlogAdminEditor = lazy(() => import("@/pages/admin/BlogAdminEditor"));
export const VagaPromoPage = lazy(() => import("@/pages/VagaPromoPage"));

registerRoutePrefetch("/super-admin", () => import("@/pages/SuperAdminDashboardV2"));
registerRoutePrefetch("/admin", () => import("@/pages/AdminDashboardV2"));
registerRoutePrefetch("/admin/pdv", () => import("@/pages/PdvPage"));
registerRoutePrefetch("/matriz", () => import("@/pages/MatrizDashboard"));
registerRoutePrefetch("/entregador", () => import("@/pages/DriverDashboardV2"));
registerRoutePrefetch("/revendedor", () => import("@/pages/ResellerDashboard"));
registerRoutePrefetch("/revendedor/auth", () => import("@/pages/ResellerAuth"));
registerRoutePrefetch("/portal-parceiro", () => import("@/pages/PartnerLogin"));
registerRoutePrefetch("/planos", () => import("@/pages/PlanosPage"));
registerRoutePrefetch("/cliente", () => import("@/pages/ClientHome"));
registerRoutePrefetch("/cliente/busca", () => import("@/pages/cliente/busca/ClientBuscaPage"));
registerRoutePrefetch("/cadastro-lojista", () => import("@/pages/CadastroLojista"));
