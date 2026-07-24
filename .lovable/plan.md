# Plano de Performance — Alto ROI

Foco: reduzir tempo de login, navegação e boot em Android mid-tier. Sem mudanças de lógica de negócio.

## Fase 1 — Enxugar `useUserRouting` (maior ganho no login)

Hoje o hook dispara ~7 queries Supabase em paralelo assim que a sessão existe, mesmo quando só precisamos saber o papel do usuário para redirecionar.

**Ações:**
1. Dividir em 2 estágios:
   - **Estágio A (crítico)**: 1 única RPC `get_user_routing_context(user_id)` retornando `{ role, plan_type, store_id, is_reseller, needs_onboarding }` em uma chamada.
   - **Estágio B (background)**: dados secundários (settings, flags VIP, contadores) carregam via `queueMicrotask` depois do redirect.
2. Criar RPC `public.get_user_routing_context` SECURITY DEFINER agregando as consultas atuais.
3. Cachear resultado em `sessionStorage` por 60s (chave = user id) — evita refetch em navegações rápidas.
4. Ganho esperado: ~400–900 ms a menos entre "login OK" e "painel visível".

## Fase 2 — Prefetch de chunks por hover/foco

Chunks pesados (`SuperAdminDashboardV2`, `AdminDashboardV2`, `PdvPage`, `recharts`) só baixam no clique.

**Ações:**
1. Criar util `prefetchRoute(path)` que chama o mesmo `import()` do `lazy()` da rota.
2. Wrapper `<PrefetchLink>` em cima de `<Link>` disparando prefetch em `onMouseEnter` / `onFocus` / `onTouchStart` (com `requestIdleCallback` fallback).
3. Aplicar nos pontos de entrada:
   - Sidebar do Super Admin
   - Menu do lojista (`AdminDashboardV2` → PDV, Financeiro, Cardápio)
   - Bottom nav mobile do PDV
   - Landing `StoreDirectory` → `/portal-parceiro`, `/revendedor/auth`
4. Ganho: primeira navegação após login vira instantânea (chunk já em cache).

## Fase 3 — Recharts sob demanda

`recharts` pesa ~90 KB gzip e hoje entra no bundle de várias telas admin.

**Ações:**
1. Isolar cada gráfico em componente próprio com `React.lazy`.
2. Renderizar via `<Suspense fallback={<ChartSkeleton/>}>` só quando visível (IntersectionObserver).
3. Verificar se `MRRChart`, `FinanceTab` e `PdvRelatorios` compartilham o mesmo chunk (config manual em `vite.config.ts` → `manualChunks: { recharts: ['recharts'] }`).

## Fase 4 — Imagens

**Ações:**
1. Adicionar `vite-imagetools`; converter hero da `StoreDirectory` e logo horizontal para `.webp` + `.avif`.
2. `<picture>` com `<source type="image/avif">` + fallback.
3. `loading="lazy"` + `decoding="async"` em toda imagem below-the-fold.
4. Manter apenas o preload do logo LCP (já feito em v1.25.26).

## Fase 5 — Validação

1. Rodar Playwright `routing-source-of-truth.spec.ts` + suite reseller (6/6).
2. Medir com `performance.mark` no `ClientAuthScreen` → primeiro paint do painel (log em dev).
3. Lighthouse mobile na `StoreDirectory` antes/depois (meta: LCP < 2.5s, TBT < 200 ms).
4. Bump para **v1.25.29** (versionCode 1128) ao final.

## Detalhes técnicos

- RPC nova precisa de `GRANT EXECUTE ... TO authenticated`.
- Cache de sessão invalidado em `signOut` e ao trocar de plano/role.
- Prefetch respeita `navigator.connection.saveData` (não prefetch em 2G/save-data).
- Chunk split de recharts precisa checar se `PdvBoutique` também usa, para não duplicar.

## Ordem sugerida de execução

1. Fase 1 (maior ROI, ~1h)
2. Fase 2 (rápido, ~40min)
3. Fase 3 (moderado, ~1h)
4. Fase 4 (opcional, depende de assets)
5. Fase 5 validação
