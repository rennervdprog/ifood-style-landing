# Alinhar "Meu Plano" e "Repasse" à configuração VIP real

## Diagnóstico das divergências atuais

**O que já respeita VIP (via `useStorePlan`):**
- `monthlyFee`, `commissionRate`, `pixOperationalFee` (override), `platformDeliverySplit` (override) — leem de `store_plans` da loja, portanto refletem o VIP.
- Hero da aba "Meu Plano" (mensalidade, taxa PIX, próxima cobrança) — OK.
- `PlatformSplitAlert` recebe `splitPerOrder` do `storePlan.platformDeliverySplit` — OK.

**O que NÃO respeita VIP (fonte errada — usa `plansInfo.ts` hardcoded):**

1. **`PlanFeeBreakdown`** (usado no topo da aba Meu Plano) — lê `PLANS[planId]` (`plansInfo.ts`), ignorando `monthly_fee`, `commission_rate`, `pix_operational_fee_override` da loja. Mostra 2,5% para Crescimento mesmo se o VIP zerou.
2. **StoreSubscription — bloco "Taxa de entrega: R$ 2,00 por pedido"** (linha 292) — texto hardcoded. Se o VIP alterou `platform_delivery_split_override` (ex.: 0 ou 1,50) o texto continua "R$ 2,00".
3. **StoreSubscription — bloco "Taxa por pedido PIX"** — mostra `plan.pixOperationalFee` corretamente, mas o subtítulo "só em pedidos pagos via PIX" não diz o valor real; e se VIP zerou PIX, ainda aparece o card.
4. **Painel de troca de plano** — usa `PLANS` para os bullets, o que é aceitável (são planos-alvo, não o atual), mas o resumo do "plano atual" abaixo mistura o nome bonito com valor VIP sem indicar personalização.
5. **CommissionAlert** — texto "comissão sobre produtos e taxa de entrega da plataforma" é genérico; para lojas VIP com `commission_rate=0` isso é enganoso (a pendência vem só de delivery/PDV).
6. **PlatformSplitAlert** — texto "Taxa de R$X por entrega" usa `splitPerOrder` correto ✓, MAS: "Cobrança automática a partir de R$30 toda segunda-feira" e "R$500 trava" são hardcoded; se admin mudar essas regras via VIP futuramente, ficam divergentes (baixa prioridade — regra global, não VIP por loja).
7. **RepasseSection header** — "Repasse da Plataforma" está OK, mas não indica se a loja tem condições VIP ativas.
8. **Nenhum lugar mostra "Você está em condição VIP personalizada"** — o lojista não sabe que os valores são diferentes do plano padrão, o que gera desconfiança quando vê o `plansInfo` em outro lugar.

## Mudanças

### 1. `PlanFeeBreakdown` passa a receber overrides reais

Trocar assinatura para aceitar `monthlyFee`, `commissionRate`, `pixFee` opcionais que sobrescrevem `PLANS[planId]`. `StoreSubscription` passa os valores de `useStorePlan`. Assim o exemplo "Pedido R$50 → você recebe R$X" reflete o VIP.

### 2. Bloco "Taxa de entrega" (StoreSubscription) usa valor real

- Ler `plan.platformDeliverySplit`.
- Se `== 0` → esconder o bloco (VIP sem taxa de plataforma).
- Se `> 0` → "Taxa de entrega: R$ X,XX por pedido" com o valor real.

### 3. Bloco "Taxa por pedido PIX" reflete VIP

- Se `plan.pixOperationalFee == 0` (VIP zerou) → mostrar "Grátis" e subtítulo "PIX sem taxa nesta loja".
- Senão → valor atual.

### 4. Selo "Condições VIP" quando houver override

Comparar valores da loja com defaults do `plan_templates` (mesma lógica que `AdminPlanManager` já usa em `isVip`). Quando houver diferença, exibir um badge discreto "Condições personalizadas" no hero e no bloco "Detalhes da cobrança", com tooltip "Sua loja tem valores negociados diferentes do plano padrão".

Fonte: expor uma flag `isVip` no `useStorePlan` (buscar `plan_templates` e comparar). Assim qualquer tela consome de uma única fonte.

### 5. CommissionAlert — texto contextual

- Se `plan.commissionRate == 0` e a pendência é só de delivery/PDV → título "Repasse Pendente — Taxa de Entrega/PDV" e remover menção a "comissão sobre produtos".
- Senão manter texto atual.

### 6. RepasseSection — mostrar composição real

Abaixo do subtítulo, exibir uma linha de contexto do plano ativo:
"Plano Essencial · Taxa entrega R$2,00 · PIX R$1,99" (com valores do `useStorePlan`, refletindo VIP). Se VIP zerou algo, mostra "Grátis" naquela parte.

### 7. Versão

Bump `1.11.93` → `1.11.94` em `src/pages/PerfilPage.tsx`, `src/lib/appVersion.ts` e `android/app/build.gradle` (versionCode 847 → 848).

## Detalhes técnicos

**Fonte única de VIP:** ampliar `useStorePlan` para retornar:
```
planTemplateDefaults: { monthly_fee, commission_rate, pix_fee, delivery_split, pdv_fixed }
isVip: boolean
vipDiffs: { fee?: {default, actual}, commission?: {...}, pix?: {...}, delivery?: {...} }
```
Buscando `plan_templates` por `plan_type` na mesma query. Todas as telas (Meu Plano, Repasse, Finance, Checkout) passam a consumir daqui — sem `PLANS[planType]` hardcoded para valores.

**Arquivos alterados:**
- `src/hooks/useStorePlan.ts` — adiciona query de `plan_templates`, expõe `isVip` + defaults + valores efetivos.
- `src/components/fees/PlanFeeBreakdown.tsx` — aceita props opcionais de override; usa quando presentes.
- `src/components/StoreSubscription.tsx` — passa overrides para `PlanFeeBreakdown`, mostra bloco de entrega condicional, badge "Condições personalizadas", subtítulo PIX correto.
- `src/components/CommissionAlert.tsx` — título/descrição condicional a `commissionRate`.
- `src/pages/admin/sections/RepasseSection.tsx` — linha de contexto do plano com valores reais.
- Bump de versão nos 3 arquivos.

**Sem mudanças de banco** — tudo é leitura de `store_plans` + `plan_templates` existentes.

## Fora do escopo

- Regras globais (R$30 de disparo automático, R$500 de trava, min_payout) permanecem hardcoded — não são VIP por loja.
- `plansInfo.ts` continua sendo fonte para telas públicas (landing, cadastro) — só as telas *do lojista logado* passam a usar `useStorePlan`.

Aprova para eu implementar?
