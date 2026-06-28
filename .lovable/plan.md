## Objetivo

Permitir que adicionais "comuns" tenham um stepper **− 1 +** (quantidade > 1 por linha), sem quebrar os fluxos especiais (Pizza meio/meio, Pastel builder, sabores, bordas, escolha única tipo "tamanho").

## Onde mexer

Apenas no fluxo do `ProductDetailModal.tsx` (modal padrão do cliente). Pizza (`PizzaHalfHalfModal`) e Pastel (`PastelBuilderModal`) **não entram nesta mudança** — eles têm UI própria de seleção de sabores e não usam o stepper de addon.

## Regra de quando exibir o stepper

Um grupo de addon mostra **− qty +** por item somente se TODAS as condições baixo forem verdadeiras:

1. `max_select > 1` (grupo permite mais de uma escolha no total).
2. Grupo **não é** de tamanho/sabor/borda (heurística: nome do grupo não bate `/tamanho|sabor|borda|meio/i` e produto não é pizza/pastel).
3. `price_replaces_base` é falso (grupos que substituem preço base = escolha única, sempre qty 1).

Se qualquer condição falhar → comportamento atual (checkbox/radio, qty implícita = 1). Isso preserva 100% dos casos hoje funcionando.

## Comportamento do stepper

- Default qty = 0 (não selecionado). Clicar `+` pela 1ª vez = seleciona com qty 1.
- Soma de quantidades do grupo respeita `max_select` (`+` desabilita ao atingir o teto).
- `min_select` valida soma total (não nº de itens distintos).
- `−` em qty 1 remove o item da seleção.

## Impacto em estruturas de dados

- `CartAddon` ganha campo opcional `quantity?: number` (default 1, retrocompatível).
- Ao montar `addons[]` para `onAdd`, expandir/colapsar:
  - **Opção A (escolhida):** repetir o addon N vezes no array (`[{name:"Coca",price:9}, {name:"Coca",price:9}]`). Zero impacto em: cálculo de preço (`reduce sum`), chave de carrinho (`addonKeyOf`/`generateCartKey`), thermal print, KDS, pedidos. **Não precisa migração nem alterar tipos compartilhados.**
- Chave de agrupamento do carrinho (`addonKeyOf` no PDV e `generateCartKey` no Cart) já ordena por nome → mesmo conjunto qty=2 agrupa corretamente.

## Itens fora do escopo (não tocar)

- `PizzaHalfHalfModal.tsx` — fluxo de meio/meio intocado.
- `PastelBuilderModal.tsx` — fluxo de sabores intocado.
- Admin/AddonManager — sem mudança de schema.
- Thermal print / KDS / PDV — funcionam por repetição (Opção A).

## Validação

- Testes manuais: bebida com qty 2, grupo required com min_select=2 (selecionar 1 item qty 2), tentar exceder `max_select`, abrir Pizza/Pastel para confirmar que UI deles continua igual.
- Rodar `bun test` (cobre `CartContext`, `usePdvCart`, thermalPrint — devem permanecer verdes pois addons repetidos é comportamento já suportado).

## Versão

Bump `1.10.309` (build 639) ao implementar.

---

Confirmar antes de implementar:
1. OK manter Pizza/Pastel sem stepper?
2. OK Opção A (repetir addon no array, sem mudar schema)?
