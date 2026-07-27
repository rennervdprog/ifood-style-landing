
## Objetivo
Fazer a aba **Busca** funcionar com a localização real do cliente e mostrar a distância até a loja em cada card (ex: `1,2 km`), estilo iFood/99/Rappi.

Escopo: só frontend/apresentação. Nada de mudar regras de taxa, backend ou pedidos.

---

## 1. Localização do cliente (fonte da verdade)

Já existe o hook `useUserLocation()` (`src/hooks/useUserLocation.ts`) que retorna `coords`, `city`, `state`. Ele **não** dispara prompt sem gesto — só lê se a permissão já foi concedida.

Ajustes na `ClientBuscaPage.tsx`:
- Se `userLocation.ready && !userLocation.coords` → mostrar uma **faixa fina no topo do conteúdo** (abaixo do header): "📍 Ative a localização para ver a distância das lojas" com botão **"Usar minha localização"** que chama `userLocation.refresh()` (esse já usa `readGpsFromGesture` síncrono, respeita a política do Android/iOS).
- Se `coords` existir → texto atual "Em alta em {cidade}" continua; nada muda visualmente.
- Sem localização, a lista continua funcionando (só sem distância e sem ordenação por distância — cai no comportamento atual).

## 2. Cálculo da distância

Já pronto em `src/pages/cliente/utils/mapStores.ts` — `mapStoresWithHours` já injeta `distanceKm` (haversine, em km) quando há `userCoords` + `latitude/longitude` da loja. Não precisa mexer.

Formatação (helper novo, inline no arquivo da busca ou em `src/lib/formatDistance.ts` simples):
```
< 1 km  → "900 m"
< 10 km → "1,2 km"
≥ 10 km → "12 km"
```

## 3. Onde mostrar a distância

Nos **cards de loja** da aba Busca:
- **`StoreRow`** (lista de categoria / resultado de busca): adicionar o pill de distância na linha do tempo/taxa:
  `20-35 min · 1,2 km · Entrega R$ 4,99`
- **Carrossel "Em alta"**: badge pequeno sobre a imagem, canto inferior esquerdo (`1,2 km`), fundo `bg-black/60 text-white`.
- **Carrossel "Novidades"**: mesmo badge.

Se `distanceKm` for `null` (sem GPS ou loja sem coordenadas), oculta o campo — não mostra placeholder.

## 4. Ordenação

`mapStoresWithHours` já ordena: abertas primeiro → mesma cidade → menor distância. Manter.

Ajuste pequeno em `categoryStores` e `searchResults`: eles hoje só filtram, herdam a ordem do `stores`. Ok, sem mudança.

## 5. Versão

Bump patch nos dois lugares (PerfilPage.tsx e android/app/build.gradle + versionCode +1). Sem novo APK necessário (mudança só de UI web, OTA cobre).

---

## Arquivos afetados
- `src/pages/cliente/busca/ClientBuscaPage.tsx` — faixa "ativar localização", pill de distância em `StoreRow`, badge nos carrosséis.
- `src/lib/formatDistance.ts` **(novo, pequeno)** — helper `formatDistanceKm(km)`.
- `src/pages/PerfilPage.tsx` + `android/app/build.gradle` — bump de versão.

## Fora de escopo
- Não muda cálculo de taxa de entrega (continua `describeStoreFee`).
- Não muda a home `/cliente` (só a aba Busca). Se quiser depois replico o mesmo padrão lá.
- Não usa Google Distance Matrix — haversine (linha reta) já é o padrão do iFood na listagem; roteamento real (OSRM) só na tela do carrinho, que já existe.
