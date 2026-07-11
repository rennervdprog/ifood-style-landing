# Plano UI/UX — Super Admin (sem alterar lógica)

Objetivo: transformar o painel num produto profissional, com hierarquia clara, agrupamento consistente e navegação previsível. Zero alteração em queries, RPCs, cálculos ou regras de negócio — só layout, agrupamento, tipografia, espaçamento e microcopy.

## Diagnóstico atual
Hoje existem **17 abas** soltas em 4 grupos inconsistentes (`Principal`, `Configurações`, `Gerenciamento`, `Sistema`). Itens de mesma natureza estão espalhados:
- Financeiro, Pagamentos, Saques, Sócios, Finanças Teste → todos são dinheiro, mas moram em grupos diferentes.
- Entrega (config) fica sozinho em "Configurações".
- Sync, Logs, Broadcast, /links → tudo em "Sistema" mas cada um faz coisa muito diferente.
No mobile a barra inferior tem "Início / … / Mais", e o "Mais" repete quase tudo.

## Nova arquitetura de navegação (5 grupos, 17 abas mantidas)

```text
📊 Visão Geral
  └─ Dashboard

💰 Financeiro
  ├─ Financeiro (fechamento)
  ├─ Pagamentos (split)
  ├─ Saques
  ├─ Sócios
  └─ Finanças Teste

🏪 Operação
  ├─ Lojas
  ├─ Planos
  ├─ Cidades
  ├─ Cupons
  └─ Entrega (taxas)

👥 Pessoas
  ├─ Aprovações   (badge nº pendentes — hoje é toast solto)
  ├─ Moderadores
  └─ Jurídico

⚙️ Sistema
  ├─ Notificações (push)
  ├─ Página /links
  ├─ Sincronizar
  └─ Logs
```
Renomeações leves para clareza: `Dashboard` → `Visão Geral`, `Broadcast` → `Notificações`, `test_finance` → `Finanças Teste`, `sync` → `Sincronizar`.

## Boas práticas aplicadas

**1. Sidebar (desktop)**
- Grupos com título em `text-xs uppercase tracking-wider text-muted-foreground` e divisor sutil.
- Item ativo com barra lateral de 3px na cor primária + fundo `bg-primary/10` (hoje já existe, padronizar).
- Badges numéricos alinhados à direita (Aprovações, Saques pendentes) usando `<Badge variant="secondary">` — dados já existem (`pendingApprovalsCount`, `pendingWithdrawals.length`).
- Ícones 16px, label 14px, altura de linha 40px — bater com padrão shadcn.
- Colapsável para ícone-only (usar `Sidebar collapsible="icon"` do shadcn).

**2. Bottom nav (mobile)**
- Manter 4 fixos + "Mais": `Visão Geral`, `Financeiro`, `Operação`, `Pessoas`, `Mais`.
- O sheet "Mais" abre agrupado pelos mesmos 5 grupos (hoje é lista corrida).
- Badges de pendência aparecem também no bottom nav.

**3. Header de cada aba**
- Padrão fixo: `Título grande + subtítulo cinza + ações à direita`.
- Substituir o if/else de 20 linhas de subtítulo por um mapa `TAB_META = { key: { title, subtitle, actions } }` renderizado num único componente `<PageHeader />` — mesmo comportamento, código mais limpo visualmente (isso é refactor de apresentação, sem alterar lógica).
- Filtro de data (Hoje/Ontem/7 dias) vira `SegmentedControl` no header, não botões soltos.

**4. Cards de métrica (Visão Geral)**
- Grid responsivo `2 cols mobile → 4 cols desktop`, altura uniforme.
- Hierarquia: label 12px caps, valor 28px bold, sublabel 11px muted.
- Card com "alert" (atrasos) muda apenas o ícone e a borda esquerda vermelha, sem trocar o fundo inteiro (menos ruído).
- Mini-sparkline opcional só se houver dados prontos; caso contrário, remover a promessa visual.

**5. Toasts e alertas persistentes**
- Faixa amarela "X saques pendentes" e "X aprovações pendentes" viram **um único banner** no topo com chips clicáveis, não dois blocos empilhados.
- Toast de novo cadastro mantém, mas com ação "Ver" já padronizada.

**6. Tabelas (Financeiro, Pagamentos, Saques, Lojas)**
- Cabeçalho sticky, zebra sutil (`bg-muted/30` nas linhas ímpares), padding vertical 12px.
- Colunas numéricas alinhadas à direita, monetárias com fonte tabular (`font-variant-numeric: tabular-nums`).
- Estado vazio ilustrado (ícone grande cinza + frase + CTA) em vez de "Nenhum registro".
- Loading = skeleton rows, não spinner central.

**7. Formulários (Entrega, Planos, Saques limites)**
- Agrupar em `<Card>` com `CardHeader` descritivo.
- Labels acima dos inputs, help text abaixo em muted.
- Botão primário sempre à direita, secundário à esquerda; ambos com largura mínima 120px.

**8. Cores e tipografia**
- Só tokens semânticos (`--primary`, `--muted-foreground`, `--destructive`, `--success`). Auditar e remover `text-white`, `bg-red-500` etc. que ainda existam nos painéis admin.
- Escala tipográfica: 12 / 14 / 16 / 20 / 28 / 36. Nada fora disso.
- Espaçamento em múltiplos de 4px (Tailwind default) — remover paddings customizados tipo `p-[13px]`.

**9. Densidade e responsividade**
- Modo compacto opcional no desktop (linhas 32px) via toggle no header do usuário — só CSS.
- Breakpoint `md` corrige tabelas que hoje quebram no tablet (scroll horizontal com sombra de borda).

**10. Microcopy**
- Padronizar: "Vendas" vs "Faturamento" vs "Volume" → escolher **Faturamento** em todo o painel.
- "Comissão" sempre com % ao lado do valor.
- Datas sempre em `dd/MM · HH:mm` (America/Sao_Paulo), sem misturar ISO.

## Escopo do que NÃO muda
- Nenhuma query, RPC, edge function, tabela, cálculo, permissão ou fluxo de negócio.
- Nenhum dado novo é buscado; só reaproveitamos o que já vem.
- Rotas, chaves de aba e URLs permanecem idênticas.

## Entrega sugerida em 3 PRs visuais
1. **Navegação:** novo `sidebarItems` (regrupado + renomeado), bottom nav e sheet "Mais" agrupado, badges de pendência.
2. **Header + banner unificado + cards de métrica** padronizados.
3. **Tabelas, formulários, tipografia/tokens e microcopy** varridos em todas as abas.

Cada PR é independente e reversível. Nada quebra funcionalidade porque nenhuma lógica é tocada.

Quer que eu comece pelo PR 1 (navegação) ou prefere ver mocks antes?
