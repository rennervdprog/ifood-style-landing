# Plano — UI/UX profissional da aba Histórico (PDV)

## Problemas atuais
- Header minúsculo ("Movimentações do turno atual") sem contexto do turno (abertura, tempo, totais).
- Lista plana e cronológica de vendas/sangria/suprimento — sem agrupar por hora, sem filtros, sem busca.
- Cards de venda mostram só valor + método; não dá pra ver itens, cliente, cancelar sem abrir Turnos.
- Não há KPIs de topo (nº vendas, ticket médio, dinheiro em caixa, sangrias).
- Sem distinção visual entre vendas normais x canceladas x estornos.
- Sem paginação/scroll infinito — `limit=50` fixo, silencioso.
- Aba "Turnos" (histórico antigo) vive separada — usuário precisa saber que existem duas abas.

## Nova estrutura (mobile-first)

### 1. Header contextual do turno atual (sticky)
- Card compacto no topo com: operador · hora abertura · tempo aberto (`3h 12min`) · badge "● Aberto".
- Linha de KPIs em chips horizontais scrolláveis:
  `Vendas 12` · `Total R$ 480` · `Ticket R$ 40` · `Dinheiro R$ 210` · `Sangrias −R$ 50`.
- Botão discreto "Ver turnos anteriores" → abre bottom-sheet com `PdvSessionsList` (elimina a aba Turnos duplicada, ou mantém como atalho).

### 2. Barra de filtros + busca (sticky abaixo do header)
- Input de busca (código do pedido, nome do item, valor).
- Chips de filtro rápido: `Tudo` · `Vendas` · `Sangrias` · `Suprimentos` · `Canceladas`.
- Chip de método: `Dinheiro` · `PIX` · `Crédito` · `Débito` (multi-select).

### 3. Timeline agrupada por hora
- Separadores tipo "14:00 — 15:00 · 6 vendas · R$ 240" (colapsáveis).
- Cada item de venda expansível (tap → expande inline):
  - Fechado: método + itens resumidos ("2x X-Burguer, 1x Coca") + valor.
  - Aberto: lista completa de itens com qty × preço, desconto, mesa/comanda, cliente, hora, botão "Cancelar venda" e "Reimprimir".
- Sangria/suprimento: linha mais fina, ícone lateral, motivo em itálico.

### 4. Rodapé de estado
- Skeleton loading (3 cards fantasmas) em vez de spinner central.
- Empty state com ícone + CTA "Registrar primeira venda" (leva pra aba Vender).
- Paginação: botão "Carregar mais 50" no fim, ou infinite scroll com IntersectionObserver.

### 5. Micro-detalhes visuais
- Borda-esquerda 3px colorida por tipo (verde=venda, vermelho=sangria, azul=suprimento, cinza=cancelada).
- Valor sempre alinhado à direita, tabular-nums, font-black.
- Badge de método com ícone (já existe) mas maior e com bg tintado.
- Haptic leve ao expandir card.

## Escopo técnico
Arquivos afetados:
- `src/components/pdv/PdvHistorico.tsx` — refatoração principal:
  - Extrair `PdvHistoricoHeader` (KPIs + contexto do turno).
  - Extrair `PdvHistoricoFilters` (busca + chips).
  - Extrair `PdvHistoricoItem` (card expansível com detalhes/cancelar/reimprimir).
  - Adicionar agrupamento por hora via `useMemo`.
  - Adicionar paginação (queryKey com `page` ou `useInfiniteQuery`).
- `src/pages/PdvPage.tsx` — passar mais props (session, operator) ao Histórico; opcionalmente esconder a aba "Turnos" separada e usar o botão dentro do Histórico.
- Reaproveitar `PdvCancelSaleDialog` já existente para cancelamento inline.

Sem mudanças de backend/schema. Só UI + query enrichment (join com order_items pra mostrar itens resumidos direto no card).

## Versão
Bump para v1.20.27 (build 1055) após implementação.

Confirma que sigo com a implementação?
