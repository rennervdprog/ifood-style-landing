# Plano — Reestruturação dos Planos ItaSuper

Alterações no banco EXTERNO (`plan_templates` + funções) e em toda a UI que exibe preço/regras dos planos. **Taxa de R$ 2 na entrega mantida.** Sem alteração de código de split/repasse.

## Resumo do novo catálogo

| Plano | Preço | Comissão | Taxa entrega plataforma | Observação |
|---|---|---|---|---|
| ~~Comissão~~ | — | — | — | **Removido** (oculto p/ novos; lojas atuais mantidas como legado) |
| **Essencial** | **R$ 0/mês** por 2 meses → **R$ 180/mês** após atingir R$ 5.000 GMV | 0% | + R$ 2 | Captação — vira pago quando fatura |
| **Autonomia** | **R$ 329,90/mês** | 0% | **R$ 0** | Sem taxa de entrega da plataforma |
| **Somente PDV** | R$ 69/mês | — | — | Sem alterações |

Taxa PIX (R$ 1,99) e módulo PDV opcional (R$ 49/mês) permanecem iguais.

## 1. Banco (Supabase externo `qkjhguziuchqsbxzruea`)

Aplicado via `ext-sql-runner` (sem SQL manual pra você).

- `plan_templates`
  - `commission_only` → `is_active = false`.
  - `fixed` (Essencial): `monthly_fee = 0`, `features` reescritas ("Grátis nos 2 primeiros meses / R$ 180 após atingir R$ 5.000").
  - `autonomy`: `monthly_fee = 329.90`, `description` e `features` ajustadas.
  - `pdv_only`: intocado.
- `stores` / `store_plans`: garantir que o campo de gatilho de upgrade já existente (`plan_promo_ends_at` ou `revenue_threshold` do template) suporta "R$ 0 inicial". Se faltar, adicionar coluna `essencial_upgrade_at timestamptz`.
- Job diário (edge function `check-essencial-upgrade` — nova, curta): quando loja Essencial acumular R$ 5.000 GMV em 60 dias, seta `monthly_fee_effective = 180` e agenda cobrança Asaas do próximo ciclo.
- 22 lojas hoje em `commission_only`: **manter como legado** (não migrar automaticamente) até você decidir. Só ficam ocultas na UI de escolha.

## 2. Telas afetadas — Frontend

### Fonte única
- `src/lib/plansInfo.ts` — atualizar `fixed` (R$ 0, novo tagline/features), `autonomy` (R$ 329,90), marcar `commission_only` como desativado, remover de `PLANS_ORDER`. `DELIVERY_FEE_NOTE` mantém R$ 2.

### Público / marketing
- `src/pages/StoreDirectory.tsx` (landing).
- `src/pages/PlanosPage.tsx` (página de planos).
- `src/pages/CadastroLojista.tsx` (seleção no signup).
- `src/pages/LandingPage.tsx`, `src/pages/Index.tsx`, `src/pages/VagaPromoPage.tsx`, `src/pages/PartnerOnboarding.tsx` — qualquer preço citado.
- `src/pages/TermosDeUso.tsx` + `src/pages/PoliticaPrivacidade.tsx` — cláusulas de valores.

### Lojista (logado)
- `src/components/StoreSubscription.tsx` — aba "Meu Plano".
- `src/components/finance/PlanSummaryCard.tsx`, `PlanFeeBreakdown.tsx`, `ComoFuncionaCobranca.tsx`, `MensalidadesPanel.tsx`, `RecebidoNoMesCard.tsx`, `ValorAPagarCard.tsx`.
- `src/components/TrialProgressCard.tsx` + `TrialExpiredGuard.tsx` + `CommissionAlert.tsx` — reescrever pra "período promocional R$ 0" e mostrar meta de R$ 5.000 pro upgrade.
- `src/pages/admin/sections/RepasseSection.tsx`.

### Super Admin
- `src/components/PlanosTab.tsx` (aba Planos > Lojas).
- `src/components/AdminPlanTemplatesEditor.tsx` (editor de templates).
- `src/components/AdminPlanManager.tsx`, `AdminFixedPlanReceivables.tsx`, `FixedPlanBillingHistory.tsx`.
- `src/components/TestStoreCreator.tsx` — remover opção `commission_only`.
- `src/pages/super-admin/tabs/AReceberTab.tsx`, `HistoricoRepassesTab.tsx`.
- `src/pages/SuperAdminDashboardV2.tsx` — cards de distribuição de planos.

### Edge functions
- `monthly-billing` — pular cobrança de lojas Essencial com `monthly_fee = 0`.
- `subscribe-plan-payment` — refletir os novos valores.
- **Novo** `check-essencial-upgrade` — cron diário que verifica gatilho de R$ 5.000.
- `supabase/functions/_tests/register-lojista-plans.test.ts` — atualizar SPEC do `fixed` para `monthlyFee: 0` e do `autonomy` para `229.9 → 329.9`.

## 3. Ordem de execução

1. `plansInfo.ts` + `plan_templates` no externo (fonte de verdade primeiro).
2. Telas públicas (landing → PlanosPage → CadastroLojista → Termos/Política).
3. Telas do lojista (StoreSubscription + finance components + TrialProgressCard).
4. Super Admin (PlanosTab + Editor + TestStoreCreator + tabs).
5. Edge functions (`monthly-billing`, `subscribe-plan-payment`, novo cron de upgrade).
6. Atualizar testes `register-lojista-plans.test.ts`.
7. Bump de versão + sugerir comunicado às lojas legado `commission_only`.

## Riscos & notas

- Zerar Essencial derruba ~R$ 630/mês de mensalidade fixa atual (7 lojas). Compensado quando o volume ultrapassar R$ 5.000 e o upgrade automático disparar.
- Autonomia sobe de R$ 229,90 → R$ 329,90 (+43%). Como não há loja ativa nesse plano hoje, impacto imediato zero — só afeta novos cadastros.
- Taxa R$ 2 na entrega mantida em Essencial (e legado Comissão) — nossa receita variável fica intacta enquanto Essencial está grátis.

Confirma pra eu começar pela etapa 1?
