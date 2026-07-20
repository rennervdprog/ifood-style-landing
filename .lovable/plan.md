# PDV especializado — Lanches, Pizzaria e Restaurante/Marmitaria

Três modos focados em food service, seguindo o mesmo padrão da Boutique (`store_type` + telas próprias, reaproveitando caixa/KDS/mesas/histórico/PIN).

Muita coisa já existe solta no sistema (modo pizza, adicionais, KDS, mesas). O trabalho aqui é **empacotar por categoria** com layout e fluxo dedicados, ao invés de deixar tudo genérico.

## Fase 1 — Lanches (Hamburgueria / Lanchonete)

Foco: rapidez no balcão, montagem de lanche com adicionais.

Escopo:
- `store_type='snack_bar'`.
- Catálogo em **grid grande com foto** agrupado por categoria (Lanches, Bebidas, Porções, Sobremesas).
- Modal de montagem: adicionais obrigatórios (ponto da carne, molhos) + opcionais (bacon, cheddar extra) reusando `addon_groups` / `addon_items`.
- Combo builder: "Lanche + Batata + Refri" com preço fechado.
- Observação por item ("sem cebola", "bem passado") direto no card do carrinho.
- Impressão dividida: cozinha (só itens quentes) + balcão (frios/bebidas) via `thermalPrint.ts`.
- Chamador de senha simples (número na tela KDS).

E2E: montar 2 combos + 1 lanche com adicional + observação, fechar, conferir impressão dividida e KDS.

## Fase 2 — Pizzaria

Foco: pizza meio-a-meio, bordas, tamanhos, entrega.

Escopo:
- `store_type='pizzeria'`.
- Já existe `pizzaPricing.ts` + `pizza_borders` + tipos em `types/pizza.ts` — encapsular num fluxo próprio.
- Builder visual: escolhe tamanho → 1/2 ou 2/2 sabores → borda → adicionais.
- Regra de preço: **maior sabor** (padrão) ou média — configurável por loja.
- Cardápio do dia / promo por dia da semana (Terça 2x1) reusando `promo_campaigns`.
- Impressão da comanda com os sabores lado-a-lado ("1/2 Calabresa | 1/2 Portuguesa").
- Ficha técnica opcional (ingredientes na cozinha).
- Integração com **mesas** e **delivery** — pizzaria costuma ter os dois.

E2E: montar pizza meio-a-meio com borda + refri, salvar em mesa, fechar, conferir impressão com sabores separados.

## Fase 3 — Restaurante / Marmitaria

Foco: prato feito, self-service por peso, marmita montada.

Escopo:
- `store_type='restaurant'`.
- Três sub-modos escolhidos nas configs da loja:
  1. **À la carte** (prato pronto do cardápio) → usa fluxo padrão.
  2. **Por quilo** — leitura da balança Toledo (`toledoScale.ts` já existe) → preço × peso, ticket fica aberto até pesar.
  3. **Marmita montada** — cliente escolhe base (arroz/feijão) + 1 proteína + N acompanhamentos, com regras de tamanho (P/M/G) e preço fechado.
- Card **"Cardápio do dia"** em destaque no topo (o que tem hoje) — já temos infra de disponibilidade diária em `products.is_available`, só faltará um toggle rápido por dia.
- Modo **marmita para entrega**: fluxo enxuto sem mesa, direto pra sacola + endereço.
- Comanda de mesa com divisão de conta ("dividir por 4").
- Fechamento por mesa mostrando taxa de serviço (10%) opcional.

E2E: vender 1 prato à la carte + 1 marmita M montada + 1 por peso, dividir conta em mesa por 3, fechar.

## Padrão comum (reaproveitado das fases anteriores)

- Cadastro (`CadastroLojista.tsx`) mapeia categoria → `store_type`.
- Switch em `PdvPage.tsx` / `PdvCardapioPage.tsx`.
- Componentes em `src/pages/pdv/{snack,pizza,restaurant}/`.
- Caixa, KDS, mesas, PIN gerente, outbox offline, relatórios: reaproveitados sem duplicar.
- Bump de versão (`appVersion.ts` + `build.gradle` patch + versionCode) a cada fase.
- E2E em `scripts/e2e/{snack,pizza,restaurant}/` no padrão do apparel.
- Landing (`StoreDirectory.tsx`) ganha os 3 modos na seção de módulos ao final.

## Detalhes técnicos

- Enum `store_type` recebe `snack_bar`, `pizzeria`, `restaurant` via migration no externo (oneshot edge function com `EXTERNAL_SUPABASE_SERVICE_KEY`, padrão do projeto).
- Nova tabela `restaurant_meal_kits` (id, store_id, name, size, base_price, allowed_categories jsonb) só na Fase 3 — com GRANT + RLS por `store_id` via `has_role`.
- Nova tabela `combo_definitions` (Fase 1) — id, store_id, name, items jsonb, price. GRANT + RLS idem.
- Split de impressão: extensão em `thermalPrint.ts` aceitando `printerTarget: 'kitchen' | 'counter'` no item.
- Regra de preço da pizza (maior vs média): já suportada em `pizzaPricing.ts`, só expor toggle em Settings.
- Divisão de conta: cálculo puro no client (`splitBill(total, n)`).
- Performance: lazy-load dos 3 painéis novos, memoização dos builders (montagem re-renderiza muito).

## Entrega

Sequencial, uma fase por resposta, com E2E verde antes de avançar. Começo pela **Fase 1 — Lanches** se você aprovar.
