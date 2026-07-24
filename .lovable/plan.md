# Plano — Fonte da Verdade das Rotas (v2, com E2E)

## Objetivo

Centralizar toda decisão de "para onde mandar o usuário" em **um único hook** (`useUserRouting`), eliminando as 5 cópias divergentes, os spinners em cascata e os double-redirects. **Sem quebrar nada**: guards continuam existindo (segurança em profundidade), só passam a ler do mesmo cache.

---

## Fase 0 — Rede de segurança (E2E ANTES de mexer)

Antes de tocar em qualquer arquivo de rota/guard, criar a suíte que valida o comportamento **atual** e servirá como baseline. Se a refatoração quebrar algo, o teste acusa.

Criar `e2e/routing-source-of-truth.spec.ts` com cenários:

1. **Admin** loga em `/portal-parceiro` → destino final `/super-admin`.
2. **Lojista delivery** loga em `/portal-parceiro` → destino final `/admin`.
3. **Lojista pdv_only** loga em `/portal-parceiro` → destino final `/admin/pdv` (hoje passa por `/admin` primeiro — teste vai registrar isso e depois validar que **não passa mais**).
4. **Motoboy** loga → `/entregador`.
5. **Cliente** loga em `/cliente` → permanece em `/cliente`.
6. **Revendedor** loga em `/cliente` → destino `/revendedor` (ou home do revendedor).
7. **Já logado** entra em `/portal-parceiro` → é levado direto ao seu painel sem mostrar tela de login.
8. **Lojista tentando `/super-admin`** → bloqueado pelo `RoleGuard`, redirecionado.

Cada teste usa `page.on('framenavigated')` para contar navegações intermediárias e `page.on('response')` (ou marca visual) para contar spinners. Baseline atual será gravada como número máximo aceitável; após refatoração, apertamos os limites (1 navegação, 1 spinner).

Usar o mesmo padrão de mint de sessão dos E2Es existentes (`e2e-mint-session` + `E2E_SETUP_TOKEN`), reaproveitando usuários seed já criados nos workflows atuais. Adicionar um seed de usuário **pdv_only** se ainda não existir.

Rodar localmente (`bunx playwright test e2e/routing-source-of-truth.spec.ts`) e no workflow `.github/workflows/e2e-playwright.yml`.

Também adicionar teste unitário Vitest em `src/hooks/__tests__/useUserRouting.test.ts` cobrindo cada branch de resolução de `homeRoute` (admin, lojista, lojista pdv_only, matriz, motoboy, reseller, cliente, fallback).

---

## Fase 1 — Hook `useUserRouting` (fonte da verdade)

`src/hooks/useUserRouting.ts`:

- react-query `queryKey: ["user-routing", userId]`, `staleTime: 5min`, `gcTime: 30min`.
- Uma única `queryFn` que dispara em **paralelo** (`Promise.all`):
  - `user_roles` (admin?)
  - `profiles` (role, is_approved, network_id, unit_store_id)
  - `stores` (owner_id → id, slug) — fallback lojista
  - `store_networks` (owner_id) — fallback matriz
  - `drivers` + `store_drivers` — fallback motoboy
  - `store_plans.plan_type` do store resolvido — para `isPdvOnly`
  - `resellers` — para `isReseller`
- Retorna:
  ```ts
  { role, isAdmin, isLojista, isMatriz, isMotoboy, isReseller,
    isPdvOnly, isApproved, storeId, storeSlug, homeRoute, loading }
  ```
- `homeRoute`: `/super-admin` | `/admin/pdv` | `/admin` | `/entregador` | `/revendedor` | `/cliente` | `/portal-parceiro`.
- Invalidação: `AuthContext` chama `queryClient.removeQueries(["user-routing"])` no `SIGNED_OUT` e `invalidateQueries` no `SIGNED_IN`.

**Nada é refatorado ainda** — o hook é apenas criado e testado com o Vitest da Fase 0.

---

## Fase 2 — Migrar consumidores (um por vez, com verde no E2E)

Ordem incremental para minimizar risco. Após cada item: rodar `e2e/routing-source-of-truth.spec.ts` — precisa estar verde antes do próximo.

1. **`ClientAuthScreen.redirectByRole`** → substituir por `invalidate + navigate(homeRoute, {replace:true})`. Fim do `window.location.replace`.
2. **`PartnerLogin`** → mesma coisa; remove chamadas soltas a `resolvePartnerDashboard`.
3. **`CapacitorRouteGuard`** → lê `homeRoute` do hook em vez de chamar `resolvePartnerDashboard`. Mantém a lógica de `appMode` (partner vs cliente APK) intacta.
4. **`RoleGuard`** → mantém API pública (`allowedRoles`, `requireApproval`) e comportamento; internamente troca as 5 queries próprias por `useUserRouting()`. Regressão coberta pelo teste 8.
5. **`resolvePartnerDashboard`** → vira thin wrapper que lê `queryClient.getQueryData(["user-routing", userId])`; se não houver cache, faz fallback à lógica antiga (não quebra callers ainda não migrados).
6. **`ClientHomeSwitch`** → usa `isReseller` do hook; `useIsReseller` deprecado (mas mantido enquanto houver outros callers).

---

## Fase 3 — `pdv_only` decidido no roteamento (elimina double-redirect)

- Criar `<LojistaHomeRedirect />`: se `isPdvOnly` → `<Navigate to="/admin/pdv" replace />`, senão renderiza `AdminDashboardV2`.
- Trocar `App.tsx` `/admin` para envolver com esse wrapper (dentro do `RoleGuard` existente).
- **Remover** de `AdminDashboardV2` o redirect tardio para `/admin/pdv` e a escrita de `itasuper:userPlan`/`itasuper:userRole` no localStorage.
- Teste 3 do E2E passa a exigir `framenavigated === 1` (sem passar por `/admin` no meio).

---

## Fase 4 — Limpeza

- `rg "ClientGuard"` — se só houver o próprio arquivo e o `App.tsx` sem uso ativo, **deletar** `src/components/ClientGuard.tsx`.
- Remover queries duplicadas de `stores.owner_id` em `StoreDirectory.tsx` — usar hook.
- Remover leituras de `itasuper:userPlan:*` / `itasuper:userRole:*` em toda a base.
- Regra do projeto: navegação interna **sempre** via `navigate(..., {replace:true})`, nunca `window.location.replace`.

---

## Fase 5 — Validação final

- Rodar suíte completa Playwright do projeto (`bunx playwright test`) — todos os specs existentes precisam continuar verdes.
- Rodar `e2e/routing-source-of-truth.spec.ts` com asserts apertados (1 navegação, 1 spinner).
- Rodar Vitest (`useUserRouting.test.ts` + testes existentes).
- Testar manualmente no preview: login como admin, lojista delivery, lojista pdv_only, motoboy, cliente, revendedor.
- Bump de versão em `src/lib/appVersion.ts`, `src/pages/PerfilPage.tsx`, `android/app/build.gradle` (`versionName` + `versionCode+1`).

---

## Detalhes técnicos

- Hook em `src/hooks/useUserRouting.ts`; consumido pelo `QueryClient` global já existente.
- Cache invalidado em `SIGNED_OUT`/`SIGNED_IN` no `AuthContext` (única alteração no context).
- `CapacitorRouteGuard` continua responsável por lógica de APK (partner vs cliente) — apenas a fonte do `homeRoute` muda.
- `resolvePartnerDashboard` mantido temporariamente como shim para compatibilidade; remover só quando 0 callers ativos.

## Riscos & mitigação

- **RoleGuard usado em muitas rotas**: manter API pública idêntica; E2E cobre cada allowedRoles.
- **Cache stale após mudança de role no Super Admin**: invalidar `["user-routing", targetUserId]` nas ações que mudam role.
- **Capacitor partner APK**: `homeRoute` respeita `appMode` — partner nunca resolve para `/cliente`. Teste específico no Playwright emulando `capApp=partner`.
- **Loja pdv_only sem `store_plans.plan_type` populado**: hook trata `null` como `commission_only` (mesmo default de hoje).

## Fora de escopo

- Redesign visual.
- Mudar regras de plano/`pdv_only`.
- Mudar `AuthContext` além da invalidação de cache.
