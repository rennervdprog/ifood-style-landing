
# Plano — Fonte da verdade única dos planos dinâmicos

Objetivo: fazer o Super Admin ser o **único lugar** que decide preço, threshold e taxa da plataforma. Hoje esses valores estão hardcoded em 3 pontos do código, o que causou toda a divergência que auditamos.

## Fonte da verdade acordada

| Item | Valor | Onde vive hoje |
|---|---|---|
| Taxa plataforma | R$ 0,99 | ✅ `admin_settings.delivery_fee_config.platform_split` |
| Essencial | Grátis até R$ 5.000 → R$ 89,90 + taxa | ❌ `plan_templates` diz R$ 180; cron hardcoded |
| Autonomia | Grátis até R$ 2.500 → R$ 199,90 sem taxa | ❌ `plan_templates` diz R$ 229,90; cron hardcoded |
| PDV Only | R$ 69,00 | ❌ template não existe |
| VIP | `essencial_lifetime_free` / `autonomy_lifetime_free` | ✅ funciona |

## Fase 1 — Banco (oneshot no Supabase externo)

Uma edge function `oneshot-plans-source-of-truth`:

1. `ALTER TABLE plan_templates ADD COLUMN IF NOT EXISTS revenue_threshold NUMERIC DEFAULT 0`
2. `ALTER TABLE plan_templates ADD COLUMN IF NOT EXISTS platform_fee_included BOOLEAN DEFAULT true`
3. UPDATE Essencial → `monthly_fee=89.90, revenue_threshold=5000, platform_fee_included=true, description='Grátis até R$ 5.000/mês em vendas. Após, R$ 89,90/mês + R$ 0,99 por entrega.'`
4. UPDATE Autonomia → `monthly_fee=199.90, revenue_threshold=2500, platform_fee_included=false, description='Grátis até R$ 2.500/mês em vendas. Após, R$ 199,90/mês sem taxa da plataforma. Apenas PIX online: R$ 1,99/pedido.'`
5. INSERT `pdv_only` → R$ 69,00, threshold 0, sem taxa.
6. `UPDATE plan_templates SET is_active=false WHERE plan_key IN ('hybrid','supporter')` (legados, sem novos cadastros).
7. Adicionar RPC `admin_update_plan_template(p_id uuid, p_monthly_fee numeric, p_revenue_threshold numeric, p_commission_rate numeric, p_description text)` — SECURITY DEFINER + `has_role(auth.uid(),'admin')`.

## Fase 2 — Refatorar código para ler do banco

**`check-essencial-upgrade/index.ts`** (L21-22):
Remover objeto hardcoded. No início da função, carregar de `plan_templates`:
```ts
const { data: tpls } = await sb.from("plan_templates")
  .select("plan_key, monthly_fee, revenue_threshold")
  .in("plan_key", ["fixed","autonomy"]);
const PLAN_CONFIG = {
  fixed:    { threshold: tpls.find(t=>t.plan_key==="fixed").revenue_threshold,    upgradeFee: tpls.find(t=>t.plan_key==="fixed").monthly_fee },
  autonomy: { threshold: tpls.find(t=>t.plan_key==="autonomy").revenue_threshold, upgradeFee: tpls.find(t=>t.plan_key==="autonomy").monthly_fee },
};
```

**`respond-essencial-upgrade/index.ts`** (L69):
```ts
const { data: tpl } = await sb.from("plan_templates")
  .select("monthly_fee")
  .eq("plan_key", plan.plan_type === "autonomy" ? "autonomy" : "fixed").single();
const monthlyFee = Number(tpl.monthly_fee);
```

**`AdminPlanManager.tsx`**: remover `FALLBACK_DEFAULTS`, usar novo hook `usePlanTemplates()` (React Query, staleTime 5min, lê `plan_templates` via anon client). Formulário chama `admin_update_plan_template`.

**`plansInfo.ts`**: adicionar `getPlanConfig(planKey)` que consulta cache do hook e cai em fallback estático quando offline.

## Fase 3 — UI consome fonte única

Substituir constantes hardcoded em:
- `StoreDirectory.tsx` (L63/L116/L735 — regra do gatilho dinâmico)
- `EssencialProgressCard.tsx` (L15 R$ 239,90)
- `PlansComparisonTable.tsx` (L15 R$ 180 e L17 R$ 239,90)
- `PlanSummaryCard.tsx` / `RepasseSection.tsx` (labels)

Todos passam a chamar `usePlanTemplates()`. Adicionar coluna PDV Only na `PlansComparisonTable`.

## Fase 4 — E2E real do ciclo dinâmico

Novo `e2e/07-plano-dinamico-upgrade.spec.ts` cobrindo Essencial **e** Autonomia:

```text
Para cada plano (fixed=5000, autonomy=2500):
  1. Reset store de teste (essencial_upgrade_scheduled_at=null, revenue=0)
  2. oneshot-simulate-essencial injeta GMV > threshold
  3. Chama check-essencial-upgrade
  4. Assert: essencial_upgrade_scheduled_at != null no banco
  5. Login lojista → assert banner "atingiu o limite" visível
  6. Clica "Aceitar cobrança"
  7. Assert: monthly_fee = valor do template (não valor hardcoded)
  8. Assert: essencial_upgrade_response = 'accepted'
Cenário VIP: mesma loja com lifetime_free=true, atinge threshold, cron NÃO agenda upgrade.
```

Também um teste unitário Vitest garantindo que se `plan_templates.monthly_fee` for editado para R$ 99,90, `respond-essencial-upgrade` grava 99,90 (não 89,90).

## Fase 5 — Validação e release

- `tsgo` typecheck.
- Rodar spec novo + `routing-source-of-truth.spec.ts`.
- Auditar via `oneshot-audit-plans-external` que `plan_templates` bate com fonte da verdade.
- Bump para **v1.25.32** (`appVersion.ts`, `build.gradle` versionName + versionCode).

## Detalhes técnicos

- Nenhuma alteração no fluxo do `monthly-billing` (já lê template corretamente).
- `admin_settings.delivery_fee_config.platform_split` já vale 0.99 — não mexer.
- Legados `hybrid`/`supporter` ficam `is_active=false` mas não são deletados (histórico de `store_plans` referencia).
- Aceite expresso continua funcionando como está — só ganha a leitura dinâmica do preço.
- VIP (`*_lifetime_free`) já tem prioridade no cron, não precisa mudar.

## O que este plano NÃO faz

- Não muda a UX do banner de aceite (mantém texto e botões atuais).
- Não mexe em cobrança de PIX operacional (R$ 1,99) nem em Asaas.
- Não altera o cron `monthly-plan-upgrade-check` (só o `check-essencial-upgrade-daily`).
- Não migra lojas legadas para os novos planos automaticamente.
