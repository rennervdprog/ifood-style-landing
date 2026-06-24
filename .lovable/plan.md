
# Profissionalização do cadastro de tamanhos da pizza

## Problema atual
Hoje cada sabor cadastra seus próprios tamanhos em `metadata.sizes`. Isso gera:
- Nomes divergentes ("Grande 35cm" num sabor, "G" em outro) → o modal de meio a meio quebra ou some tamanhos.
- Trabalho manual repetido em cada novo sabor.
- Sem garantia de que todos os sabores tenham o mesmo tamanho.
- Sem fator de preço, sem preço por categoria, sem "tamanho indisponível".

## Como os grandes fazem
- **iFood / Anota AI / Goomer / Delivery Direto:** tamanhos são **catálogo da loja** (não do produto). Cada tamanho tem: nome, descrição (fatias/cm), e os sabores recebem **uma tabela de preço por tamanho**, geralmente por **categoria de sabor** (Tradicional, Especial, Premium, Doce).
- Preço final do pedido = regra da loja (maior valor / média) aplicada sobre os preços daquela categoria naquele tamanho.
- Sabor pode ser marcado como **indisponível em um tamanho específico** (ex: doce só no Grande).

## Plano (3 etapas, sem migração destrutiva)

### Etapa 1 — Catálogo de Tamanhos da loja
Nova seção em **Cardápio → Pizzaria → Regras**: "Tamanhos da pizzaria".
- Lista de tamanhos da loja, cada um com: `id`, `nome` (Broto/Média/Grande/Família), `descrição` (ex: "8 fatias · 35cm"), `max_sabores` (sobrescreve o global), `ativo`.
- Drag-to-reorder.
- Guardado em `stores.settings.pizza_sizes_catalog: [{id, name, description, maxFlavors, active}]`.

### Etapa 2 — Categorias de sabor + tabela de preço
Nova seção: "Categorias de sabor" (Tradicional, Especial, Premium, Doce — editável).
- Cada categoria tem **preço por tamanho** numa matriz:
```text
              Broto   Média   Grande   Família
Tradicional   29,90   39,90    49,90    59,90
Especial      34,90   45,90    55,90    65,90
Premium       39,90   52,90    62,90    74,90
```
- Guardado em `stores.settings.pizza_price_matrix: { categoryId: { sizeId: price } }`.
- No cadastro do sabor, em vez de digitar `metadata.sizes`, o lojista só escolhe a **categoria** → preço vem da matriz.
- Opção avançada por sabor: "Sobrescrever preço deste sabor" (override pontual, mantém flexibilidade).
- Toggle por sabor: "Indisponível neste tamanho" (checkbox por tamanho).

### Etapa 3 — Modal do cliente + cálculo
- Passo "Tamanhos" lê do catálogo da loja (não da união dos produtos) → ordem e nomes consistentes.
- Cada tamanho mostra "X fatias · até Y sabores" a partir do `description` e `maxFlavors`.
- Ao escolher sabores, preço = regra da loja (maior/média) aplicada sobre **matriz[categoria][tamanho]** de cada sabor escolhido, respeitando overrides.
- Sabor com `unavailableSizes` some do passo de sabores quando o tamanho escolhido bater.

## Compatibilidade
- Migração transparente: se `pizza_sizes_catalog` não existir, sistema continua lendo `metadata.sizes` por produto (modo legado).
- Botão one-click "Importar tamanhos existentes" → varre todos os sabores, unifica nomes parecidos e popula o catálogo + matriz com a média/moda dos preços já cadastrados. Lojista revisa e salva.
- Após adoção, o editor de `metadata.sizes` no produto vira somente "categoria + overrides".

## Detalhes técnicos
- Tudo em `stores.settings` (JSONB) — **sem migração de schema, sem nova tabela**.
- Tipos novos em `src/types/pizza.ts`: `PizzaSizeCatalogItem`, `PizzaFlavorCategory`, `PizzaPriceMatrix`.
- Componentes novos:
  - `src/components/pizza/PizzaSizesCatalog.tsx` (CRUD do catálogo)
  - `src/components/pizza/PizzaCategoriesMatrix.tsx` (categorias + matriz de preço)
  - `src/components/pizza/PizzaImportLegacyButton.tsx` (importador one-click)
- Alterações:
  - `PizzaFlavorManager.tsx` — adiciona as duas novas seções acima dos blocos atuais.
  - `CategoryProductFields.tsx` — quando o catálogo existir, substitui `PizzaSizesField` por "Categoria + overrides".
  - `PizzaHalfHalfModal.tsx` — passa a ler `pizza_sizes_catalog` + `pizza_price_matrix` quando presentes; fallback no legado.
  - `src/lib/pizzaPricing.ts` (novo) — função pura `computePizzaPrice({sizeId, flavorIds, mode, store})` usada pelo modal e pelo PDV.
- Sem mudança em backend/edge functions — preços já trafegam dentro dos `addons`/`items` do pedido.

## Fora de escopo desta entrega
- Bordas por categoria (continua usando `PizzaBorderManager`).
- Promoções específicas por tamanho.
- Replicar o mesmo modelo para pastel (fica pra próxima, mesma arquitetura).

## Versão
Ao implementar: bump `1.10.259` + `versionCode 589`.
