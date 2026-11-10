import { Route, Navigate } from "react-router-dom";
import { GuardedLayout } from "@/routes/layouts/GuardedLayout";
import { LojistaHomeLayout } from "@/routes/layouts/LojistaLayout";
import { PdvAccessLayout } from "@/routes/layouts/PdvAccessLayout";
import { ScopedNotFound } from "@/components/ScopedNotFound";
import {
  AdminDashboardReorg,
  MatrizDashboard,
  MatrizDashboardV2,
  PdvPageTeste,
  PdvKdsPage,
  PdvCardapioPage,
} from "@/routes/lazyPages";

export const lojistaRoutes = (
  <>
    {/* /admin — dashboard raiz do lojista (com LojistaHomeRedirect).
        Promoção 2026-11-10 (decisão do Renner): monta a casca REORG
        (AdminDashboardReorg), a mesma de /admin-teste — árvore única,
        dois mounts. Rollback = voltar este element para
        <AdminDashboardV2Teste /> (a árvore Teste segue no repo). */}
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
        <Route path="/admin" element={<AdminDashboardReorg />} />
      </Route>
      {/* /admin-teste — casca REORG (reorganização do painel, 2026-11-08):
          mount de comparação ao vivo; desde a promoção de 2026-11-10 o
          /admin oficial monta a MESMA casca Reorg. */}
      <Route element={<LojistaHomeLayout />}>
        <Route path="/admin-teste" element={<AdminDashboardReorg />} />
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

