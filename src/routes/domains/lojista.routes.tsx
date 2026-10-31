import { Route, Navigate } from "react-router-dom";
import { GuardedLayout } from "@/routes/layouts/GuardedLayout";
import { LojistaHomeLayout } from "@/routes/layouts/LojistaLayout";
import { PdvAccessLayout } from "@/routes/layouts/PdvAccessLayout";
import { ScopedNotFound } from "@/components/ScopedNotFound";
import {
  AdminDashboardV2Teste,
  MatrizDashboard,
  MatrizDashboardV2,
  PdvPageTeste,
  PdvKdsPage,
  PdvCardapioPage,
} from "@/routes/lazyPages";

export const lojistaRoutes = (
  <>
    {/* /admin — dashboard raiz do lojista (com LojistaHomeRedirect).
        Alinhamento 2026-11-02: monta a árvore Teste (AdminDashboardV2Teste),
        a mesma de /admin-teste — árvore única, dois mounts. */}
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
        <Route path="/admin" element={<AdminDashboardV2Teste />} />
      </Route>
      {/* /admin-teste — mesmo painel, mesma árvore (mount permanente) */}
      <Route element={<LojistaHomeLayout />}>
        <Route path="/admin-teste" element={<AdminDashboardV2Teste />} />
      </Route>
    </Route>
    <Route path="/admin2" element={<Navigate to="/admin" replace />} />

    {/* /matriz — dashboard multi-unidade */}
    <Route element={<GuardedLayout allowedRoles={["lojista_matriz", "admin"]} redirectTo="/" />}>
      <Route path="/matriz" element={<MatrizDashboard />} />
      {/* /matriz-v2 — painel da matriz refeito (Fase 2); o antigo fica intacto */}
      <Route path="/matriz-v2" element={<MatrizDashboardV2 />} />
    </Route>

    {/* PDV + Cardápio — mesmo guard */}
    <Route
      element={
        <GuardedLayout allowedRoles={["lojista", "admin"]} redirectTo="/" requireApproval />
      }
    >
      <Route element={<PdvAccessLayout />}>
        <Route path="/admin/pdv" element={<PdvPageTeste />} />
        <Route path="/admin-teste/pdv" element={<PdvPageTeste />} />
        <Route path="/admin/pdv/kds" element={<PdvKdsPage />} />
        <Route path="/admin/cardapio" element={<PdvCardapioPage />} />
      </Route>
    </Route>
    <Route path="/admin/pdv/cardapio" element={<Navigate to="/admin/cardapio" replace />} />

    {/* 404 escopado para sub-árvore /admin/* (Fase 5) — depois de todas as rotas conhecidas. */}
    <Route
      path="/admin/*"
      element={<ScopedNotFound scope="Admin Lojista" homePath="/admin" />}
    />
  </>
);

