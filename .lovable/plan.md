# Plano — Reestruturação da aba Cardápio

Hoje o `MenuBuilder` (1.110 linhas) concentra tudo em uma única tela: seções, produtos, adicionais, importação, cardápio do dia, busca, seleção em massa, drag-and-drop e formulários inline. O resultado é pesado no mobile, com muitos botões soltos, formulários que empurram a página e ações escondidas. O plano abaixo profissionaliza a experiência sem mudar regras de negócio nem estrutura de dados.

## 1. Nova arquitetura visual

Layout em 3 zonas fixas (responsivo):

```text
Desktop (>=1024px)                    Mobile (<1024px)
┌───────────┬──────────────────────┐  ┌──────────────────────┐
│ Sidebar   │ Toolbar sticky       │  │ Toolbar sticky       │
│ Seções    ├──────────────────────┤  ├──────────────────────┤
│ (lista    │ Grid de produtos     │  │ Chips de seções      │
│  vertical │ da seção ativa       │  │ (scroll horizontal)  │
│  + drag)  │                      │  ├──────────────────────┤
│           │                      │  │ Lista de produtos    │
└───────────┴──────────────────────┘  └──────────────────────┘
                                       + FAB "Novo produto"
```

- **Sidebar de seções (desktop)**: lista vertical com contagem de itens, indicador de pausada, drag para reordenar, botão "+ Nova seção" no rodapé.
- **Chips de seções (mobile)**: barra horizontal com scroll, badge de quantidade, seção ativa destacada. Botão "gerenciar seções" abre bottom sheet com reordenar/renomear/pausar/excluir.
- **Toolbar sticky**: busca global, filtros (Disponíveis / Pausados / Sem imagem / Sem adicional), botão modo seleção, menu "Mais" (importar CSV, cardápio do dia, adicionais da loja).
- **Área principal**: grid responsivo (1 col mobile, 2 col tablet, 3 col desktop) de `ProductCard` compactos.

## 2. Card de produto redesenhado

Card único e legível, substituindo o layout atual empilhado:

- Miniatura 72x72 à esquerda (placeholder elegante quando sem imagem).
- Nome + preço em destaque, descrição truncada em 2 linhas.
- Linha de metadados: nº de adicionais vinculados, status (Ativo/Pausado), aviso "sem imagem".
- Ações principais visíveis: Editar, Pausar/Ativar. Ações secundárias (Duplicar, Mover, Excluir, Adicionais) em menu `...`.
- Checkbox aparece apenas no modo seleção.
- Estado vazio ilustrado por seção com CTA "Adicionar primeiro item".

## 3. Formulários em Sheet/Drawer

Hoje os formulários renderizam inline e empurram o conteúdo. Passar para:

- **Desktop**: `Sheet` lateral direito (480px) para criar/editar produto e para gerenciar adicionais.
- **Mobile**: `Drawer` bottom sheet full-height com header sticky (Cancelar / Salvar) e teclado-safe.
- Campos agrupados em blocos: Básico, Imagem, Preço, Adicionais vinculados, Avançado (peso, metadata).
- Salvar mostra feedback inline no botão + toast curto.

## 4. Gestão de adicionais mais clara

- Cada produto mostra um resumo dos grupos vinculados (nome + min/max + nº de itens).
- Botão "Gerenciar adicionais" abre Sheet dedicado com abas: **Deste produto** / **Da loja** (reutilizáveis).
- Vincular/desvincular por toggle em vez de modais aninhados.
- Item de adicional com edição inline enxuta (nome + preço) e drag para reordenar.

## 5. Ações em massa aprimoradas

- Barra inferior fixa aparece quando há itens selecionados ("3 itens selecionados").
- Ações: Pausar, Ativar, Mover para seção, Excluir, Duplicar.
- Botão "Selecionar todos da seção" no header da seção.
- Confirmações usam o `ConfirmDialog` existente, sempre com contagem.

## 6. Estados, feedback e microdetalhes

- Skeletons enquanto carrega (sidebar + grid).
- Empty state global ("Comece pelo primeiro item do cardápio") com 2 CTAs: Criar seção / Importar CSV.
- Badges de status padronizadas usando tokens semânticos (`bg-muted`, `text-destructive`, etc.) — sem cores hardcoded.
- Tooltips nos ícones do desktop; labels sempre visíveis no mobile.
- Animações discretas (fade/slide) na abertura de Sheets e reorder.

## 7. Sub-recursos reorganizados

Movidos para dentro do menu "Mais" da toolbar, deixando a tela principal focada em produtos:

- **Importar CSV** → abre Sheet com o `MenuImportCSV` já existente.
- **Cardápio do Dia** → abre Sheet com o `DailyMenuManager` existente.
- **Adicionais da loja** → nova visão consolidada listando grupos reutilizáveis.

## Detalhes técnicos

- Quebrar `MenuBuilder.tsx` em: `MenuBuilder.tsx` (orquestrador), `menu/SectionSidebar.tsx`, `menu/SectionChips.tsx`, `menu/MenuToolbar.tsx`, `menu/ProductGrid.tsx`, `menu/ProductSheet.tsx`, `menu/AddonsSheet.tsx`, `menu/BulkActionBar.tsx`.
- Reaproveitar 100% das queries/mutations atuais (React Query keys preservadas) — sem mudança de schema.
- Usar shadcn `Sheet`, `Drawer`, `Command` (busca), `DropdownMenu`, `Tabs`, `Badge`, `Skeleton`.
- Tokens semânticos apenas (nada de `text-white`/`bg-black` cru).
- Responsividade via `lg:` breakpoints; testar em 384px (viewport atual) e 1440px.
- Manter drag-and-drop nativo já implementado, encapsulado no novo `SectionSidebar`.
- Incrementar versão em `src/pages/PerfilPage.tsx` e `android/app/build.gradle` (versionName + versionCode) ao final.

## Fora de escopo

- Regras de negócio, cálculo de preços, schema do banco.
- PDV, cardápio público do cliente, painel do super admin.
- Novos campos de produto ou novos tipos de adicionais.
