# Profissionalização da aba Clientes

Hoje a aba tem só 4 filtros simples (Todos / Fiéis 3+ / Inativos 15d / Localização) e um cartão com poucas métricas. Vamos transformar em um mini-CRM real, no padrão de iFood Gestor / Anota AI / Goomer, **usando 100% dados reais já presentes em `orders` + `profiles`** — sem novas tabelas.

## 1. Métricas em destaque (cabeçalho da aba)

4 mini-cards no topo, clicáveis (cada um vira um filtro):

- **Total de clientes** — `clientAnalytics.length`
- **Recorrentes** — compraram ≥4× nos últimos 30 dias (≈1×/semana)
- **Em risco** — último pedido entre 15 e 30 dias
- **Inativos** — sem pedido há 30+ dias (com sub-corte 45/60)

## 2. Segmentação RFM real (chips de filtro)

Substituir os 4 chips atuais por segmentos profissionais, todos calculados em memória a partir de `orders`:

| Segmento | Regra |
|---|---|
| **Novos** | 1º pedido nos últimos 30 dias |
| **Recorrentes semanais** | ≥4 pedidos nos últimos 30 dias |
| **Fiéis VIP** | ≥10 pedidos no total **e** ativo nos últimos 30 dias |
| **Em risco** | última compra entre 15–30 dias |
| **Inativos 30d / 45d / 60d+** | sub-chips com contagem |
| **Alto ticket** | ticket médio acima da média da loja |
| **Aniversariantes do mês** | `profiles.birth_date` (se preenchido) |

Os badges RFM já existentes (`novo / recorrente / risco / inativo`) em `ClientsTab.tsx` passam a refletir essas mesmas regras (hoje têm corte único 15/30/60 — vai virar 15/30/45).

## 3. Card do cliente — mais informação acionável

Adicionar no card expandido (além do que já tem):

- **Frequência média** entre pedidos (ex: "compra a cada 6 dias")
- **Previsão da próxima compra** = `últimoPedido + frequênciaMédia` (mostra "atrasado há X dias" se passou)
- **% cancelamentos** do cliente
- **Forma de pagamento preferida** (mais usada)
- **Bairro + nº pedidos por bairro** (já temos `neighborhood`)
- **LTV** (já temos como "Total Gasto") + **meses ativo**

## 4. Ações em massa (campanhas)

Botão flutuante "📢 Campanha" quando há filtro ativo:

- Selecionar todos do segmento atual
- Disparar mensagem WhatsApp **um a um** (reusa `WhatsAppButton` já presente) com template pronto por segmento:
  - Inativos 30d → "Sentimos sua falta, cupom 15%"
  - Recorrentes → "Obrigado pela fidelidade, brinde no próximo pedido"
  - Aniversariantes → "Parabéns! Cupom de presente"
- Opção de gerar **cupom único** vinculado à campanha (usa tabela `coupons` existente)

## 5. Exportação

Botão "Exportar CSV" do segmento filtrado (nome, telefone, bairro, pedidos, total, último pedido, dias inativo). Geração 100% client-side — sem backend.

## 6. UX / layout

- Cabeçalho com os 4 mini-cards de métricas (grid 2×2 no mobile, 4 col no desktop)
- Chips de segmento em scroll horizontal (mantém padrão atual)
- Ordenação: dropdown "Mais pedidos / Maior ticket / Mais recente / Mais inativo"
- Empty state melhor por segmento ("Nenhum cliente em risco — bom trabalho!")

## Técnico (resumo)

- **Sem migração de schema.** Tudo derivado de `allOrders` + `clientProfiles` já carregados em `AdminDashboardV2.tsx`.
- Expandir `clientAnalytics` (linhas 670–717) para calcular: `ordersLast30`, `avgFrequencyDays`, `nextOrderPrediction`, `cancelRate`, `preferredPayment`, `isVip`, `segment`.
- `ClientsTab.tsx`: novo header de métricas, novos chips, novo card expandido, barra de ações em massa, export CSV.
- Filtro/ordenação no mesmo `useMemo` `filteredClients`.
- Tipo `ClientFilter` ampliado com os novos segmentos.

## Fora de escopo

- Novas tabelas, edge functions, push automático, integração com Evolution para envio em lote (WhatsApp continua 1-a-1 via link, como hoje).
- Aba Fidelidade e Cupons (ficam como estão).
