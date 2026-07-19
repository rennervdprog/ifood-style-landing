# Plano — Refatoração UI/UX da aba Mesas (PDV)

## Problemas atuais
- Grid 2 col no mobile com cards pequenos, texto minúsculo (10px), sem hierarquia visual clara.
- Status codificado só por cor (livre/ocupada/fechando) — difícil distinguir de relance.
- Comandas avulsas empurradas para baixo, sem contexto de tempo/valor.
- Header com dois botões concorrentes (Nova mesa / Comanda avulsa) ocupando muito espaço.
- Drawer da comanda tem grid 2 colunas (produtos + itens) que no mobile fica apertado — precisa ser passos separados.
- Sem indicador de tempo aberta, valor acumulado ou nº de itens direto no card da mesa.
- Ações (Transferir / Cancelar / Fechar) em botões pequenos de 11px, difíceis de tocar.

## Nova estrutura (mobile-first)

### 1. Topo compacto
- KPI strip horizontal: `Livres X` · `Ocupadas Y` · `Total aberto R$ Z` (chips).
- FAB `+` no canto inferior direito com sheet (Nova mesa / Comanda avulsa) — libera header.

### 2. Cards de mesa redesenhados
- Grid 2 col mobile, mas cards maiores (altura ~110px) com:
  - Número/label grande (font-black, 20px).
  - Badge de status colorido com ícone (● livre, 🍽 ocupada, 💳 fechando).
  - Se ocupada: valor acumulado em destaque + tempo aberta ("32 min") + nº de itens.
  - Nome do cliente em linha secundária.
- Borda esquerda colorida grossa (4px) reforçando status (redundância cor+forma).
- Toque em mesa livre → sheet de confirmação "Abrir mesa X" (evita abrir sem querer).

### 3. Seção "Comandas avulsas" como carrossel horizontal
- Scroll-x com cards médios mostrando código, cliente, valor, tempo.
- Reduz altura vertical e diferencia visualmente das mesas.

### 4. Drawer da comanda — fluxo em passos (mobile)
- Full-screen sheet com 2 abas topo: `Itens (n)` · `Adicionar produto`.
- Aba Itens: lista grande, swipe-left ou botão remover 40x40.
- Aba Adicionar: busca fixa + lista de produtos com toque grande, contador visual de qtd por produto.
- Rodapé fixo sempre visível: `Total R$ X` + botão principal grande `Fechar` (verde), botões secundários `Transferir` e `Cancelar` menores acima em row.
- Desktop mantém split 2 colunas (comportamento atual).

### 5. Micro-interações
- Toast + haptic ao adicionar item.
- Skeleton loading no lugar do spinner central.
- Empty state com ilustração/ícone grande + CTA claro.

## Escopo técnico
Arquivos afetados:
- `src/pages/pdv/components/PdvMesasView.tsx` — refatoração principal.
- Novo: `src/pages/pdv/components/PdvMesaCard.tsx` — card isolado com props (status, valor, tempo, itens).
- Novo: `src/pages/pdv/components/PdvTabDrawer.tsx` — extrair drawer para arquivo próprio com layout mobile/desktop.
- `usePdvTables` — adicionar cálculo agregado (total, itens, opened_at) por tab; ou calcular no componente via `usePdvTabItems` batch.

Sem mudanças de backend/schema. Só apresentação.

## Versão
Bump para v1.20.26 (build 1054) após implementação.

Confirma que sigo com a implementação?
