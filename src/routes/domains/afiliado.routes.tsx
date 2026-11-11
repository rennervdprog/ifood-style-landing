import { Route } from "react-router-dom";
import { ScopedNotFound } from "@/components/ScopedNotFound";
import { AfiliadoDashboard } from "@/routes/lazyPages";

// Painel do Afiliado (Fase 2). Sem GuardedLayout por papel: o acesso é
// pelo cadastro em `affiliates` (user_id), e a própria página trata os
// estados — sem sessão → /auth; sem cadastro → convite; pending →
// análise; suspended → suspenso; approved → painel completo.
export const afiliadoRoutes = (
  <>
    <Route path="/afiliado" element={<AfiliadoDashboard />} />

    {/* 404 escopado /afiliado/* */}
    <Route
      path="/afiliado/*"
      element={<ScopedNotFound scope="Afiliado" homePath="/afiliado" />}
    />
  </>
);
