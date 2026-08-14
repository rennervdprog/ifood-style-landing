import { Route } from "react-router-dom";
import { GuardedLayout } from "@/routes/layouts/GuardedLayout";
import { RouteMeta } from "@/routes/meta";
import { ROUTES } from "@/routes/manifest";
import {
  ClientHome,
  ClientBuscaPage,
  CartPage,
  CheckoutPage,
  GuestCheckoutPage,
  PixDiretoPaymentPage,
  PublicOrderTracking,
  PedidosPage,
  PerfilPage,
} from "@/routes/lazyPages";

export const clienteRoutes = (
  <>
    <Route
      path="/cliente"
      element={
        <>
          <RouteMeta path={ROUTES.cliente.home} />
          <ClientHome />
        </>
      }
    />
    <Route
      path="/cliente/busca"
      element={
        <>
          <RouteMeta path={ROUTES.cliente.busca} />
          <ClientBuscaPage />
        </>
      }
    />
    <Route
      path="/carrinho"
      element={
        <>
          <RouteMeta path={ROUTES.cliente.carrinho} />
          <CartPage />
        </>
      }
    />
    <Route
      path="/checkout"
      element={
        <>
          <RouteMeta path={ROUTES.cliente.checkout} />
          <CheckoutPage />
        </>
      }
    />
    <Route path="/checkout-rapido" element={<GuestCheckoutPage />} />
    <Route path="/pix-direto/:orderId" element={<PixDiretoPaymentPage />} />
    <Route path="/p/:orderId" element={<PublicOrderTracking />} />
    {/* Área autenticada do cliente */}
    <Route element={<GuardedLayout allowedRoles={["cliente"]} redirectTo="/auth" />}>
      <Route path="/pedidos" element={<PedidosPage />} />
      <Route path="/perfil" element={<PerfilPage />} />
    </Route>
  </>
);
