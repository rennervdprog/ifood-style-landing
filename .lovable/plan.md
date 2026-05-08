# Plano — Correção dos 21 itens da StorePage

Vou aplicar tudo em ondas, do mais crítico ao cosmético, mantendo só mudanças de frontend (sem mexer em RLS/edge functions exceto onde obrigatório).

## Onda 1 — Bugs críticos (impacto direto no cliente)

1. **Esgotado nos cards** — remover `.eq("is_available", true)` da query e exibir badge "Esgotado" + botão desabilitado em `ProductCard` (cliente).
2. **Rankings ignorando cancelados** — filtrar `orders.status in ('entregue','finalizado','concluido')` nas queries `popular-products` e `reorder`.
3. **Limites de ranking** — subir `limit` e ordenar por contagem real no client (sem criar materialized view nessa rodada).
4. **Race do `document.title`** — remover cleanup que reverte título; setar 1x e deixar.
5. **Pizza meio-a-meio** — guard: só abrir modal half-half se houver pelo menos 1 produto pizza válido.

## Onda 2 — Performance

6. **Memoização** — `useMemo` em `reorderProductsList`, `popularProductsList`, `unsectionedProducts`, `filteredProducts`. `useCallback` no `onClick` do ProductCard.
8. **LCP do hero** — `loading="eager"` + `fetchPriority="high"` na imagem do banner.
9. **Scroll listener** — usar `requestAnimationFrame` com flag de ticking.
10/11. Coberto por #6.
7. **Reorder/popular** — aumentar `staleTime` e usar `placeholderData: keepPreviousData`.
6 (bundle): adiar (requer edge function — fora do escopo desta rodada).

## Onda 3 — UX

12. **Taxa de entrega** visível no header da loja.
13. **Tempo estimado de entrega** ao lado da taxa.
14. **Pedido mínimo** abaixo da taxa.
15. **Botão MAPS** — usar `Browser.open()` do Capacitor com fallback web.
16. **Categoria "Outros"** — só renderizar se houver produtos sem seção.
17. **Indicador de scroll** nas categorias — fade lateral + sombra quando há overflow.
18. **Loja fechada** — permitir abrir modal, bloquear apenas o botão "Adicionar".
19. **Carrinho de outra loja** — validar `store_id` no `CartContext.addItem`; se diferente, perguntar e limpar.
20. **Acessibilidade** — `aria-label` nos botões com só ícone.
21. **Dialog warning** — adicionar `<DialogDescription>` (ou `aria-describedby`) no `ProductDetailModal` e `PizzaHalfHalfModal`.

## Versão
Bump para **1.4.4** (versionCode 97) em `appVersionCheck.ts`, `build.gradle` e `PerfilPage.tsx`.

## Fora desta rodada (avisarei ao final)
- #6 bundle via edge function `store-page-bundle`
- Materialized view para rankings reais
- Novas features sugeridas (favoritar, compartilhar, avaliações públicas, etc.)
