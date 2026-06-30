
# Plano: Financeiro do Super Admin — Clareza Total

Hoje a tela está confusa: misturamos "Comissão a Receber" (de pedido), "R$2/Entrega a Pagar", "Net Plataforma negativo", mensalidades e ainda mostramos ganhos de motoboys (que não nos pertencem). Vamos reorganizar para responder 3 perguntas objetivas:

1. **Quanto a plataforma tem a receber das lojas hoje?**
2. **Quanto já foi pago (histórico)?**
3. **Quem está devendo e há quanto tempo?**

---

## Fase 1 — Nova aba "A Receber" (substitui Comissões/Mensalidades soltas)

Card único no topo agregando TUDO que a plataforma tem a receber das lojas:

```text
┌─────────────────────────────────────────┐
│ 💰 TOTAL A RECEBER DAS LOJAS            │
│           R$ 1.247,00                   │
│                                         │
│ • Mensalidades pendentes:  R$ 1.080,00  │
│ • Taxa R$2/entrega:        R$    96,00  │
│ • Comissão sobre pedidos:  R$    65,00  │
│ • PDV (R$1/venda):         R$     6,00  │
└─────────────────────────────────────────┘
```

Abaixo, lista por loja (ordenada pelo maior devedor) mostrando:
- Nome da loja + plano
- Quanto deve, separado por tipo
- Dias em atraso (se mensalidade vencida)
- Botão **"Marcar como Pago"** → registra em `payout_history` e zera o pendente
- Botão **"Cobrar via WhatsApp"** (abre mensagem pronta)

Remove o card vermelho "Net Plataforma -R$6,00" — era confuso (sinal invertido).

## Fase 2 — Aba "Histórico de Repasses Pagos"

Nova aba lateral mostrando **tudo que a plataforma já recebeu**:
- Data | Loja | Tipo (mensalidade/comissão/entrega) | Valor | Método (PIX/dinheiro/Asaas)
- Filtros por período (hoje, 7d, 30d, custom) e por loja
- Total recebido no período em destaque no topo
- Exportar CSV

Fonte de dados: tabela `payout_history` (já existe) + ampliar para registrar mensalidades pagas.

## Fase 3 — Remover aba "Entregadores" do Financeiro

Confirmado: o pagamento ao motoboy é feito **pela loja** (lojista define o valor e paga direto). A plataforma NÃO intermedia esse dinheiro, então mostrar "Pendente R$ 1.700" de motoboy no painel da plataforma é enganoso (parece que devemos algo).

Ação: **remover totalmente a aba Entregadores** do Financeiro do Super Admin. Esses dados continuam disponíveis para a LOJA no painel dela (que é quem realmente paga).

## Fase 4 — Reorganizar abas do Financeiro

Antes (6+ abas confusas): Pagamentos · Mensalidades · Comissões · Entregadores · Subcontas · Lojas...

Depois (3 abas claras):

```text
┌──────────────┬──────────────┬──────────────┐
│ 💰 A Receber │ ✅ Histórico │ 🏦 Subcontas │
│              │   (pagos)    │   (Asaas)    │
└──────────────┴──────────────┴──────────────┘
```

## Fase 5 — Detalhes técnicos (Supabase EXTERNO)

- Criar view `v_platform_receivables` agregando: `store_plans.monthly_fee` (vencidos) + `store_balances.comissao_pendente` + saldo de `R$2/entrega` + `pdv_commission_pending`.
- Ampliar `payout_history` para incluir `kind` ('mensalidade' | 'comissao' | 'entrega_fee' | 'pdv_fee') e `paid_at`.
- RPC `admin_mark_receivable_paid(store_id, kind, amount)` que insere em `payout_history` e debita do `store_balances`.
- Tudo via `ext-sql-runner` no Supabase externo (não usamos Lovable Cloud).

## Fase 6 — Arquivos a tocar

- `src/pages/super-admin/tabs/PagamentosSplitTab.tsx` — substituir conteúdo das abas.
- Criar `src/pages/super-admin/tabs/AReceberTab.tsx` (Fase 1).
- Criar `src/pages/super-admin/tabs/HistoricoRepassesTab.tsx` (Fase 2).
- Remover/ocultar a aba "Entregadores" (Fase 3).
- Migração SQL no externo: view + colunas em `payout_history` + RPC.

---

## Resultado final

Em 5 segundos o super admin sabe:
✅ Quanto tem a receber hoje (1 número grande)
✅ De quem (lista ordenada por maior devedor)
✅ Quanto já recebeu este mês (aba Histórico)
✅ Sem ruído de motoboy (não é problema nosso)

Aprovando, começo pela Fase 5 (SQL no externo) e depois Fases 1-4 em sequência.
