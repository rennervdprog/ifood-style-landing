import { Route } from "react-router-dom";
import RoleGuard from "@/components/RoleGuard";
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
    <Route
      path="/pedidos"
      element={
        <RoleGuard allowedRoles={["cliente"]} redirectTo="/auth">
          <PedidosPage />
        </RoleGuard>
      }
    />
    <Route
      path="/perfil"
      element={
        <RoleGuard allowedRoles={["cliente"]} redirectTo="/auth">
          <PerfilPage />
        </RoleGuard>
      }
    />
  </>
);
