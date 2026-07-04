## Objetivo
Refinar o card horizontal da categoria **adegas** para ficar mais agradável visualmente, sem alterar cores da loja/tema.

## Escopo
Apenas `src/pages/StorePage.tsx` no componente `ProductCard`, condicionado a `cat === "adegas"`. Nenhuma alteração em outras categorias, nenhum token de cor novo.

## O que muda visualmente (apenas adega)

1. **Imagem à direita mais respirável**
   - Trocar `w-24 h-24 object-cover` por `w-28 h-28 object-contain bg-muted p-1.5` — garrafas/latas de bebida ficam melhor com `contain` (não corta gargalo) e com leve fundo neutro.
   - Sem sombra pesada; borda arredondada mantida.

2. **Hierarquia do texto**
   - Nome do produto: manter `text-sm font-bold`, mas permitir `line-clamp-2` (hoje é 1) — nomes de bebidas costumam ter marca + volume.
   - Subtítulo unificado da adega (marca · volume · teor alcoólico quando houver) em uma única linha `text-[11px] text-muted-foreground`, substituindo o bloco atual solto.

3. **Badges enxutas**
   - Mostrar no máximo 2 badges na linha superior para adega (prioridade: Promoção → Pack → Temperatura). As demais (Casco, Bestseller) descem para a linha do subtítulo como texto discreto, evitando poluição.
   - Nenhuma cor nova — reutilizar as classes já existentes.

4. **Preço + CTA melhor alinhados**
   - Preço em `text-base font-black` (hoje `text-sm`), com preço/unidade (`R$ x,xx/un`) logo abaixo quando `pack_qty > 0`.
   - Botão "Adicionar" continua com o mesmo estilo/cor já usado nas outras categorias.

5. **Espaçamento do card**
   - Padding do card: `p-3` → `p-2.5` no adega para compactar levemente e caber melhor a imagem 28.
   - `gap-3` mantido entre texto e imagem.

## O que NÃO muda
- Nenhuma cor, gradiente, sombra ou token do design system.
- Nenhum comportamento (clique, quick-add, modal, filtros de tipo/ordenação de adega).
- Nenhuma outra categoria.
- Nenhuma alteração de dados/schema.

## Detalhes técnicos
- Introduzir uma flag local `const isAdega = cat === "adegas"` dentro de `ProductCard` (já existe `cat`), usada só para ajustar classes de imagem, clamp do nome, tamanho do preço e limite de badges.
- Manter `isAdegaCard = false` (layout horizontal), como está hoje.
- Consolidar o subtítulo de adega (marca/volume/álcool) em um único `<p>`; remover o bloco duplicado atual em `~L2087-2093`.
- Bump de versão (`APP_VERSION` + `versionName`/`versionCode`) ao aplicar.

## Verificações após implementar
- Abrir loja Gelobol (`/gelobol`) na aba "Refrigerantes e Sucos" e conferir alinhamento.
- Conferir que categorias não-adega (`pastelao-carioca`, restaurante, etc.) continuam idênticas.
- Revisão rápida de segurança: sem mudança de dados/RLS/edge, apenas UI — nada a ajustar.