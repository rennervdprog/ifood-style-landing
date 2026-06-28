## Rota Otimizada Profissional — 100% gratuito, app-first

Filosofia: o **app é o cérebro** (rota, pins, dados do cliente, confirmação por código). O **Maps/Waze é só o GPS turn-by-turn**, aberto sob demanda e devolvendo o entregador pro nosso app assim que ele chega na parada.

---

### Fase 1 — Roteamento real por ruas (OSRM público, grátis)

Trocar Haversine (linha reta) pela matriz real de tempo/distância via `router.project-osrm.org` — sem chave, sem cota prática.

- Novo `src/lib/routing/osrmClient.ts`: `getDistanceMatrix(points)` + `getRouteGeometry(points)` (polyline real desenhada no mapa).
- Cache em `localStorage` (24h, chaveado por par lat/lng arredondado a 5 decimais) → zera chamadas repetidas.
- Fallback automático pra Haversine se OSRM falhar (badge "rota aproximada").

### Fase 2 — Otimizador melhor (até 50 paradas)

Manter `optimizeRoute` atual, mas extrair pra `src/lib/routing/optimizer.ts` e somar:

- **Or-opt** (move blocos de 1–3 paradas) em cima do 2-opt já existente.
- Subir o teto de 20 → 50 paradas.
- Re-otimização automática quando: novo pedido entra, parada concluída, ou GPS deslocou > 300m da última otimização (com debounce 5s pra não tremer).

### Fase 3 — Mapa próprio no app com pins por cliente

Adicionar **Leaflet + tiles OSM** (gratuitos, sem chave, ~40KB lazy-loaded só na tela do entregador) num novo `src/components/driver/DriverRouteMap.tsx`:

- Pin **numerado 1, 2, 3...** em cada cliente, na ordem otimizada.
- Cor por status: azul=pendente, amarelo=em rota, verde=entregue.
- **Tap no pin** → bottom-sheet `DriverStopSheet.tsx` com: nome, telefone (ligar/WhatsApp), valor, forma de pagamento, troco, observação, endereço.
- Polyline OSRM desenhada conectando todas as paradas.
- Pin ao vivo do entregador (já temos `driverGeolocation.ts`, refresh 8s) + pin da loja como origem.

> Por que mapa próprio: Maps/Waze externos **não** permitem pins customizados nem mostrar nome/telefone/valor por parada. Esses dados precisam viver no nosso app.

### Fase 4 — Fluxo "Navegar → Maps → Voltar pro app → Código de entrega"

Esse é o coração do pedido. Cada bottom-sheet de parada tem **um botão grande "Iniciar navegação"** que:

1. Marca a parada como `em_rota` no banco (status visual amarelo).
2. Dispara deep link Waze/Maps **apenas pra essa parada** (`waze://?ll=lat,lng&navigate=yes` ou Google Maps `geo:lat,lng?q=lat,lng`).
3. Em paralelo, ativa um **watcher de geolocalização** (`watchPosition`) com raio de 80m da parada.

Quando o entregador chega (GPS entra no raio) **ou** ele volta manualmente pro app:

- Disparamos `Capacitor LocalNotifications` + haptic médio: **"Você chegou — digite o código de entrega"**.
- Bottom-sheet abre automaticamente em `DeliveryCodeSheet.tsx` com:
  - Teclado numérico grande (4 dígitos).
  - Foto opcional do comprovante (cliente assinou, embalagem entregue).
  - Botão "Cliente ausente" (registra tentativa e mantém na rota).
- Código validado contra `orders.delivery_code` (campo já existe). Marca `entregue` + grava `delivered_at` + libera ganho do entregador.
- Re-otimização automática da rota restante.

Botão secundário no card: **"Rota completa no Maps"** (deep link com até 9 waypoints) — pra quem prefere navegação contínua sem voltar entre paradas. Mas o fluxo padrão é parada-a-parada com retorno (mais confiável pro código).

### Fase 5 — ETA real e progresso

Usar tempos da matriz OSRM:

- Card topo: "Rota: 4 paradas • 8,4 km • 23 min".
- Cada pedido: "chega em ~7 min".
- Cliente vê ETA real dele no `LiveTrackingMap.tsx` (público).
- Atualiza a cada movimento significativo do GPS.

### Fase 6 — Geocoding de fallback (pedidos sem lat/lng)

Hoje cai num centroide de bairro. Melhorar:

- Nova edge function `geocode-order-address` chama **Nominatim** (OSM, grátis, 1 req/s) com rua+número+bairro+cidade.
- Resultado salvo em `geocode_cache` (já existe) + grava `orders.client_lat/lng`.
- Roda em background quando pedido passa pra "Pronto pra rota" — não bloqueia UI.

### Fase 7 — Offline e resiliência

- Cache OSRM persistido em IndexedDB (matrizes por região, 7 dias).
- Tiles Leaflet via service worker (PWA já configurado).
- Watcher de geofence continua rodando em background com `BackgroundGeolocation` já presente.
- Se OSRM cair: Haversine + badge discreto "rota aproximada".

### Fase 8 — UX final no card "Sua Rota"

- Mapa em cima (45% da tela), lista numerada de paradas embaixo.
- **Drag-and-drop** pra reordenar manualmente (override do algoritmo).
- Swipe-to-complete em cada item.
- Botão "Re-otimizar" se entregador pegou pedido novo no meio.
- Indicador "Próxima parada em 280m" sempre visível no topo.

---

### Arquivos afetados

**Novos:**
- `src/lib/routing/osrmClient.ts` — matriz + geometria OSRM
- `src/lib/routing/optimizer.ts` — 2-opt + Or-opt (extrair de StoreDriverView)
- `src/lib/routing/cache.ts` — localStorage + IndexedDB
- `src/lib/routing/navDeepLinks.ts` — Waze/Maps deep links + return-to-app
- `src/lib/routing/arrivalWatcher.ts` — geofence 80m + dispara notificação
- `src/components/driver/DriverRouteMap.tsx` — Leaflet com pins próprios
- `src/components/driver/DriverStopSheet.tsx` — dados do cliente
- `src/components/driver/DeliveryCodeSheet.tsx` — teclado de código + foto
- `supabase/functions/geocode-order-address/index.ts`

**Editados:**
- `src/components/StoreDriverView.tsx` — usa novo otimizador, embute mapa, integra fluxo
- `src/lib/driverGeolocation.ts` — gatilho de re-otimização e geofence
- `src/components/LiveTrackingMap.tsx` — ETA real pro cliente

**Banco:** zero migração. Usa `orders.delivery_code`, `client_lat/lng`, `geocode_cache`, `driver_locations` — já existem.

**Dependência nova:** `leaflet` + `react-leaflet` (lazy só na tela do entregador).

---

### Custo
**Zero.** OSRM público + tiles OSM + Nominatim + deep links Waze/Maps são gratuitos e sem chave.

### Ordem sugerida
**Fase 1 + 3 + 4 primeiro** — esse é o salto: rota real, mapa com pins, fluxo navegar-e-voltar com código. Depois 2, 5, 6, 7, 8.

---

**Perguntas antes de implementar:**

1. **Geofence de chegada:** raio padrão de 80m está bom, ou prefere 50m (mais preciso, mais falso-negativo em prédios) / 120m (mais tolerante, dispara antes)?
2. **Código de entrega:** já temos `orders.delivery_code` no banco — ele é gerado automaticamente hoje pra todo pedido, ou só pra alguns? Se for opcional, deixo o fluxo aceitar "sem código" (só foto/assinatura)?
3. **Maps ou Waze:** abrir sempre o Waze (padrão motoboy), sempre Google Maps, ou deixar o entregador escolher na primeira vez e lembrar?