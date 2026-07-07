## Estratégia: A → B em duas fases separadas

Faz sentido separar porque os bugs de UI são visuais/sem risco financeiro, já os 2 e 3 mexem em dinheiro real (saldo devido de lojista). Misturar tudo num commit dificulta reverter se algo der errado na parte sensível.

---

### FASE A — Correções de UI (baixo risco, sem tocar em dinheiro)

**A1. `RecebidoNoMesCard` mostrar líquido**
- Trocar soma de `total_price` por `total_price - delivery_fee - platform_fee` (mesma fórmula da "Receita líquida estimada" logo abaixo).
- Renomear label para "Recebido líquido no mês" para casar com o valor.

**A4. Badge "Acumulando" com saldo 0**
- Em `PlatformFeeCycleBlock.tsx`, adicionar 4º estado `"zerado"` quando `pendente === 0` → label "Ciclo aberto", ícone neutro.
- "Acumulando" só aparece quando `0 < pendente < 30`.

**A5. Divergência 5×R$5 ≠ R$27**
- No bloco "Composição da Receita", quando `soma(delivery_fee dos pedidos) ≠ split_esperado`, mostrar linha extra "⚠ Ajuste/diferença: R$ X,XX" com tooltip explicando (pedido com taxa fora do padrão).
- Não altera cálculo, só torna visível a diferença.

**A6. Pedido com líquido negativo**
- Em `AdminOrderCard` (ou onde renderiza líquido do pedido), quando `liquido < 0`, envolver em badge vermelho com ícone de alerta e tooltip: "Este pedido está gerando prejuízo — considere valor mínimo."
- Adicionar aviso agregado no topo do Financeiro: "N pedidos com prejuízo este mês" se houver.
- (Sem bloquear criação — validação de valor mínimo fica pra fase futura, se o usuário quiser.)

**A7. `PlanSummaryCard` esconder taxa PIX por pedido**
- Adicionar linha "Taxa por pedido PIX: R$ 1,99" logo abaixo de "Taxa por entrega", lendo do mesmo `store_plans` (`pix_fee_per_order` ou campo equivalente — a confirmar na exploração).
- Se `commission_rate === 0` mas `pix_fee > 0`, ainda mostra o bloco de taxas em vez de esconder tudo.

---

### FASE B — Investigação de saldos zerados (alto risco, banco externo)

**Antes de qualquer mudança de código**, rodar diagnóstico read-only no banco externo (`qkjhguziuchqsbxzruea`) para a loja Pastelão Carioca:

1. **Consultas de auditoria** (via `scripts/audit-store-balances-external.sql` ou queries diretas):
   - `SELECT * FROM store_balances WHERE store_id = <pastelao>` — estado atual.
   - `SELECT id, status, amount, reference_code, metadata, created_at, settled_at FROM financial_transactions WHERE store_id = <pastelao> ORDER BY created_at DESC LIMIT 50` — ver as 3 "Falhou" e o que aconteceu.
   - `SELECT id, delivery_fee, total_price, status, created_at FROM orders WHERE store_id = <pastelao> AND status IN ('entregue','finalizado')` — somar splits reais.
   - `SELECT * FROM financial_audit_log WHERE entity_id IN (...) OR metadata->>'store_id' = <pastelao>` — rastrear quem debitou o quê.

2. **Reproduzir a origem dos R$0**. Hipóteses ordenadas por probabilidade:
   - **H1 — Split não está sendo lançado em `store_balances.repasse_pendente`** ao entregar pedido. Verificar trigger/edge `finalize-order` ou `driver-confirm-delivery`.
   - **H2 — `asaas-webhook` trata `PAYMENT_FAILED` como sucesso** ou não faz rollback ao receber `PAYMENT_REFUNDED`/`PAYMENT_OVERDUE`.
   - **H3 — `reconcile-payments` + `reconcile_debit_store_balance` debitam mesmo quando cobrança acaba falhando depois** (débito otimista sem estorno).

3. **Só depois do diagnóstico**, propor correções específicas com escopo mínimo:
   - Se H1: adicionar/consertar o INSERT em `store_balances`.
   - Se H2/H3: adicionar handler de FAILED que faz `UPDATE store_balances SET repasse_pendente = repasse_pendente + amount` e loga em `financial_audit_log` com `action='payment_failed_rollback'`.
   - Migration de correção retroativa para restaurar os R$25 + R$143 sumidos da Pastelão (com trilha de auditoria).

**Regra da Fase B**: cada mudança em código financeiro vem acompanhada de (a) query de "antes", (b) mudança, (c) query de "depois", tudo mostrado ao usuário para aprovação antes de aplicar em produção.

---

### Ordem sugerida
1. Aprovação deste plano.
2. Implementar A1–A7 (um commit único, versão bump).
3. Verificar visualmente no painel da Pastelão.
4. Abrir Fase B com o diagnóstico read-only e voltar com achados + plano de correção fino antes de tocar em edge functions.

### Fora de escopo (desta rodada)
- Unificação `useStoreDue` dos 3 cálculos paralelos (bug #6 do diagnóstico anterior).
- Consolidar "Extrato" + "Histórico Pago".
- Buscar threshold de bloqueio de `admin_settings` no `ValorAPagarCard`.
- Bloqueio hard de pedido com prejuízo (só aviso agora).

Esses ficam pra depois que a Fase B estiver estável.
