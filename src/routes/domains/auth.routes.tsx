import { Route, Navigate } from "react-router-dom";
import {
  AuthPage,
  PartnerLogin,
  PartnerOnboarding,
  CadastroLojista,
  CadastroMotoboyLoja,
} from "@/routes/lazyPages";

export const authRoutes = (
  <>
    <Route path="/auth" element={<AuthPage />} />
    <Route path="/portal-parceiro" element={<PartnerLogin />} />
    <Route path="/parceiro" element={<PartnerOnboarding />} />
    <Route path="/parceiro/login" element={<Navigate to="/portal-parceiro" replace />} />
    <Route path="/cadastro-entregador" element={<Navigate to="/cadastro-motoboy-loja" replace />} />
    <Route path="/cadastro-lojista" element={<CadastroLojista />} />
    <Route path="/cadastro-motoboy-loja" element={<CadastroMotoboyLoja />} />
  </>
);
