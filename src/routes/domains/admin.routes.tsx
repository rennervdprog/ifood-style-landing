import { Route, Navigate } from "react-router-dom";
import { GuardedLayout } from "@/routes/layouts/GuardedLayout";
import {
  Index,
  SuperAdminDashboardV2,
  SandboxTestsPage,
  ModeradorDashboard,
  SupportAgentDashboard,
  BlogAdmin,
  BlogAdminEditor,
} from "@/routes/lazyPages";

export const adminRoutes = (
  <>
    {/* Área admin-only: um único guard cobre painel, super-admin e blog admin */}
    <Route element={<GuardedLayout allowedRoles={["admin"]} redirectTo="/" />}>
      <Route path="/painel" element={<Index />} />
      <Route path="/super-admin" element={<SuperAdminDashboardV2 />} />
      <Route path="/super-admin/sandbox-tests" element={<SandboxTestsPage />} />
      <Route path="/admin/blog" element={<BlogAdmin />} />
      <Route path="/admin/blog/novo" element={<BlogAdminEditor />} />
      <Route path="/admin/blog/:id" element={<BlogAdminEditor />} />
    </Route>
    <Route path="/super-admin1" element={<Navigate to="/super-admin" replace />} />
    <Route path="/super-admin2" element={<Navigate to="/super-admin" replace />} />

    {/* Moderador + Suporte — cada um com seu role, mas redirect comum /auth */}
    <Route element={<GuardedLayout allowedRoles={["moderador", "admin"]} redirectTo="/auth" />}>
      <Route path="/moderador" element={<ModeradorDashboard />} />
    </Route>
    <Route element={<GuardedLayout allowedRoles={["suporte", "admin"]} redirectTo="/auth" />}>
      <Route path="/suporte" element={<SupportAgentDashboard />} />
    </Route>
  </>
);
