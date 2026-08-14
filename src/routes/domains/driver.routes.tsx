import { Route, Navigate } from "react-router-dom";
import { GuardedLayout } from "@/routes/layouts/GuardedLayout";
import { ScopedNotFound } from "@/components/ScopedNotFound";
import { DriverDashboardV2 } from "@/routes/lazyPages";

export const driverRoutes = (
  <>
    <Route
      element={
        <GuardedLayout allowedRoles={["motoboy", "admin"]} redirectTo="/" requireApproval />
      }
    >
      <Route path="/entregador" element={<DriverDashboardV2 />} />
    </Route>
    <Route path="/entregador1" element={<Navigate to="/entregador" replace />} />
    <Route path="/entregador2" element={<Navigate to="/entregador" replace />} />

    {/* 404 escopado /entregador/* (Fase 5). */}
    <Route
      path="/entregador/*"
      element={<ScopedNotFound scope="Entregador" homePath="/entregador" />}
    />
  </>
);
