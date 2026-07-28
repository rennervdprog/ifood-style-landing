import { Route, Navigate } from "react-router-dom";
import { GuardedLayout } from "@/routes/layouts/GuardedLayout";
import { LojistaHomeLayout } from "@/routes/layouts/LojistaLayout";
import {
  AdminDashboardV2,
  MatrizDashboard,
  PdvPage,
  PdvKdsPage,
  PdvCardapioPage,
} from "@/routes/lazyPages";

export const lojistaRoutes = (
  <>
    {/* /admin — dashboard raiz do lojista (com LojistaHomeRedirect) */}
    <Route
      element={
        <GuardedLayout
          allowedRoles={["lojista", "lojista_matriz", "lojista_unidade", "admin"]}
          redirectTo="/"
          requireApproval
        />
      }
    >
      <Route element={<LojistaHomeLayout />}>
        <Route path="/admin" element={<AdminDashboardV2 />} />
      </Route>
    </Route>
    <Route path="/admin2" element={<Navigate to="/admin" replace />} />

    {/* /matriz — dashboard multi-unidade */}
    <Route element={<GuardedLayout allowedRoles={["lojista_matriz", "admin"]} redirectTo="/" />}>
      <Route path="/matriz" element={<MatrizDashboard />} />
    </Route>

    {/* PDV + Cardápio — mesmo guard */}
    <Route
      element={
        <GuardedLayout allowedRoles={["lojista", "admin"]} redirectTo="/" requireApproval />
      }
    >
      <Route path="/admin/pdv" element={<PdvPage />} />
      <Route path="/admin/pdv/kds" element={<PdvKdsPage />} />
      <Route path="/admin/cardapio" element={<PdvCardapioPage />} />
    </Route>
    <Route path="/admin/pdv/cardapio" element={<Navigate to="/admin/cardapio" replace />} />
  </>
);
