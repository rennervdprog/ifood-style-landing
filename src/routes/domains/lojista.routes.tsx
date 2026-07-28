import { Route, Navigate } from "react-router-dom";
import RoleGuard from "@/components/RoleGuard";
import LojistaHomeRedirect from "@/components/LojistaHomeRedirect";
import {
  AdminDashboardV2,
  MatrizDashboard,
  PdvPage,
  PdvKdsPage,
  PdvCardapioPage,
} from "@/routes/lazyPages";

export const lojistaRoutes = (
  <>
    <Route
      path="/admin"
      element={
        <RoleGuard
          allowedRoles={["lojista", "lojista_matriz", "lojista_unidade", "admin"]}
          redirectTo="/"
          requireApproval
        >
          <LojistaHomeRedirect>
            <AdminDashboardV2 />
          </LojistaHomeRedirect>
        </RoleGuard>
      }
    />
    <Route path="/admin2" element={<Navigate to="/admin" replace />} />
    <Route
      path="/matriz"
      element={
        <RoleGuard allowedRoles={["lojista_matriz", "admin"]} redirectTo="/">
          <MatrizDashboard />
        </RoleGuard>
      }
    />
    <Route
      path="/admin/pdv"
      element={
        <RoleGuard allowedRoles={["lojista", "admin"]} redirectTo="/" requireApproval>
          <PdvPage />
        </RoleGuard>
      }
    />
    <Route
      path="/admin/pdv/kds"
      element={
        <RoleGuard allowedRoles={["lojista", "admin"]} redirectTo="/" requireApproval>
          <PdvKdsPage />
        </RoleGuard>
      }
    />
    <Route
      path="/admin/cardapio"
      element={
        <RoleGuard allowedRoles={["lojista", "admin"]} redirectTo="/" requireApproval>
          <PdvCardapioPage />
        </RoleGuard>
      }
    />
    <Route path="/admin/pdv/cardapio" element={<Navigate to="/admin/cardapio" replace />} />
  </>
);
