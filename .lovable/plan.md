
## Contexto

A listagem "Todas as lojas em itatinga" (screenshot) é renderizada **inline** em `src/pages/cliente/home/ClientHomeContent.tsx` (linhas 588–657) — não usa o `StoreCard.tsx` que refiz antes. Por isso a alteração anterior não apareceu. Cards atuais têm ícone circular laranja genérico e info pobre (só categoria + Aberto).

## Objetivo

Trocar por linhas estilo iFood com **dados reais** do lojista: thumbnail quadrado da loja, avaliação, tempo de entrega estimado, taxa de entrega real (loja + plataforma) e distância. Zero mock.

## Fontes de verdade (dados reais)

- **Thumbnail:** `store.image_url` (quadrado 64px arredondado, fallback ícone loja).
- **Rating:** `store.rating` (só mostra se > 0; senão "Novo").
- **Distância:** `store.distanceKm` (já calculado em `mapStoresWithHours`).
- **Tempo de entrega:** ler `store.settings.delivery_time_min` / `delivery_time_max` se o lojista configurou; caso contrário estimar `20 + round(distanceKm * 4)` até `+15min` (mesma fórmula do `StoreCard` row).
- **Taxa de entrega:**
  - `delivery_mode === "pickup"` → "Retirada".
  - `delivery_fee_type === "km"` → "A partir de R$ X" usando `delivery_fee_base`.
  - Fixa → `own_delivery_fee`.
  - Somar `platform_split` (taxa operacional, hoje R$ 0,99 default em `deliveryFee.ts`) para exibir o valor **final** que o cliente pagará — fonte única de verdade.
  - Se total = 0 → "Grátis" em verde.
- **Status fechado:** mantém `statusReason` embaixo (ex.: "Abre às 18:00").

## Ajustes de query

Incluir no `PUBLIC_STORE_SELECT` os campos que faltam: `delivery_fee_type, delivery_fee_base, delivery_fee_per_km, platform_split, settings` (settings já vem). Nada de N+1.

## UI (apenas frontend)

Substituir o bloco `<ul>` da seção "Todas as lojas" em `ClientHomeContent.tsx` por:

```
[img 64x64 rounded-xl]  Nome da loja                    ⭐ 4.8
                        Categoria • 1,2 km
                        25–40 min • Grátis / R$ 6,99
                        [FECHADA — Abre 18:00]  (só se fechada)
```

- Divisor sutil `border-b border-border/40` entre linhas (padrão iFood).
- Loja fechada: `grayscale opacity-60` na imagem + badge "Fechada" vermelha discreta.
- Taxa grátis: texto verde-esmeralda em bold; taxa paga: preto seminegrito.
- Distância com pino pequeno; separadores `•` entre metadados.
- Sem card com sombra — visual limpo de lista.

## Arquivos afetados

- `src/pages/cliente/home/ClientHomeContent.tsx` — trocar o bloco `<ul>` (linhas ~588–657) e ampliar `PUBLIC_STORE_SELECT`.
- `src/pages/cliente/utils/mapStores.ts` — passar `platform_split` default se ausente e calcular `totalDeliveryFee` já no map (evita cálculo no render).
- Bump versão para v1.25.85 em `src/lib/appVersion.ts`, `src/pages/PerfilPage.tsx` e `android/app/build.gradle` (+ `versionCode`).

## Fora de escopo

- Não mexer em backend, RPC `store_bootstrap` (campos já retornados via `select *`).
- Não alterar `StoreCard.tsx` do marketplace, nem outras telas.
- Sem novas dependências.

Confirma que sigo com a implementação?
