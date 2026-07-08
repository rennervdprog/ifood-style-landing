# Plano de execução — Fases 2 e 3 do mapa Super Admin

Baseado em `docs/super-admin-map.md`. Corrige as 6 divergências confirmadas sem redesenhar o painel.

---

## Fase 2 — Padronização (helpers, sem UI)

**1. `src/lib/plansInfo.ts`** — garantir `label` para todo `plan_type` e exportar:
```ts
export const planLabel = (t?: string) => PLANS[t ?? ""]?.label ?? "—";
```

**2. `src/lib/pagante.ts`** (novo) — helper único usado por KPI e listas do Financeiro:
```ts
export const isPagante = (store, plan) =>
  !store.is_test && plan?.is_active &&
  ["fixed","supporter","autonomy","hybrid","commission_only"].includes(plan.plan_type);
```

**3. `src/components/plans/PlanBadge.tsx`** e **`VipBadge.tsx`** (novos) — badges reutilizáveis. `VipBadge` recebe `vipDiffs` do `useStorePlan` e mostra tooltip com o que está personalizado.

**4. `useStorePlan`** — já expõe `isVip` + `vipDiffs`, sem mudanças.

---

## Fase 3 — Correções pontuais (na ordem)

**1. Renomear aba** `Financeiro > Auditoria` → **"Auditoria Financeira"**
- `src/pages/SuperAdminDashboardV2.tsx` linha ~1143 (item do `SubTabsBar`).

**2. `MensalidadesPanel`**
- Remover `<PlanosTab />` embutido (fim do componente).
- Trocar filtro `plan_type='fixed'` por `in ('fixed','supporter','autonomy')` para incluir todos os planos com mensalidade.
- Usar `planLabel()` nas linhas da tabela.

**3. Sub-abas de `PlanosTab` sobem para o Financeiro**
- `Financeiro > Planos (Lojas)` → `AdminPlanManager`
- `Financeiro > Planos (Templates)` → `AdminPlanTemplatesEditor`
- Remover `AdminFixedPlanReceivables` (redundante — dado já vem via `get_platform_receivables` em `AReceberTab`).
- Deletar `PlanosTab.tsx` após migração.

**4. Card de loja (`AdminPlanManager`)**
- Nunca esconder linha de taxa VIP zerada — sempre `R$ 0,00`.
- Adicionar `<VipBadge>` ao lado dos valores personalizados.
- Trocar badge "Fixo Mensal" por `<PlanBadge planType={plan.plan_type} />` + valor real.

**5. Strings hardcoded → `planLabel()`**
- Varredura em: `FinanceCenter.tsx`, `AReceberTab.tsx`, `HistoricoRepassesTab.tsx`, `MensalidadesPanel.tsx`, `StoreSubscription.tsx`, `AdminPlanManager.tsx`.

**6. KPI vs lista do `FinanceTabFull`**
- Substituir filtros locais por `isPagante(store, plan)` em ambos → mesma contagem em KPI e lista.

**7. `DeliveryFeeConfigPanel`**
- Adicionar contador "N lojas com override VIP" (query em `store_plans.platform_delivery_split_override IS NOT NULL`).

---

## Versão e verificação
- Bump `1.11.95` → `1.11.96` em `src/lib/appVersion.ts`, `src/pages/PerfilPage.tsx`, `android/app/build.gradle` (versionCode +1).
- Verificação final via Playwright headless no Super Admin logado: abrir cada sub-aba do Financeiro, capturar screenshots e confirmar que os totais de "A Receber" (soma) batem com a soma de "Mensalidades" + comissão + entrega_fee + pdv_fee vindos da mesma RPC.

## Detalhes técnicos
**Arquivos alterados:**
- Novos: `src/lib/pagante.ts`, `src/components/plans/PlanBadge.tsx`, `src/components/plans/VipBadge.tsx`.
- Editados: `src/lib/plansInfo.ts`, `src/pages/SuperAdminDashboardV2.tsx`, `src/components/finance/MensalidadesPanel.tsx`, `src/components/AdminPlanManager.tsx`, `src/components/DeliveryFeeConfig.tsx`, `FinanceCenter.tsx`, `AReceberTab.tsx`, `HistoricoRepassesTab.tsx`, `StoreSubscription.tsx`, `SuperAdminDashboard.tsx` (FinanceTabFull), + arquivos de versão.
- Deletados: `src/components/PlanosTab.tsx`, `src/components/AdminFixedPlanReceivables.tsx`.

**Sem mudanças de banco nem de edge functions.**

## Fora do escopo
- Nenhuma alteração de RPC/schema/edge (já auditadas).
- Nenhum redesign visual — só correção de textos, agrupamento e badges.
- Configuração global de entrega e regras hardcoded (R$30 disparo, R$500 trava) permanecem.

Aprova para eu implementar Fases 2 e 3 direto?
