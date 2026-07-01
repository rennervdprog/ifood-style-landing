# Plano: Aba Relatórios Profissional (Lojista)

## Objetivo
Substituir a aba "Relatórios Avançados" atual (que mostra zeros e não filtra por dia) por um painel real, com seletor de data específico, ranking de produtos vendidos por dia e comparativos úteis para operação.

## 1. Backend (Supabase Externo)

Criar RPC única `get_store_daily_report(_store_id uuid, _date date)` retornando JSON com:
- `resumo`: receita_total, pedidos_count, ticket_medio, cancelados, taxa_cancelamento
- `origem`: separação Delivery / PDV / Manual (receita e qtd)
- `pagamentos`: totais por método (pix, dinheiro, cartão, pix_machine)
- `horarios`: array 0..23h com receita e qtd
- `produtos`: ranking com { product_id, nome, qtd_vendida, receita_total, ticket_medio } ordenado por qtd desc
- `comparativo`: mesmos totais do dia anterior + variação %

Fonte: `orders` + `order_items` filtrando `store_id`, `created_at::date = _date`, `status <> 'cancelado'` (cancelados contam apenas em taxa_cancelamento). SECURITY DEFINER com checagem `store owner OR admin`.

Criar também `get_store_period_report(_store_id, _start, _end)` para os presets 7d/14d/30d/90d reutilizando a mesma estrutura agregada.

## 2. Frontend

Refatorar a aba Relatórios em `StoreDashboard`:

**Filtro superior:**
- Seletor de dia único (date picker padrão pt-BR, default = hoje)
- Presets rápidos: Hoje, Ontem, 7d, 14d, 30d, 90d, Personalizado (intervalo)
- Botão "Exportar CSV"

**Sub-abas:**
1. **Visão geral** — Cards: Receita, Pedidos, Ticket médio, Cancelamentos, + comparativo com dia/período anterior
2. **Vendas** — gráfico de barras por hora (dia) ou por dia (período), split por origem (Delivery/PDV/Manual), tabela de pagamentos
3. **Produtos** — tabela ranqueada: #, Produto, Qtd vendida, Receita, % do total; destaque top 3; gráfico de pizza
4. **Horários** — heatmap hora×qtd, horário de pico real, melhor dia da semana

**Componentes novos:**
- `src/components/store/reports/DayPicker.tsx`
- `src/components/store/reports/ReportOverview.tsx`
- `src/components/store/reports/ReportSales.tsx`
- `src/components/store/reports/ReportProducts.tsx` (ranking com quantidade por produto no dia)
- `src/components/store/reports/ReportHours.tsx`
- `src/hooks/useStoreReport.ts` (React Query, cache 60s, invalidação ao trocar data)

Estado vazio real: "Nenhuma venda em DD/MM/AAAA" (não mostrar R$ 0,00 como se fosse resultado).

## 3. Performance
- RPCs agregam no banco (sem trazer linhas cruas)
- React Query com `staleTime: 60_000`
- Lazy-load da aba Relatórios
- Gráficos com `recharts` já instalado

## 4. Entrega
- Migração criando as 2 RPCs + GRANT EXECUTE para authenticated
- Refactor da aba com as 4 sub-abas funcionando
- Teste com Águia Pizzaria e Cantinho da Silvia (dados reais)
- Bump versão 1.10.382 (versionCode 711) em `PerfilPage.tsx` + `build.gradle`

Confirma que sigo com a implementação?
