import { Route } from "react-router-dom";
import { GuardedLayout } from "@/routes/layouts/GuardedLayout";
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
    <Route path="/cliente" element={<ClientHome />} />
    <Route path="/cliente/busca" element={<ClientBuscaPage />} />
    <Route path="/carrinho" element={<CartPage />} />
    <Route path="/checkout" element={<CheckoutPage />} />
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
