# Plano — Matar spinners desnecessários

Objetivo: nenhum spinner de tela cheia quando já temos cache, dados públicos ou pode-se mostrar skeleton. UX deve parecer instantânea.

## Diagnóstico (achados reais)

**Spinners de tela cheia que aparecem toda navegação (piores):**
1. `PageLoader` global do `<Suspense>` em `App.tsx` — dispara mesmo em rotas já carregadas no cache do browser porque o chunk lazy re-avalia. Aparece por 30–80ms em cada troca de rota rápida.
2. `PerfilPage`, `PedidosPage`, `CheckoutPage`, `PdvCardapioPage` (6 spinners cada) — cada seção tem `if (loading) return <Spinner/>` bloqueando render inteiro em vez de skeleton parcial.
3. `AdminDashboardV2` / `SuperAdminDashboardV2` / `MatrizDashboard` — tela branca+spinner enquanto `useUserRouting` valida, mesmo com sessão em cache.
4. `PartnerLogin` / `PartnerOnboarding` — spinner full-screen enquanto decide redirect (deveria redirecionar direto sem render).
5. `PdvKdsPage`, `PdvPage` — spinner a cada refetch de pedidos por causa de `refetchOnWindowFocus` sem `keepPreviousData`/`placeholderData`.
6. `StorePage`, `PublicOrderTracking`, `BlogPost` — spinner full-screen em dados 100% públicos que dá pra SSG/pré-cachear ou mostrar skeleton com shape real.
7. `AdminPlanManager` (8 spinners), `AsaasFinancialPanel`, `AsaasSubaccountSetup` — cada botão/aba com spinner separado; muitos ficam em loop porque a query invalida a si mesma.
8. `ResellerDashboard` — spinner enquanto `MrrAreaChart` lazy carrega (já lazy, mas fallback é spinner grande em vez de mini-shape do gráfico).
9. `CapacitorRouteGuard` e `StoreAppGuard` — flicker de spinner no boot antes de decidir rota.

**Causas raízes comuns:**
- Uso de `if (isLoading) return <Spinner/>` em vez de `placeholderData: keepPreviousData` do React Query.
- Falta de `initialData` vindo do cache em queries que já rodaram no `useUserRouting`.
- Suspense fallback global sempre é spinner grande — deveria ser transparente para rotas <200ms.
- Guards que renderizam spinner enquanto poderiam apenas retornar `null` (não flickam) ou `<Navigate/>` direto.

## Fases

### Fase 1 — Suspense inteligente (maior ROI)
- Trocar `PageLoader` global por fallback com delay de 150ms (`useDelayedFallback`) — se o chunk carrega antes, nenhum spinner aparece.
- Manter shell (header/nav) fora do Suspense de rota para não piscar.

### Fase 2 — React Query stale-while-revalidate
- Adicionar `placeholderData: keepPreviousData` nas queries dos dashboards que refazem fetch no focus: `PdvPage`, `PdvKdsPage`, `AdminDashboardV2`, `DriverDashboardV2`, `PedidosPage`.
- Definir `staleTime` alto (30–60s) em `useUserRouting`, `useStorePlan`, `useUserRole` — hoje tudo é 0 e refaz a cada mount.

### Fase 3 — Guards sem flicker
- `RoleGuard`, `CapacitorRouteGuard`, `StoreAppGuard`, `LojistaHomeRedirect`, `PartnerLogin` redirect: quando `loading`, retornar `null` (não `<Spinner/>`) — o Suspense já cobre e evita duplo-spinner.
- Persistir última rota conhecida por role em `localStorage` para redirect síncrono no boot (elimina spinner de "decidindo pra onde ir").

### Fase 4 — Skeletons no lugar de spinners de página
- Substituir spinner full-screen por skeleton com shape real em: `PerfilPage`, `PedidosPage`, `CheckoutPage`, `StorePage`, `BlogPost`, `PublicOrderTracking`, `ResellerDashboard`, `PdvCardapioPage`.
- Reutilizar `Skeleton` do shadcn já disponível.

### Fase 5 — Componentes internos
- `AdminPlanManager`, `AsaasFinancialPanel`, `AsaasSubaccountSetup`, `WhatsAppSetup`: trocar spinner de aba inteira por spinner inline no botão de ação. Nunca esconder conteúdo já carregado.
- `MrrAreaChart` Suspense fallback vira `<Skeleton className="h-64"/>`.

### Fase 6 — Validação
- Playwright: medir tempo até "conteúdo visível" em `/admin`, `/super-admin`, `/entregador`, `/cliente`, `/pedidos`, `/perfil` — target: nenhum spinner full-screen visível se rota trocar em <200ms.
- Regressão: rodar `routing-source-of-truth.spec.ts` e suíte E2E.
- Bump versão + versionCode.

## Detalhes técnicos

- Novo util `src/lib/useDelayedFallback.ts` — hook que retorna `true` só depois de N ms montado; usado no fallback do Suspense.
- Novo util `src/lib/lastRouteByRole.ts` — grava/lê último path por role para redirect síncrono no boot.
- React Query defaults centralizados em `src/lib/queryClient.ts`: `staleTime: 30_000`, `refetchOnWindowFocus: 'always'` mas com `placeholderData: keepPreviousData` opt-in por query.
- Regra: qualquer `if (loading) return <Spinner .../>` em componente de página → refatorar para skeleton OU `null` se for guard.

## Estimativa
Fase 1: 20min · Fase 2: 40min · Fase 3: 30min · Fase 4: 1h · Fase 5: 40min · Fase 6: 30min.
