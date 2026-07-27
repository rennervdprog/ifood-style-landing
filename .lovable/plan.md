# Plano — Fonte única da verdade para endereço/GPS

Objetivo: eliminar divergência entre card, checkout, frete e admin. Uma coordenada por entidade, um algoritmo de distância, um seletor visual de pino no mapa.

---

## Fase 1 — Unificar cálculo de distância (2–3 dias, maior impacto)

**Problema:** card usa haversine, checkout usa OSRM → diferença 20–40% entre "1,2 km no card" e frete real.

- Criar hook `useStoreDistance(store, customer)` que chama sempre `resolveDistance()` (edge `calculate-delivery-distance`, já pronta, com cache).
- Substituir em `mapStoresWithHours.ts`: em vez de haversine local, disparar batch para a edge (uma chamada com N lojas) e cachear no `sessionStorage` por (customerCoords, storeId).
- Card de loja passa a mostrar **km da rota real** (mesmo número que aparece no checkout).
- Fallback: se edge falhar, mostra haversine × 1.3 (mesma constante da edge) e marca `approximated: true` internamente.

Arquivos: `src/pages/cliente/utils/mapStores.ts`, `src/hooks/useStoreDistance.ts` (novo), `src/pages/cliente/busca/ClientBuscaPage.tsx`, `src/pages/ClientHome.tsx`.

---

## Fase 2 — lat/lng persistido em loja e endereço do cliente (3–5 dias)

**Problema:** hoje só CEP é salvo; toda vez re-geocoda no Nominatim (lento, 1 req/s, inconsistente).

- Migration: garantir `latitude`/`longitude` em `stores` e `customer_addresses` (nullable), + trigger que geocoda no `INSERT/UPDATE` quando coords estiverem null e CEP/endereço estiverem preenchidos (chama edge `geocode-address`).
- Backfill: edge oneshot que percorre lojas/endereços sem coord e popula.
- Front (cadastro de loja e endereço do cliente): ao salvar, se tiver coords do pino no mapa (Fase 3), usa direto; senão dispara geocode server-side.
- Todas as leituras passam a usar `latitude`/`longitude` da tabela; nunca mais geocodar em runtime na home/busca.

---

## Fase 3 — Seletor de pino no mapa (3–4 dias)

**Problema:** GPS chuta 30–100m de erro; usuário não confirma o ponto.

- Componente `<AddressPinPicker>` com Leaflet + tiles OSM (grátis, sem key).
- Fluxo: usuário clica "usar GPS" → mapa abre centrado no GPS → pino arrastável → botão "Confirmar este ponto" salva `{lat, lng, accuracy: 'user_pinned'}`.
- Usado em 3 lugares: cadastro de endereço do cliente, cadastro de loja, edição de endereço no checkout.
- Reverse geocode automático ao soltar o pino preenche rua/bairro (usuário só confirma número).
- Persistência: grava lat/lng no banco (Fase 2) com flag `pin_confirmed=true`.

---

## Fase 4 — Limpeza e consistência (2 dias)

- Remover haversine local dos componentes (sobra só como fallback dentro da edge).
- Remover hardcode "Itatinga" de qualquer default.
- Exibir `warning` de divergência GPS×CEP (>2km) no checkout: banner "Sua localização GPS está longe do CEP cadastrado — confirme o endereço".
- Padronizar formatação: `formatDistanceKm` já existe, aplicar em todo lugar (checkout, admin, tracking).
- Documentar em `docs/localizacao.md`: fluxo único, quem grava, quem lê.

---

## Detalhes técnicos

- **Edge `calculate-delivery-distance`** já tem cache no banco (`geocode_cache`) — não precisa recriar.
- **Capacitor**: `readGpsFromGesture()` já respeita política Android/iOS; nada muda.
- **RLS**: novas colunas herdam policies existentes das tabelas.
- **Sem quebra**: cada fase é independente e reversível.

## Fora de escopo
- Não muda cálculo de taxa de entrega (`describeStoreFee` continua igual, só recebe km mais preciso).
- Não troca provider de mapa/geocode (Nominatim + OSRM ficam).
- Não mexe em tracking do entregador (já usa OSRM próprio).

## Ordem recomendada
Fase 1 primeiro (resolve a queixa principal em 2 dias). Depois 2 → 3 → 4.
