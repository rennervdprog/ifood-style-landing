
# Autonomia Dinâmica — grátis até R$2.500 GMV

Reaproveitar a máquina do Essencial (agendamento + aviso prévio + aceite/recusa + VIP) e generalizar para o Autonomia. Caminho **rápido e seguro**: mesmas colunas `essencial_upgrade_*` já existentes, cron único cobre os dois planos, threshold e fee-alvo por plano.

## Regras de negócio

- **Autonomia entra grátis:** `monthly_fee = 0` no cadastro.
- **Gatilho:** GMV (pedidos `entregue`/`finalizado`) ≥ **R$ 2.500** em 60 dias.
- **Aviso prévio:** 30 dias, exatamente como o Essencial.
- **Aceite/Recusa** pelo lojista no painel (mesmo componente).
- **Após aceite + prazo:** `monthly_fee` sobe para **R$ 329,90**.
- **VIP `essencial_lifetime_free`** continua bloqueando upgrade (renomear label na UI para "Vitalício grátis").
- **Overrides VIP** (PIX/entrega/comissão custom) também isentam — regra já existe, só estender pra autonomy.

## Mudanças

### 1. Cron `check-essencial-upgrade` → cobrir autonomy
- Query passa a filtrar `plan_type IN ('fixed','autonomy')` + `monthly_fee = 0` + `is_active`.
- Tabela de config por plano dentro do código:
  ```
  fixed    → threshold 5000, target_fee 180
  autonomy → threshold 2500, target_fee 329.90
  ```
- Mensagens WhatsApp já parametrizadas por `store.name` e `UPGRADE_FEE` — só passar dinâmico.
- Sem mudança de schema.

### 2. `register_as_lojista` (RPC no Supabase externo)
- No branch `autonomy`, criar `store_plans` com `monthly_fee = 0` (hoje cria com 329,90).
- Manter demais campos (commission 0, pix_operational_fee 1,99, platform_delivery_split_override 0, pdv fixo R$1).

### 3. `src/lib/plansInfo.ts` — Autonomia
- `tagline`: "Grátis pra começar — R$ 0/mês. Vira R$ 329,90/mês quando faturar R$ 2.500"
- `monthlyFee: 0`
- `badge`: "🎁 Grátis pra começar"
- `features`: adicionar "R$ 0/mês até atingir R$ 2.500 em vendas" e "Sobe pra R$ 329,90/mês após o gatilho"

### 4. UI do progresso (lojista)
- Renomear `EssencialProgressCard` → `PlanUpgradeProgressCard` genérico recebendo `{ threshold, targetFee, planName }`.
- Detectar plano ativo e escolher threshold automaticamente.
- Reaproveita 100% do fluxo Aceitar/Recusar já existente.

### 5. Textos legais (`TermosDeUso.tsx`)
- Adicionar cláusula do gatilho R$ 2.500 pro Autonomia (espelho da cláusula do Essencial R$ 5.000), incluindo 30 dias de aviso prévio e direito de recusa.

### 6. Test store creator (Super Admin)
- Nada a fazer — já cria Autonomia; só refletirá o novo `monthly_fee = 0` inicial.

### 7. Testes Deno (`register-lojista-plans.test.ts`)
- Ajustar `SPECS.autonomy.monthlyFee` para `0`.

## Fora de escopo (não mexer)

- Colunas novas no banco (usa as existentes).
- Fluxo do PDV-only.
- Comissão / PIX / split — permanecem iguais.
- Lojas Autonomia **já ativas com R$ 329,90** — não rebaixar automaticamente. Se quiser oferecer retroativo, faço em migração manual separada só nas que você indicar.

## Riscos

- Lojas Autonomia existentes continuam pagando R$ 329,90 (correto — não é rebaixamento automático). Confirmar se você quer alguma exceção manual.
- Cron único aumenta escopo do log — nada crítico, só mais entradas em `admin_logs`.

## Entrega

Uma versão só (patch), com bump automático de versão e revisão de segurança no fim.
