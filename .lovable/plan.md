
# Painel do Lojista — Plano de Clareza Financeira (não-destrutivo)

## Diagnóstico atual

Hoje o grupo **Financeiro** tem 3 sub-abas (Resumo, Relatórios, Meu Plano) e dentro de "Resumo" existe um `FinanceCenter` com mais 4 abas internas (Resumo, Saldo Asaas, Extrato, Repasses) + `PlatformFeeCycleBlock` + `StoreFinancePanel` (1.357 linhas). Resultado: o lojista não consegue responder em 3 segundos as 3 perguntas que importam:

1. **Quanto eu devo à plataforma agora?**
2. **Quando vence e como pago?**
3. **Quanto eu já paguei?**

A informação existe (`store_plans.monthly_fee`, `next_billing_date`, `store_balances.repasse_pendente/comissao_pendente`, `pdv_commission_pending`, `payout_history`), só está espalhada.

Os **Relatórios** hoje reusam o mesmo painel de finanças, sem visão operacional (ticket médio, top produtos, horários de pico, taxa de cancelamento).

## Objetivos

- Sem quebrar nenhuma rota, hook ou edge function existente.
- Reorganizar **apenas o frontend** do grupo Financeiro e Relatórios.
- Mostrar o **plano contratado** com valores reais (mensalidade, % comissão, R$ por entrega, taxa PDV) em destaque.
- Centralizar **"O que eu devo agora"** num único card com botão **"Pagar via PIX"** e **"Ver histórico"**.
- Separar **Relatórios** (operacional) de **Financeiro** (a pagar/recebido).

## Nova arquitetura do grupo Financeiro

```text
Financeiro
├── Resumo         ← NOVO: 3 cards (Plano, A Pagar, Recebido no mês)
├── A Pagar        ← NOVO: detalha mensalidade + R$2/entrega + comissão + PDV, botão "Pagar PIX"
├── Recebimentos   ← renomeia "Saldo Asaas" + Extrato (PIX recebidos dos clientes)
├── Histórico      ← payout_history (o que já paguei à plataforma) + extrato Asaas
└── Meu Plano      ← mantém StoreSubscription, com card destacando valores do plano
```

E **Relatórios** sai do grupo Financeiro e vira grupo próprio com foco operacional:

```text
Relatórios
├── Vendas         ← gráfico diário, ticket médio, comparativo semana anterior
├── Produtos       ← top 10, mais cancelados, mais avaliados
├── Horários       ← pico por hora/dia, tempo médio de preparo
└── Clientes       ← novos x recorrentes, frequência, LTV (reaproveita ClientsTab)
```

## Componentes a criar (frontend puro)

1. `src/components/finance/PlanSummaryCard.tsx` — lê `store_plans` e mostra plano, mensalidade, % comissão, R$/entrega, taxa PDV, próximo vencimento. Reaproveita query existente.
2. `src/components/finance/ValorAPagarCard.tsx` — soma `store_balances.repasse_pendente + comissao_pendente + store_plans.pdv_commission_pending + (mensalidade se vencida)`, mostra breakdown linha a linha, botão **"Pagar via PIX"** (reusa o fluxo PIX já existente em `StoreFinancePanel`).
3. `src/components/finance/RecebidoNoMesCard.tsx` — total de vendas pagas no mês corrente (já calculado em `StoreFinancePanel`, só extraímos o número).
4. `src/components/finance/ComoFuncionaCobranca.tsx` — bloco explicativo fixo: "Você está no plano X. A cada entrega da plataforma cobramos Y. A mensalidade Z vence dia W. Acumulando R$500 a loja é bloqueada."
5. `src/pages/admin/tabs/finance/ResumoTab.tsx`, `AReceberTab.tsx`, `RecebimentosTab.tsx`, `HistoricoTab.tsx` — orquestram os cards acima.
6. `src/pages/admin/tabs/reports/VendasTab.tsx`, `ProdutosTab.tsx`, `HorariosTab.tsx` — extraem gráficos já existentes em `StoreFinancePanel` e `FinanceCharts.tsx` sem duplicar lógica (importam dos hooks que já temos).

## Mudanças em arquivos existentes

- `src/pages/admin/constants.ts`: novo grupo `relatorios` separado de `financeiro`; sub-abas atualizadas conforme acima. Mantém as chaves antigas (`finance`, `reports`, `subscription`) como aliases para não quebrar deep-links.
- `src/components/FinanceCenter.tsx`: vira shell fino que decide qual sub-aba renderizar. `StoreFinancePanel` e `StoreFinanceBasic` continuam intactos — só passam a ser usados internamente pelas novas abas.
- `src/pages/AdminDashboardV2.tsx`: troca apenas o roteamento das subTabs (`reports` → novo `ReportsVendas`, etc.). Nenhuma lógica de pedidos/PDV é tocada.

## O que NÃO será alterado

- Banco de dados externo: **zero migrações**. Tudo já existe.
- Edge functions, RLS, triggers de cobrança (`trg_accrue_pdv_fixed_fee`, `client_confirm_delivery`).
- Fluxo PIX (`StoreFinancePanel` continua sendo a fonte da verdade do botão pagar).
- `StoreSubscription` (Meu Plano) — só ganha o `PlanSummaryCard` no topo.

## Segurança

- Apenas leitura de tabelas já permitidas pelas RLS atuais (`stores`, `store_plans`, `store_balances`, `payout_history`, `orders`).
- Nenhum novo endpoint, nenhuma elevação de privilégio.
- Cobrança continua disparada pelos triggers do banco — UI só **exibe** valores.

## Versionamento

Bump para **v1.10.360** em `src/lib/appVersion.ts` e `android/app/build.gradle` (`versionCode 689`).

## Entrega faseada (cada fase é um deploy seguro)

| Fase | Escopo | Risco |
|---|---|---|
| 1 | Criar `PlanSummaryCard` + `ValorAPagarCard` + `ComoFuncionaCobranca` | Zero |
| 2 | Nova aba **Resumo** do Financeiro usando os 3 cards | Baixo |
| 3 | Renomear sub-abas internas do `FinanceCenter` (Recebimentos/Histórico) | Baixo |
| 4 | Separar grupo **Relatórios** com Vendas/Produtos/Horários | Médio (mexe em constants.ts + navegação) |
| 5 | Polimento: copy, ícones, empty states, testes E2E rápidos no Cantinho da Silvia | Zero |

Confirme se posso seguir e eu começo pela Fase 1.
