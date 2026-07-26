# Plano: Nova aba "Busca" (estilo iFood)

Inspirada no iFood, mas com identidade ItaSuper — não é cópia. Vira a segunda aba do BottomNav do `/cliente`.

## 1. Estrutura / navegação

- Nova rota: `/cliente/busca`
- Adicionar item no `BottomNav.tsx`: Início · **Busca** · Pedidos · Perfil
- Ícone: `solar:magnifer-bold-duotone` (Iconify, já instalado)
- Lazy-load da página

## 2. Layout da tela `/cliente/busca` (estado inicial)

Ordem vertical:

1. **Search bar sticky no topo**
   - Placeholder rotativo: "Pizza em 30 minutos", "Hambúrguer artesanal", "Marmita fitness"…
   - Ao focar → abre modo "resultados" (ver seção 4)

2. **Seção "Categorias"** (grid 2 colunas, cards coloridos com imagem à direita)
   Categorias reais da base (`stores.category` / tags):
   - Lanches (laranja)
   - Pizzaria (vermelho)
   - Marmita / Restaurante (âmbar)
   - Açaí / Sobremesa (roxo)
   - Bebidas (coral)
   - Mercado (verde)
   - Farmácia (azul)
   - Promoções (magenta — filtro `has_active_coupon`)
   
   Cada card = filtro que abre lista de lojas daquela categoria.

3. **Seção "Em alta em Itatinga"** — carrossel horizontal de lojas mais pedidas (rating desc, pedidos últimos 7d)

4. **Seção "Novidades"** — lojas criadas nos últimos 30 dias

## 3. Tela de categoria `/cliente/busca/:categoria`

Header simples "LANCHES" + botão voltar + share.

Filtros chip horizontais (scroll):
- Ordenar (relevância / avaliação / tempo / taxa)
- Entrega grátis (own_delivery_fee = 0)
- Turbo (estimated_delivery_time ≤ 30 min)
- Aberto agora

Lista vertical de lojas com o **mesmo card** já usado em `ClientHomeContent.tsx` (logo redondo, nome, rating real, tempo, taxa calculada com split R$ 0,99). Reutilizar componente — sem duplicar código.

Badge "Mais Pedido" nas top 3 da categoria.

## 4. Modo busca ativa

Ao digitar no input:
- Debounce 250ms
- Busca em `stores.name`, `products.name`, `stores.category`
- Duas seções nos resultados: **Lojas** e **Pratos** (com preço + loja de origem)
- Histórico de buscas recentes em localStorage (últimas 5)
- Sugestões populares quando vazio

## 5. Design / tokens

- **Não copiar cores do iFood** (nada de vermelho #EA1D2C)
- Usar paleta atual ItaSuper: `--primary` + accents já definidos
- Cards de categoria com gradientes vindos de `--gradient-*` do design system
- Tipografia atual, sem fontes novas
- Safe-area top/bottom respeitada (Capacitor)

## 6. Detalhes técnicos

- Página: `src/pages/ClientBuscaPage.tsx` (lazy)
- Componentes novos: `SearchCategoryCard`, `SearchChipFilters`, `SearchResults`
- Reuso: `StoreListCard` extraído de `ClientHomeContent.tsx` para arquivo próprio
- Query: uma única RPC `search_stores_and_products(term, category, filters)` no Supabase externo pra evitar 2-3 roundtrips
- Cache: React Query com `staleTime: 60s` nas categorias/em-alta
- Realtime: OFF (já removido do plano de IO)

## 7. Fora do escopo

- Filtro por Vale-refeição (não temos integração)
- "Super Restaurantes" / assinatura de frete grátis
- Mapa de lojas próximas (fica pra fase 2)

## 8. Versionamento

Bump patch (`PerfilPage.tsx` + `android/app/build.gradle` versionName + versionCode+1) ao final da implementação.

---

Se aprovar, implemento tudo em uma leva e te aviso a nova versão.
