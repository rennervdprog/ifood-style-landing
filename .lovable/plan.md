# Redesign /cliente — Marketplace Profissional

Sai o feed genérico de blocos empilhados. Entra um **bento grid editorial** com hierarquia real, densidade calibrada e tipografia Sora/Manrope. Paleta ItaSuper mantida (amarelo `#FACC15` sobre fundo claro, acentos `hsl(var(--primary))`).

## Princípios visuais

- **Sora** nos títulos (bold, tracking justo) — Manrope no corpo. Aplicados via `tailwind.config.ts` como `font-display` / `font-sans`.
- Cantos `rounded-3xl` nos cards grandes, `rounded-2xl` nos médios, `rounded-xl` nos pills.
- Sombra sutil `shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)]` só nos cards de destaque.
- Zero cores hardcoded — tudo via tokens `--background`, `--primary`, `--card`, `--muted`.
- Skeleton nas 3 seções principais (não spinner).

## Estrutura da nova home

```text
┌──────────────────────────────────────────┐
│ HEADER STICKY (endereço + sino + chat)   │
│ Search pill + botão filtros              │
├──────────────────────────────────────────┤
│ BENTO HERO (2 colunas mobile)            │
│ ┌────────────┬──────────────┐            │
│ │            │  Cashback    │            │
│ │  Banner    ├──────────────┤            │
│ │  principal │  Frete grátis│            │
│ └────────────┴──────────────┘            │
├──────────────────────────────────────────┤
│ Chips categorias (scroll horizontal)     │
├──────────────────────────────────────────┤
│ SUAS LOJAS (avatars circulares)          │
├──────────────────────────────────────────┤
│ ÚLTIMO PEDIDO (card premium refinado)    │
├──────────────────────────────────────────┤
│ DESTAQUES DA REGIÃO (bento 2x2)          │
│ ┌──────────┬─────┐                       │
│ │  Loja    │Loja │                       │
│ │  grande  ├─────┤                       │
│ │          │Loja │                       │
│ └──────────┴─────┘                       │
├──────────────────────────────────────────┤
│ DESCUBRA (produtos, grid editorial 2 col)│
│ Cards com preço grande, loja em pill,    │
│ tag "aberta agora", rating inline        │
├──────────────────────────────────────────┤
│ TODAS AS LOJAS (lista rica)              │
└──────────────────────────────────────────┘
```

## Seções detalhadas

**1. Header** — mantém, só ajusta tipografia para Sora e reduz padding vertical.

**2. Bento Hero (novo)** — substitui o `PromoBanners` atual. Grid `grid-cols-3 grid-rows-2`: banner principal ocupa `col-span-2 row-span-2`; 2 mini-cards laterais (cashback, frete grátis) fixos com ícone + micro-copy. Dados vêm de `banners` (já existe).

**3. Categoria chips** — mantém `CategoryChips` mas com pills `bg-muted` + estado ativo `bg-primary text-primary-foreground`, altura 40px, sem borda.

**4. Suas lojas** — mantém, refina para avatars 56px com anel `ring-2 ring-primary/20` quando aberta.

**5. Último pedido** — card premium com gradient sutil `from-primary/5 to-transparent`, botão "Pedir de novo" em destaque.

**6. Destaques da região (redesenhado)** — substitui a rolagem horizontal "Destaques" por um **bento 2x2**: 1 loja grande (imagem 16:10 + overlay com nome, rating, tempo) + 2 lojas pequenas empilhadas à direita (avatar + nome + distância). Muito mais denso e visual que o carrossel atual.

**7. Descubra (refinado, o que ficou genérico)** — grid 2 colunas com cards editoriais:
   - Imagem aspect-square, corner-radius `rounded-3xl` só no topo
   - Overlay inferior com gradient preto→transparente
   - Nome do produto em Sora bold branco sobre a imagem
   - Preço em pill amarelo flutuante no canto superior direito
   - Nome da loja em pill `bg-background/90 backdrop-blur` sobre a imagem
   - Micro-tag "aberta" com ponto verde pulsante
   - Ordena por: aberta primeiro, com imagem, aleatório dentro disso

**8. Todas as lojas** — lista vertical mantida, refinada com Sora e espaçamento `space-y-4`.

## Arquivos

- `src/pages/cliente/home/ClientHomeContent.tsx` — refatorar seções
- `src/pages/cliente/home/BentoHero.tsx` — novo
- `src/pages/cliente/home/HighlightsBento.tsx` — novo (destaques 2x2)
- `src/pages/cliente/home/DiscoverGrid.tsx` — extrair produtos e reestilizar
- `tailwind.config.ts` — adicionar `fontFamily: { display: ["Sora", ...], sans: ["Manrope", ...] }`
- `index.html` — preload Google Fonts Sora + Manrope
- `src/index.css` — utilitário `.font-display` (fallback) e classe `.card-elevated`

## Detalhes técnicos

- Query `discover-products` ganha filtro `.order("created_at", { ascending: false })` + shuffle client-side dos 40 mais recentes → 12 finais. Mantém aleatoriedade sem parecer bagunçado.
- Prefetch da loja no `onPointerEnter` dos cards de Descubra (padrão que já usamos em `StoreCard`).
- Todos os cards com `loading="lazy"` e `decoding="async"` (mantém).
- Suspense boundary por seção com `useDelayedFallback(180)`.

## Versão

Bump para **v1.25.41** em `src/lib/appVersion.ts` e `android/app/build.gradle` (versionCode 10004).

Aprova pra eu implementar?