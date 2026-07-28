import { Route } from "react-router-dom";
import { GuardedLayout } from "@/routes/layouts/GuardedLayout";
import { ResellerDashboard, ResellerAuth } from "@/routes/lazyPages";

export const revendedorRoutes = (
  <>
    <Route
      element={
        <GuardedLayout
          allowedRoles={["revendedor", "admin"]}
          redirectTo="/revendedor/entrar"
        />
      }
    >
      <Route path="/revendedor" element={<ResellerDashboard />} />
    </Route>
    <Route path="/revendedor/entrar" element={<ResellerAuth />} />
    <Route path="/revendedor/cadastro" element={<ResellerAuth />} />
  </>
);
