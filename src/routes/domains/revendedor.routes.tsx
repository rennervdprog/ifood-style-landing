import { Route } from "react-router-dom";
import RoleGuard from "@/components/RoleGuard";
import { ResellerDashboard, ResellerAuth } from "@/routes/lazyPages";

export const revendedorRoutes = (
  <>
    <Route
      path="/revendedor"
      element={
        <RoleGuard allowedRoles={["revendedor", "admin"]} redirectTo="/revendedor/entrar">
          <ResellerDashboard />
        </RoleGuard>
      }
    />
    <Route path="/revendedor/entrar" element={<ResellerAuth />} />
    <Route path="/revendedor/cadastro" element={<ResellerAuth />} />
  </>
);
