## Objetivo
Fechar os pontos que ainda mostram texto de plano cru ("Assinatura + Taxa", "Fixo/Comissão", `plan_type` em uppercase) e usar os componentes/helpers já padronizados (`PlanBadge`, `plansInfo`).

## Alterações

1. **`src/pages/SuperAdminDashboardV2.tsx`** (linha ~653)
   - Substituir o texto hardcoded "Assinatura + Taxa" pelo `<PlanBadge planType={...} />` (mesma correção já aplicada na versão legacy do dashboard).

2. **`src/components/finance/ComissoesPanel.tsx`** (linha ~125)
   - Trocar o ternário "Fixo/Comissão" pelo `<PlanBadge />` ou pelo label vindo de `plansInfo`, mantendo o comportamento visual da coluna.

3. **`src/pages/super-admin/MatrizDashboard.tsx`** (linha ~308)
   - Renderizar `plan_type` via `<PlanBadge />` em vez de string uppercase crua.

4. **`src/components/PartnerSplitPanel.tsx` e `src/components/PlanSummaryCard.tsx`**
   - Remover os mapas locais de nomes de plano e consumir `plansInfo` (fonte única), evitando divergência futura.

5. **Versão**
   - Incrementar patch em `src/lib/appVersion.ts` e `android/app/build.gradle` (versionName + versionCode).

## Fora de escopo
- Nenhuma mudança de lógica de negócio, cálculo de mensalidade/comissão ou schema.
- Sem alterações de RLS/backend.

## Verificação
- `rg` final por strings antigas ("Assinatura + Taxa", "Fixo", `plan_type` cru em JSX) para confirmar que sobrou zero ocorrência fora dos helpers centrais.
