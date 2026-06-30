
# Plano: alinhamento financeiro Lojista ↔ Super Admin

## Diagnóstico (banco externo `qkjhguziuchqsbxzruea`)

Consultei agora e confirmei:

- **`store_balances`** do Cantinho da Silvia tem `repasse_pendente = R$ 6,00` corretamente salvo.
- A aba "A Receber" do Super Admin mostra zero porque **a tabela `user_roles` não tem NENHUMA linha com role `admin`**. A política RLS de `store_balances` exige `is_platform_admin(auth.uid())` (que checa `role = 'admin'`) — sem essa linha, a query do super admin retorna 0 linhas.
- `payout_history` está vazia, então "Histórico Pago" também fica em branco — esperado, mas precisa ficar claro.
- Lojista lê o próprio balanço via outra policy ("Store owners can read own balance") — por isso o card do lojista mostra os R$ 6, mas o super admin não.

Ou seja: **os dois lados leem a MESMA tabela, só que o super admin está sendo bloqueado por RLS**. Plano abaixo resolve isso e blinda as 4 fontes financeiras para sempre baterem.

## Fontes de verdade (vamos travar em uma única tabela cada)

```text
Fonte                       Tabela / Coluna no externo
--------------------------- -------------------------------------------
Taxa R$2/entrega acumulada  store_balances.repasse_pendente
Comissão % acumulada        store_balances.comissao_pendente
Taxa PDV R$1/venda          store_plans.pdv_commission_pending
Mensalidade vigente         store_plans.monthly_fee + next_billing_date
Pagamentos já feitos        payout_history (com coluna `kind`)
```

Lojista e Super Admin vão ler EXATAMENTE essas colunas. Nada de cálculo duplicado.

## Fase 1 — Corrigir RLS / role do super admin (banco externo)

1. Promover o(s) usuário(s) super admin a `role = 'admin'` em `user_roles` (idempotente: ON CONFLICT DO NOTHING). Vou listar os candidatos (`profiles.is_super_admin = true` ou e‑mail do dono) e inserir.
2. Conferir que `is_platform_admin` está retornando true via `SELECT is_platform_admin('<uid>')`.
3. Reexecutar a query do AReceberTab via Management API para validar que volta com os R$ 6 do Cantinho da Silvia antes de mexer no frontend.

## Fase 2 — Garantir que toda taxa R$2 e comissão caiam em `store_balances`

Auditoria das triggers que alimentam `store_balances`:

- `trg_accrue_delivery_fee` (R$2 por entrega da loja) — checar se dispara em TODA loja com `delivery_mode='own'`, não só plano fixo.
- `trg_accrue_commission_on_paid` — checar se grava `comissao_pendente` sempre que `commission_rate > 0`.
- `trg_accrue_pdv_fixed_fee` — confirmar `pdv_commission_pending` por venda PDV.

Se alguma trigger estiver com filtro incorreto, corrijo via migration (sem apagar dados). Backfill por SQL onde necessário.

## Fase 3 — Lojista usa a MESMA fonte

`ValorAPagarCard.tsx` hoje já lê `store_balances` + `store_plans`. Vou:

- Remover qualquer cálculo paralelo (somar pedidos manualmente) e usar SÓ as colunas oficiais.
- Adicionar legenda mostrando "Atualizado em <updated_at de store_balances>" — assim lojista e admin veem o mesmo timestamp e nunca discordam.

## Fase 4 — Super Admin "A Receber" robusto

`AReceberTab.tsx`:

- Migrar a query agregada para uma **VIEW** `v_platform_receivables` no externo, com `security_invoker=off` + SECURITY DEFINER função, retornando uma linha por loja com `mensalidade`, `comissao`, `entrega_fee`, `pdv_fee`, `total`, `phone`. Assim a leitura não depende de RLS de 3 tabelas distintas.
- O botão "Marcar como pago" continua gravando em `payout_history` (com `kind`) e zerando a coluna correspondente — isso já está implementado, só precisa funcionar agora que a leitura voltou.

## Fase 5 — Histórico amarrado

`HistoricoRepassesTab.tsx` e o histórico do lojista vão ler a MESMA `payout_history` filtrando por `entity_id = store_id`. Assim quando admin marca pago, o lojista vê na hora.

## Fase 6 — Verificação E2E

1. Login como super admin → ver R$ 6,00 do Cantinho.
2. Clicar "Pago" na linha de entrega.
3. Login como lojista (Cantinho) → card "Valor a pagar" deve zerar e "Histórico Pago" deve mostrar a linha.
4. Bump versão `1.10.363` (`versionCode` 690), atualizar `src/lib/appVersion.ts` e `android/app/build.gradle`.

## Detalhes técnicos

- Migrations só no banco EXTERNO via `supabase--migration` (não Lovable Cloud).
- Sem mexer em `src/integrations/supabase/client.ts` nem `.env`.
- Sem alterar fluxo de cobrança, Asaas ou regra dos planos — só corrigindo leitura e fechando furo de RLS.
- Risco baixo: nenhuma coluna é removida; alterações são GRANT/POLICY/VIEW + backfill.

## Fora de escopo

- Não vou redesenhar o painel financeiro de novo.
- Não vou trocar provedor de pagamento.
- Não vou criar cobrança automática de mensalidade (continua manual via PIX).
