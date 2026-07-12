# Proração + Crédito de Cancelamento

Objetivo: alinhar a cobrança ao que o Termo de Uso promete (proporcional na ativação e crédito no cancelamento), sem alterar o fluxo mensal atual de lojas que não têm add-on / não cancelaram nada.

## Escopo
- Add-ons pagos (`store_addons`, hoje: PDV R$ 49/mês).
- Plano `pdv_only` (R$ 69/mês).
- **Não** mexe em: planos com delivery (fixed/hybrid/commission/supporter), comissão PDV pendente, webhook Asaas, cron atual, split, repasses.

## Regras de negócio
1. **Proração na 1ª fatura após ativação**
   - Base: `preço_mensal × (dias_restantes_no_mês_civil / dias_do_mês)`.
   - Aplica só à **primeira** fatura após `activated_at`. Depois volta ao valor cheio.
   - VIP grátis (override 0) continua não cobrando.

2. **Crédito no cancelamento**
   - Quando lojista/admin cancela no meio de um ciclo já pago:
     `crédito = preço_pago × (dias_não_usados / dias_do_ciclo)`.
   - Crédito é acumulado em `store_plans.billing_credit_cents` (novo).
   - Na próxima fatura, `monthly-billing` subtrai o crédito do `totalAmount` (piso em 0) e zera o campo.
   - Se `totalAmount` ficar 0 após crédito, nenhuma cobrança Asaas é gerada (fatura pulada) e o crédito residual permanece.

## Mudanças técnicas

### Banco (migração aditiva no Supabase externo, via oneshot)
- `store_addons`: já tem `activated_at`. Adicionar `first_charge_done boolean default false`.
- `store_plans`:
  - `billing_credit_cents integer default 0 not null`
  - `pdv_only_activated_at timestamptz` (proração do plano `pdv_only`)
  - `pdv_only_first_charge_done boolean default false`

### `supabase/functions/manage-store-addon/index.ts`
- Ao ativar: setar `activated_at = now()`, `first_charge_done = false`.
- Ao cancelar imediato (não `cancels_at` futuro) dentro do ciclo pago: calcular crédito e somar em `store_plans.billing_credit_cents`.
- Ao reativar após cancelamento: nova `activated_at`, nova proração.

### `supabase/functions/monthly-billing/index.ts`
- Para cada add-on ativo:
  - Se `!first_charge_done`: usar valor prorrateado; marcar `first_charge_done = true` após criar a cobrança Asaas com sucesso.
  - Senão: valor cheio (comportamento atual).
- Mesmo tratamento para plano `pdv_only` via `pdv_only_activated_at` / `pdv_only_first_charge_done`.
- Antes de chamar Asaas: `totalAmount = max(0, totalAmount - billing_credit_cents/100)`.
  - Se `> 0`: gera cobrança e zera `billing_credit_cents`.
  - Se `== 0`: registra `financial_transactions` como `paid`/`credit_applied` (R$ 0), zera crédito consumido, não cria cobrança Asaas.
- Descrição da fatura ganha linha `(proporcional X dias)` e `(- crédito R$ Y,YY)` quando aplicável.

### UI
- `AdminStoreAddonsPanel.tsx` (super admin): mostrar `activated_at`, próxima cobrança prevista (cheia ou proporcional) e crédito acumulado da loja.
- `SubscriptionTab.tsx` (lojista): pequena nota "Primeira cobrança proporcional aos dias restantes do mês" quando `!first_charge_done`; mostrar crédito disponível se `> 0`.

## Segurança
- Coluna `billing_credit_cents` só é escrita por edge functions com service role (nunca pelo cliente).
- Cancelamento por lojista continua passando por `manage-store-addon` (já valida ownership).
- Sem SQL dinâmico; tudo parametrizado.

## Rollback
- Reverter é seguro: colunas novas são opcionais com default. Se `monthly-billing` voltar à versão anterior, ignora as colunas e cobra valor cheio como hoje.

## Versão
Bump para v1.14.7 (build 942) ao final.
