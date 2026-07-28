import { Route, Navigate } from "react-router-dom";
import RoleGuard from "@/components/RoleGuard";
import { DriverDashboardV2 } from "@/routes/lazyPages";

export const driverRoutes = (
  <>
    <Route
      path="/entregador"
      element={
        <RoleGuard allowedRoles={["motoboy", "admin"]} redirectTo="/" requireApproval>
          <DriverDashboardV2 />
        </RoleGuard>
      }
    />
    <Route path="/entregador1" element={<Navigate to="/entregador" replace />} />
    <Route path="/entregador2" element={<Navigate to="/entregador" replace />} />
  </>
);
