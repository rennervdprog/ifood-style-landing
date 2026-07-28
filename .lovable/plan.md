# Plano — Refatoração do Sistema de Rotas (MVC feature-based)

Baseado no relatório de auditoria. Migração **incremental**, cada fase é revertível e testável independentemente. Sem big-bang.

---

## Fase 0 — Correções críticas (🔴, imediato, sem mudar estrutura)

Alvo: `src/App.tsx`, `src/components/CapacitorRouteGuard.tsx`.

- Adicionar `RoleGuard` em `/revendedor` (roles: `revendedor`, `admin`) e `/moderador` (roles: `moderador`, `admin`).
- Adicionar guard de autenticação em `/pedidos` e `/perfil` (redireciona para `/auth` se não logado).
- Sincronizar `PARTNER_ROUTES` e `PARTNER_ALLOWED_PREFIXES` com rotas reais: incluir `/matriz`, `/admin/pdv`, `/admin/cardapio`, `/suporte`, `/admin/blog`, `/revendedor`, `/seja-revendedor`; remover `/entregador2` (é só redirect).
- Limpar `CLIENT_ALLOWED_PREFIXES` morto e duplicatas (`/auth`, `/cupons`).
- Remover import morto de `LandingPage` OU registrar a rota (decidir com o usuário).
- Remover `"termos"`/`"privacidade"` da lista de "reservados→NotFound" (já são `Navigate` funcionais antes).

Ganho: fecha 7 bugs 🔴 sem tocar em arquitetura.

---

## Fase 1 — `RESERVED_SLUGS` como fonte única ✅ (v1.26.47)

Feito: `src/routes/reservedSlugs.ts` com `RESERVED_SLUGS` + `isReservedSlug()`, guard no topo de `StorePage`, remoção do bloco de rotas estáticas duplicadas em `App.tsx`.

---

## Fase 2 — Route manifest tipado ✅ (v1.26.48)

Feito: `src/routes/manifest.ts` com `ROUTES` const tipado e builders (`store.bySlug`, `admin.blogEdit`, etc.). `useUserRouting` agora reconhece roles `moderador`/`suporte` e roteia para `/moderador`/`/suporte`. Migração dos call-sites `navigate("/…")` para `ROUTES.*` fica incremental sob demanda.

---

## Fase 3 — Rotas por domínio ✅ (v1.27.0)

Feito: `src/routes/lazyPages.ts` centraliza os `lazy()` + `registerRoutePrefetch`. Cada domínio (`public`, `cliente`, `auth`, `lojista`, `driver`, `admin`, `revendedor`, `store`) tem seu próprio `*.routes.tsx` que exporta um fragmento de `<Route>`s. `App.tsx` compõe os fragmentos dentro de `<Routes>` — feature parity total, ~140 linhas removidas. Migração para `createBrowserRouter` fica adiada para Fase 4/5 (traz layouts + errorElement por sub-árvore).

## Fase 4 — Layouts com `<Outlet/>` + guards compostos ✅ (v1.27.1)

`src/routes/layouts/GuardedLayout.tsx` embrulha `RoleGuard` uma única vez ao redor de um `<Outlet/>`. `LojistaHomeLayout` faz o mesmo com `LojistaHomeRedirect` (só em `/admin`). Domains refatorados: `lojista`, `admin`, `cliente`, `driver`, `revendedor` — agora usam `<Route element={<GuardedLayout .../>}><Route .../></Route>`. Eliminadas 14 repetições de `<RoleGuard>` (7 em admin/blog + super-admin, 3 em PDV, 2 em cliente, 1 driver, 1 revendedor). Zero mudança de comportamento; typecheck limpo.

## Fase 5 — 404 escopado + deep-link resolver ✅ (v1.27.2)

- `src/components/ScopedNotFound.tsx`: 404 contextual (`scope` + `homePath`) que loga o path e oferece CTA para a home do domínio.
- Aplicado como wildcard `<Route path="X/*"/>` no fim dos domains: `/admin/*` (Admin Lojista), `/super-admin/*` (Super Admin), `/entregador/*`, `/revendedor/*`. Evita cair no 404 genérico ou no catch-all `/:slug` de loja.
- `src/routes/capacitor/deepLinkResolver.ts`: extrai o rewrite de cold-start do `main.tsx` (`/` → `/portal-parceiro` no APK Parceiro) para um único ponto testável. Listeners `appUrlOpen`/`backButton`/push seguem em `capacitorNative.ts` até a Fase 6/migração para `createBrowserRouter`.

---

## Fase 4 — Layouts reais com `<Outlet/>` + guards compostos

- `src/routes/layouts/` (`LojistaLayout`, `AdminLayout`, `ClienteLayout`, `DriverLayout`, `PdvLayout`, `PublicLayout`).
- `src/routes/guards/` (`withAuth`, `withRole`, `withCapacitorMode`, `compose`).
- Aplica `RoleGuard`/`TrialExpiredGuard` **1x** no layout pai — elimina 5 repetições em `/admin*`.
- `RoleGuard` atual quebrado em peças puras e testáveis.

---

## Fase 5 — 404 por sub-árvore + deep links Capacitor

- `errorElement` por domínio: `/admin/foo-invalido` mostra `NotFound scope="admin"` em vez de tentar renderizar como loja.
- Novo `src/routes/capacitor/deepLinkResolver.ts` centralizando:
  - `history.replaceState` cold-start (hoje em `main.tsx`).
  - `PushNavigator` / `consumePendingPushNavigation` (hoje em `App.tsx`).
  - `App.addListener('appUrlOpen', ...)` para Universal Links.
  - `App.addListener('backButton', ...)` conectado ao `navigate(-1)` do router — remove stack customizada.
- `PARTNER_ROUTES`/`CLIENT_*` **derivados automaticamente** do manifest (`domains.filter(d => d.audience === "partner")`) — impossível desalinhar.

---

## Fase 6 — SEO e prefetch tipados

- `<RouteMeta>` declarativo por entrada do manifest (`title`, `description`, `ogImage`).
- Aplicar em `/`, `/cliente`, `/loja/:id`, `/:slug` (maior tráfego, hoje sem `<Helmet>`).
- `registerRoutePrefetch` alimentado pelo manifest — não mais lista manual.

---

## Detalhes técnicos

- **Router:** migrar `<BrowserRouter>` + `<Routes>` para `createBrowserRouter(routes)` + `<RouterProvider>`. Mantém `BrowserRouter` internamente (hosting Lovable trata SPA fallback).
- **Compat:** manter todos os redirects legados (`/admin2`, `/entregador1`, `/super-admin1`, etc.) durante toda a migração; remover só em release major.
- **Testes:** snapshot de `RouteObject[]` antes/depois de cada fase; E2E Playwright existente (`e2e/routing-source-of-truth.spec.ts`) roda em cada fase.
- **Versionamento:** cada fase incrementa patch; Fase 3 (nova arquitetura de router) incrementa minor.

---

## Ordem sugerida de execução

Começar pela **Fase 0** (baixo risco, alto impacto — fecha todos os 🔴). As demais fases entram uma por commit, com validação em preview antes da próxima.

Confirma que começo pela Fase 0?
