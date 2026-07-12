
# Reestruturação UI/UX — Aba Pedidos (Lojista)

Sem mudar lógica de negócio, RPCs, queries, fluxos de status, impressão, WhatsApp, Pix Direto ou batch dispatch. Apenas reorganizar hierarquia visual, densidade, componentização e responsividade em `src/pages/admin/sections/OrdersSection.tsx` e `src/pages/admin/components/AdminOrderCard.tsx`.

## Problemas atuais

- Arquivo único de 662 linhas com muitos blocos empilhados: banner Pix + 4 contadores + tabs de status + busca + filtros período/origem + resumo + barra batch + cards. Muita informação competindo pela atenção.
- Contadores (4 botões) duplicam funcionalmente as tabs de status logo abaixo.
- Filtros de período/origem ficam abaixo da busca e do sticky, então "somem" no scroll.
- Resumo do período (faturamento) fica visualmente igual aos filtros — pouca hierarquia.
- Card do pedido (`AdminOrderCard`, 621 linhas) tem alta densidade sem agrupamento claro entre: cabeçalho, cliente, itens, ações.
- No mobile o layout empilha bem, mas há muito padding vertical e header sticky ocupa espaço demais.
- No desktop usa grid 2 colunas, mas toolbar/filtros continuam full-width mobile-first, deixando o topo "vazio".

## Nova estrutura visual

```text
┌─────────────────────────────────────────────────────────┐
│ Header sticky compacto                                  │
│  Faturamento hoje · R$ 1.240   [Hoje▾] [Todas▾] [🔍]   │
├─────────────────────────────────────────────────────────┤
│ Pills de status (scroll horizontal, badges com contagem)│
│  ● Novos 3   Preparo 2   Prontos 1   Entrega   Concl.  │
├─────────────────────────────────────────────────────────┤
│ [Alerta Pix Direto] (só quando existir)                 │
│ [Barra batch dispatch] (só quando aplicável)            │
├─────────────────────────────────────────────────────────┤
│ Lista de cards (1 col mobile · 2 col desktop · 3 col xl)│
└─────────────────────────────────────────────────────────┘
```

## Mudanças (apenas apresentação)

### 1. Header unificado (substitui contadores + filtros + resumo soltos)
- Um único bloco sticky com: resumo curto do período (faturamento + nº pedidos), seletor de período (Hoje/Ontem/7d/Tudo) como dropdown compacto, seletor de origem (Todas/Delivery/PDV/Manual) como dropdown, e ícone de busca que expande input inline.
- Remove os 4 "contadores grandes" — a informação passa para os badges das próprias pills de status (já existem).

### 2. Pills de status refinadas
- Mantém a lógica atual (`orderTabs`, `activeTab`, `setActiveTab`).
- Visual: pill ativa com preenchimento sólido; pills com contagem > 0 destacadas; pill "Novos" com dot pulsante quando `pendente > 0`.
- Sticky logo abaixo do header, alinhadas ao container.

### 3. Alerta Pix Direto
- Mantém toda a lógica (`confirmPix`, `refusePix`, `confirmPixExternal`, `openProof`).
- Vira um card único colapsável quando > 2 itens, com badge de contagem. Botões `Ver`, `Confirmar`, `Recusar`, `Recebi no WhatsApp` reorganizados em linha única no desktop e wrap no mobile (já é, mas melhora spacing/hierarquia).

### 4. Card do pedido (`AdminOrderCard`)
Sem mudar props nem handlers. Reagrupamento visual interno em 4 seções:
1. **Cabeçalho** — nº pedido, hora, status pill, valor total (destaque), origem (Delivery/PDV/Manual como chip pequeno).
2. **Cliente & entrega** — nome + WhatsApp + endereço colapsável (mantém `toggleAddress`).
3. **Itens** — lista compacta com destaques de adicionais obrigatórios (mantém `highlights`).
4. **Ações** — ação principal em destaque (accept/ready/dispatch), ações secundárias (imprimir, WhatsApp, cancelar) em barra alinhada. No mobile as ações secundárias viram ícones; no desktop, ícone + texto.

### 5. Empty states
- Mantém texto atual, mas cria componente `OrdersEmptyState` reutilizável e reduz padding vertical (`py-24` → `py-14`) para não empurrar demais o layout.

### 6. Skeleton
- Extrair para `OrderCardSkeleton` e usar grid igual ao dos cards reais para evitar "salto" quando carrega.

### 7. Floating badge "N novos"
- Mantém a lógica; muda posição para respeitar `env(safe-area-inset-bottom)` + altura do bottom nav (mesmo pattern do `BulkActionBar` corrigido recentemente) para não sobrepor navegação.

### 8. Responsividade
- Mobile: 1 coluna, header e pills sticky, ações compactadas.
- Tablet (md): 2 colunas, header em linha única.
- Desktop (xl): 3 colunas de cards, filtros e busca lado a lado no header.

## Componentização (só extração, sem mudança de lógica)

Novos arquivos em `src/pages/admin/components/orders/`:
- `OrdersHeader.tsx` — resumo + filtros período/origem + busca.
- `OrdersStatusPills.tsx` — pills de status com badges.
- `PixDirectAlert.tsx` — bloco Pix Direto (recebe handlers via props).
- `BatchDispatchBar.tsx` — barra de agrupamento de entregas.
- `OrdersEmptyState.tsx` — estado vazio por tab.
- `OrderCardSkeleton.tsx` — placeholder de carregamento.

`OrdersSection.tsx` passa a ser um orquestrador enxuto (~200 linhas) que só monta esses blocos e passa props — nenhuma query, RPC, filtro de negócio ou cálculo muda.

`AdminOrderCard.tsx` é refatorado internamente em subcomponentes locais (`CardHeader`, `CustomerBlock`, `ItemsBlock`, `ActionsBar`) mantendo a mesma assinatura de props.

## Fora do escopo

- Nada de mudar RPCs, queries React Query, ordenação, cálculo de contadores, fluxos de status, impressão térmica, integração WhatsApp/Evolution, permissões ou dados exibidos.
- Nada de tocar em `AdminDashboardV2.tsx` além, se necessário, dos imports.
- Sem novas dependências.

## Versão

Ao aplicar, subir para v1.14.4 (build 939) em `PerfilPage.tsx` e `android/app/build.gradle`.

Confirma que sigo com essa reestruturação?
