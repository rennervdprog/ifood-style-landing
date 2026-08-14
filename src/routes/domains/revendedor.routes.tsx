import { Route } from "react-router-dom";
import { GuardedLayout } from "@/routes/layouts/GuardedLayout";
import { ScopedNotFound } from "@/components/ScopedNotFound";
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

    {/* 404 escopado /revendedor/* (Fase 5). */}
    <Route
      path="/revendedor/*"
      element={<ScopedNotFound scope="Revendedor" homePath="/revendedor" />}
    />
  </>
);
