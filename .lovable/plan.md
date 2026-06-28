# Plano: Unificação do Sistema GPS / CEP / Endereço

Hoje a lógica de localização está espalhada: `useUserLocation`, `deviceLocation`, `addressGeocoding`, `cepLookup`, `deliveryDistance`, `arrivalGeofence`, `osrmRouting` + reverse geocode inline em várias páginas. Cada tela trata permissão GPS, fallback CEP e cache do seu jeito. Vamos consolidar tudo num único módulo `@/lib/location/*` com API estável e usar em todos os fluxos (lojista, cliente, taxa, rota do motoboy).

---

## Fase 1 — Núcleo `@/lib/location` (fundação)

Criar um módulo único, sem mudar comportamento ainda:

```text
src/lib/location/
  index.ts              // API pública
  permissions.ts        // checar/solicitar/forçar GPS (Capacitor + Web)
  gps.ts                // getDeviceGPS + watchPosition + cache
  cep.ts                // fetchCep (ViaCEP → BrasilAPI), cache persistente
  geocode.ts            // address → coords (Nominatim, com fila + retry)
  reverse.ts            // coords → endereço BR (Nominatim, com cache)
  distance.ts           // resolveDistance (OSRM + haversine fallback)
  cache.ts              // cache unificado (sessionStorage + memória + TTL)
  types.ts              // Coordinates, AddressContext, Resolved*, etc.
```

Regras:
- **Cache único** com TTL por tipo (GPS 5min, reverse 24h, CEP permanente, geocode 7 dias).
- **Fila serializada** para Nominatim (1 req/s, evita 429).
- **Telemetria** opcional via `console.debug` com prefixo `[loc]`.

## Fase 2 — Permissão GPS "forçada" no navegador

Não dá pra ativar GPS do SO via JS, mas dá pra resolver 90% dos casos:

- **Web:** chamar `navigator.permissions.query({name:'geolocation'})`. Se `denied`, abrir modal explicativo com instruções específicas por navegador (Chrome/Safari/Firefox) e botão "Tentar novamente" que re-chama `getCurrentPosition` (browsers como Chrome reabrem o prompt se o usuário limpou a permissão). Detectar `chrome://settings/content/location` e mostrar print/passo a passo.
- **PWA instalado / Android Chrome:** se permissão do site OK mas SO desligado, capturar `POSITION_UNAVAILABLE` e oferecer CTA "Usar endereço cadastrado" automaticamente.
- **Capacitor (APK):** já temos `capacitor-native-settings` — manter, e adicionar abertura direta para `LOCATION_SOURCE_SETTINGS` quando `code=2`.
- Componente único `<LocationPermissionDialog />` reutilizável em todas as telas.

## Fase 3 — Resolver de endereço unificado (`resolveAddress`)

API única que toda tela chama:

```ts
resolveAddress({
  prefer: "gps" | "address" | "auto",
  fallback: ["gps", "cep", "address"],
  address?: AddressContext,
}) => { coords, address, source, accuracy, warnings }
```

Funciona assim:
1. Tenta `prefer` primeiro.
2. Se falhar, percorre `fallback` em ordem.
3. GPS → `reverse()` para popular `address`.
4. CEP/endereço → `geocode()` para popular `coords`.
5. Retorna sempre o melhor disponível + nível de confiança.

## Fase 4 — Migrar cadastros

- **Lojista (`StoreSettings`, `CadastroLojista`):** trocar geocoder inline pelo `resolveAddress({prefer:"address"})`. Após salvar CEP, autopreencher lat/lng e mostrar pin num mini-mapa Leaflet (já temos) pra lojista corrigir arrastando.
- **Cliente (`CheckoutPage`, `saved_addresses`, `ClientHomeContent`):** mesmo helper. Botão "Usar minha localização" usa `prefer:"gps"` com fallback CEP. Reverse automático preenche rua/bairro.
- **Endereços salvos:** garantir que toda gravação em `saved_addresses` tenha `lat/lng`. Migration leve pra completar registros antigos via job.

## Fase 5 — Taxa de entrega à prova de falha

`calculate-delivery-distance` (edge) já existe. Vamos:
- Aceitar **qualquer combinação**: gps cliente, endereço cliente, só CEP.
- Tentar cadeia: GPS+OSRM → endereço+OSRM → CEP+OSRM (centroide) → haversine.
- Retornar `accuracy` ("gps" / "address" / "cep" / "fallback") pro front mostrar selo "📍 Localização precisa" / "⚠ Estimativa por CEP".
- Cache no `geocode_cache` (tabela já existe) por hash da entrada.
- Front (`CheckoutPage`) chama uma única vez via `resolveDistance()` e mostra estado claro: calculando / preciso / estimado / falhou (com botão tentar GPS).

## Fase 6 — Rastreio do motoboy (aba Pedidos)

Hoje o cliente vê pouca info quando motoboy sai. Vamos:

- Página `PedidoTracking` (cliente) + card na aba Pedidos do admin com **mapa Leaflet** mostrando:
  - Pin do motoboy (atualiza via realtime `driver_locations`).
  - Pin do cliente.
  - Linha da rota OSRM (cacheada).
  - ETA recalculado a cada update GPS do motoboy (km restante ÷ 25km/h, ajustado por trânsito básico).
- Subscription única em `driver_locations` filtrada por `order_id`.
- Geofence reverso: quando motoboy entra em 80m do cliente, push "Seu pedido chegou!" + status visual.
- Reuso 100% do novo `@/lib/location`.

## Fase 7 — Limpeza

- Remover `useUserLocation`, `deviceLocation.ts`, `addressGeocoding.ts`, `cepLookup.ts` (re-exports temporários por 1 versão pra não quebrar imports).
- Substituir todos os `fetch("https://nominatim...")` espalhados.
- Testes: `src/lib/location/__tests__/` cobrindo permissão negada, CEP inválido, fallback, cache.
- Atualizar `mem://` com a nova API.

---

## Estratégia de rollout

Trocar o pneu com o carro andando: cada fase é independente e mantém os módulos antigos como shim re-exportando. Sem big bang. Versão bumpa a cada fase entregue.

## Perguntas antes de começar

1. **Mapa do motoboy (Fase 6)** já confirmado Leaflet+OSM (gratuito), ok?
2. **Ordem de execução:** começar pela Fase 1+2+3 (fundação + permissões), depois 5 (taxa), 6 (tracking) e por último 4 (migração de telas)?
3. Posso **manter shims** dos módulos antigos por 1 versão ou prefere quebrar tudo de uma vez?
