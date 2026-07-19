# Plano — Refatoração mobile das abas do PDV

## Problema atual
No mobile as abas de topo (`PdvTabs`) ficam com labels truncados ("V...", "M...", "H...", "T...", "R...", "M...", "C..."), sem ícones legíveis, sem indicação clara do que é cada aba, e o scroll horizontal é desconfortável. Visualmente poluído e amador.

## Objetivo
UI mobile-first, dedografiada (touch friendly), com hierarquia clara, sem truncar texto, e coerente com o resto do app (laranja/branco, tokens semânticos).

## Mudanças

### 1. Bottom Tab Bar no mobile (padrão nativo)
- No mobile (`<md`): mover as abas do topo para uma **barra fixa inferior** com 5 itens principais + botão "Mais" para abas secundárias.
- No desktop/tablet: manter o layout de abas horizontal atual (já funciona bem).
- Componente novo: `PdvMobileBottomNav.tsx`, controlado pelo mesmo estado de `activeTab` do `PdvPage`.

### 2. Agrupamento das abas
Principais (bottom bar, sempre visíveis):
- Vender (ícone carrinho)
- Mesas (ícone grid)
- Histórico (ícone relógio)
- Relatórios (ícone gráfico)
- Mais (abre bottom-sheet)

Secundárias (dentro do "Mais", bottom-sheet):
- Cardápio
- Meu Plano
- Configurações
- Turno / Fechar caixa

### 3. Header mobile enxuto
- `PdvTopbar` no mobile: só logo + nome da loja + status caixa + avatar operador. Remover ações duplicadas que já estão no bottom nav.
- Badge de conexão (wifi) menor, sem texto.

### 4. Estados visuais
- Aba ativa: fundo laranja suave (`bg-primary/10`), ícone e label em `text-primary`, barra superior de 2px.
- Inativa: `text-muted-foreground`, ícone outline.
- Toque com `active:scale-95` e haptic feedback (via `navigator.vibrate(10)`).
- Safe-area inset bottom para iPhone/Android com barra de gestos: `pb-[env(safe-area-inset-bottom)]`.

### 5. Bottom sheet "Mais"
- Usa `Sheet` do shadcn com `side="bottom"`, cantos arredondados no topo, grid 2 colunas de cards grandes (ícone + label), fechamento por swipe.

### 6. Aba "Vender" no mobile
- Sticky search bar no topo do conteúdo (não do header) para busca de produto.
- Botão flutuante do carrinho (FAB) com badge de quantidade e total — abre a etapa "cart" atual.

### 7. Tokens e acessibilidade
- Nada de cor hardcoded — usar `--primary`, `--muted`, `--border`, `--background`.
- Alvos de toque ≥ 44px.
- `aria-label` em cada item, `aria-current="page"` na aba ativa.

## Arquivos a criar/alterar
- **Novo:** `src/pages/pdv/components/PdvMobileBottomNav.tsx`
- **Novo:** `src/pages/pdv/components/PdvMoreSheet.tsx`
- **Alterar:** `src/pages/pdv/components/PdvTabs.tsx` — esconder no mobile (`hidden md:flex`)
- **Alterar:** `src/pages/PdvPage.tsx` — montar bottom nav + sheet, adicionar `pb-20 md:pb-0` no container
- **Alterar:** `src/pages/pdv/components/PdvTopbar.tsx` — versão compacta mobile
- **Alterar:** `src/pages/PdvPage.tsx` (aba Vender) — FAB do carrinho no mobile
- **Alterar:** `src/lib/appVersion.ts` + `android/app/build.gradle` — bump patch

## Fora do escopo
- Sem mudanças em lógica de negócio, RPCs, ou dados.
- Sem mexer no layout desktop além de esconder o bottom nav.
- Sem alterar KDS (já é tela dedicada).

## Validação
- Playwright mobile viewport (384×653) navegando por todas as abas via bottom nav + sheet "Mais".
- Screenshots antes/depois de cada aba.
