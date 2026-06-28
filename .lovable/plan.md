
# Plano — App Parceiro Nativo (foco Entregador)

Objetivo: transformar o APK Parceiro num app que **parece e responde como nativo** quando rodando em Capacitor, mantém o design web atual quando aberto no navegador, e extrai 100% de desempenho da WebView Android.

---

## 1. Detecção de runtime + design duplo (Native vs Web)

Hoje o mesmo JSX é usado em browser e APK. Vamos introduzir uma camada de "shell":

- Criar `src/lib/runtime.ts` com `isNative()`, `isPartnerNative()`, `getPlatform()` (já temos `capacitorNative.ts` + `capacitorAppMode.ts` — vamos consolidar e exportar um hook único `useRuntime()`).
- Criar `src/components/native/` com primitivas com cara de app:
  - `NativeShell` (status bar colorida, safe-area `env(safe-area-inset-*)`, sem header web)
  - `NativeTopBar` (back nativo + título centralizado, altura 56dp)
  - `NativeBottomTabs` (tabs fixas: Pedidos / Mapa / Ganhos / Perfil) — só monta se `isNative()`
  - `NativeListRow`, `NativeSheet` (bottom-sheet com gesto), `NativeFab`
- `DriverDashboardV2` vira um **router visual**:
  - `isNative()` → renderiza `<DriverNativeShell>` (layout de app, gestos, haptics, sem scroll horizontal, sem hover states)
  - senão → mantém layout web atual
- Tokens próprios em `index.css` sob `.native-app { … }`: tipografia maior (16px base), toque mínimo 48dp, espaçamento compacto, sombras flat estilo Material 3 / iOS.

## 2. Boas práticas Capacitor (config + bootstrap)

- `capacitor.config.ts`:
  - **Remover `server.url`** do APK de produção do entregador. Hot-reload via URL remoto mata performance, perde offline e quebra deep-links. Manter só para o app cliente se necessário; entregador roda bundle local + auto-update via `@capacitor/app` checando versão.
  - `android.useLegacyBridge: false`, `android.captureInput: true`, `android.backgroundColor: "#0B0F14"`.
  - `webContentsDebuggingEnabled: false` em release (já está).
- Bootstrap nativo (`src/lib/nativeBoot.ts`):
  - `StatusBar.setStyle({ style: Dark })`, `setBackgroundColor`, `setOverlaysWebView(false)`.
  - `Keyboard.setResizeMode({ mode: 'native' })` + `setScroll({ isDisabled: true })`.
  - `SplashScreen.hide()` só depois do primeiro paint útil (após auth resolvido).
  - `App.addListener('backButton')` controlado (sair = double-tap, voltar = router).
  - `Network.addListener('networkStatusChange')` → banner offline + pausa de polling.

## 3. Performance da WebView (alvo: 60fps)

- **Code-splitting agressivo do APK Parceiro**: criar `src/main.partner.tsx` com rotas só de parceiro (entregador / admin / pdv), via `VITE_CAPACITOR_APP_MODE=partner` no build Android. Hoje o APK baixa bundle inteiro (loja cliente, blog, landing) — corte estimado: ~40-60% do JS.
- **Lazy-load** de `recharts`, `framer-motion`, `LiveTrackingMap`, builders de pizza/pastel — nada disso é usado pelo entregador.
- **React Query no APK**: `staleTime` maior (30s), `gcTime` 5min, `refetchOnWindowFocus: false` (não existe focus em mobile do mesmo jeito), usar `refetchOnReconnect` via `@capacitor/network`.
- Substituir `setInterval` de polling do entregador por **Realtime + Background Geolocation push** (já temos canal — auditar se ainda existe polling redundante em `DriverDashboardV2`).
- Imagens: `<img loading="lazy" decoding="async">` em todo lugar; pré-baixar avatares de cliente no aceite do pedido.
- Animações: trocar `framer-motion` por CSS transforms em telas do entregador (lista de pedidos, badges) — `framer-motion` sozinho é ~50kb gzip.
- Habilitar `content-visibility: auto` em listas longas (pedidos do dia, histórico, ganhos).

## 4. Plugins recomendados (adicionar / consolidar)

Já temos a base boa. Adicionar:

| Plugin | Uso |
|---|---|
| `@capacitor/share` | Compartilhar comprovante de entrega, código PIX de saque |
| `@capacitor/browser` | Abrir Asaas/links externos sem sair do app (in-app browser) |
| `@capacitor/clipboard` | Copiar endereço / PIX (já usamos web API, padronizar) |
| `@capacitor/device` | Telemetria (modelo, Android version) p/ debug de bugs do entregador |
| `@capacitor/filesystem` | Salvar comprovante de entrega offline antes de enviar |
| `@capacitor-mlkit/barcode-scanning` | Scanner de QR de pedido (futuro pickup) — usa câmera nativa, muito mais rápido que ZXing-web |
| `@capacitor/screen-orientation` | Travar entregador em portrait |
| `@capgo/capacitor-updater` (avaliar) | OTA de bundle JS sem subir APK na Play Store |

Remover/avaliar:
- `@capacitor/background-runner` — limitação grave (15min Android, horas iOS); o que realmente entrega notificação rápida é **FCM data-message** (já temos `firebase-messaging-sw.js`). Manter o runner só como fallback de "última milha".

## 5. UX nativa do Entregador (fluxo)

Telas reorganizadas em **bottom tabs**:

1. **Hoje** — pedido ativo grande no topo (card cheio), próximos pedidos em fila, botão "Online/Offline" gigante, status do GPS.
2. **Mapa** — `LiveTrackingMap` em fullscreen, rota OSRM já implementada; botão flutuante Waze/Maps.
3. **Ganhos** — saldo, saques, histórico do dia/semana.
4. **Perfil** — documentos, conta Asaas, ajuda.

Padrões nativos:
- Pull-to-refresh em todas as listas (`overscroll-behavior: contain` + handler).
- Swipe-actions no card de pedido (arrastar p/ direita = aceitar, esquerda = recusar).
- Haptics (já temos `@capacitor/haptics`) em todo aceite/rejeição/chegada — `Impact.Medium`.
- Toasts não-bloqueantes (já temos sonner) com posição `top-center` no nativo.
- Modais viram **bottom-sheets** no nativo (criar `<NativeSheet>`).
- Sons curtos para "novo pedido", "pedido cancelado" — assets locais, não rede.

## 6. Offline-first do Entregador

- Fila `offlineDeliveryQueue.ts` já existe — auditar e expandir:
  - Aceite de pedido offline → registra intenção, sincroniza ao reconectar.
  - Foto/assinatura de entrega → grava em `Filesystem` + sobe quando online.
  - Última localização → cache local + envia em batch.
- Banner persistente "Sem internet — X ações pendentes" quando `Network.status.connected === false`.

## 7. Background tracking confiável

- Já usamos `@capacitor-community/background-geolocation`. Auditar:
  - `distanceFilter` por velocidade (parado = 50m, andando = 30m, moto = 100m).
  - `stationaryRadius`, desligar quando offline na app de entregador.
  - Notificação foreground service customizada ("ItaSuper — Entregando pedido #1234").

## 8. Build & release

- Workflow Android: 2 builds separados (`partner` e `client`) já existem; garantir que `VITE_CAPACITOR_APP_MODE` corta árvore de rotas em build time.
- ProGuard/R8: habilitar shrink (`minifyEnabled true`, `shrinkResources true`) em release — checar `proguard-rules.pro` atual.
- `targetSdk 35`, `compileSdk 35`, Gradle 8.x — confirmar.
- Tamanho-alvo do APK Parceiro: < 8 MB.

---

## Fases sugeridas de execução

1. **Fase 1 — Fundação (sem mudança visível):** runtime/hook unificado, `nativeBoot`, remoção do `server.url`, split de bundle por modo, ProGuard. **Ganho: 40% menos JS, splash mais rápido, sem reload remoto.**
2. **Fase 2 — Shell nativa do entregador:** `NativeShell`, bottom tabs, status bar, safe areas, haptics, bottom-sheets. **Ganho visual: parece app de verdade.**
3. **Fase 3 — Plugins novos:** share, browser, device, screen-orientation, mlkit-barcode (opcional).
4. **Fase 4 — Offline-first + tracking refinado.**
5. **Fase 5 — OTA (capgo updater) para parar de depender de Play Store em mudanças JS.**

---

## Perguntas antes de codar

1. Posso **remover `server.url`** do `capacitor.config.ts` do APK Parceiro? Isso é o maior ganho de performance, mas você perde o hot-reload remoto (passa a depender de OTA ou novo APK).
2. Começamos pela **Fase 1 (técnica, ganho de performance imediato)** ou pela **Fase 2 (visual nativo, impacto que o entregador vê na hora)**?
3. Quer que eu adicione **OTA via `@capgo/capacitor-updater`** já na Fase 1 (resolve o "como atualizar sem Play Store" antes de remover o `server.url`)?
