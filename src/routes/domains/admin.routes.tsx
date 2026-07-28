import { Route, Navigate } from "react-router-dom";
import RoleGuard from "@/components/RoleGuard";
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
    <Route
      path="/painel"
      element={
        <RoleGuard allowedRoles={["admin"]} redirectTo="/">
          <Index />
        </RoleGuard>
      }
    />
    <Route
      path="/super-admin"
      element={
        <RoleGuard allowedRoles={["admin"]} redirectTo="/">
          <SuperAdminDashboardV2 />
        </RoleGuard>
      }
    />
    <Route path="/super-admin1" element={<Navigate to="/super-admin" replace />} />
    <Route path="/super-admin2" element={<Navigate to="/super-admin" replace />} />
    <Route
      path="/super-admin/sandbox-tests"
      element={
        <RoleGuard allowedRoles={["admin"]} redirectTo="/">
          <SandboxTestsPage />
        </RoleGuard>
      }
    />
    <Route
      path="/moderador"
      element={
        <RoleGuard allowedRoles={["moderador", "admin"]} redirectTo="/auth">
          <ModeradorDashboard />
        </RoleGuard>
      }
    />
    <Route
      path="/suporte"
      element={
        <RoleGuard allowedRoles={["suporte", "admin"]} redirectTo="/auth">
          <SupportAgentDashboard />
        </RoleGuard>
      }
    />
    <Route
      path="/admin/blog"
      element={
        <RoleGuard allowedRoles={["admin"]} redirectTo="/">
          <BlogAdmin />
        </RoleGuard>
      }
    />
    <Route
      path="/admin/blog/novo"
      element={
        <RoleGuard allowedRoles={["admin"]} redirectTo="/">
          <BlogAdminEditor />
        </RoleGuard>
      }
    />
    <Route
      path="/admin/blog/:id"
      element={
        <RoleGuard allowedRoles={["admin"]} redirectTo="/">
          <BlogAdminEditor />
        </RoleGuard>
      }
    />
  </>
);
