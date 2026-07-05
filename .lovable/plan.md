# Plano — Cold start nativo no APK Parceiro (meta: 5-6s)

Hoje o APK Parceiro leva **8-12s** para ficar utilizável. A auditoria do repositório + pesquisa (Capgo, Ionic/Capacitor docs, Android startup vitals) mostra que o problema não é OTA nem CPU do dispositivo — é a **quantidade de JS que precisa ser baixada, parseada e executada antes do primeiro paint interativo**, agravada por trabalho eager em módulos e providers que o Parceiro nem usa.

O plano ataca isso em 5 frentes, na ordem de maior impacto por esforço.

---

## Frente 1 — Splash sob controle (fim do "buraco preto")

**Problema.** `capacitor.config.ts` define `launchAutoHide: false` + `launchShowDuration: 3500`. O React chama `hideSplash()` só depois de 2× `requestAnimationFrame` + `setTimeout(250)` **de dentro do App**. Enquanto o bundle não termina de parsear/hidratar Providers, a splash laranja fica travada e o usuário sente 8-12s. Além disso, quando o `hideSplash` finalmente roda, a tela abaixo ainda está montando os Providers → aparece o `lcp-shell` preto por mais alguns frames.

**Ação.**
- Reduzir `launchShowDuration` para `2000` como cinto de segurança.
- Chamar `hideSplash()` **imediatamente após o primeiro `render` do React** (dentro do `main.tsx`, antes mesmo dos Providers montarem os useEffects) — hoje ele está dentro do `useEffect` do `App`, o que só dispara depois do mount.
- Remover o `setTimeout(250)` do App — o RAF duplo já garante o primeiro paint.
- Substituir o `lcp-shell` preto por um shell que **combina com a splash laranja** (mesmo `#FF6B00`), de modo que a troca visual seja invisível.

**Ganho estimado:** percepção de -1 a -1,5s (o app "abre" quando o primeiro paint acontece, não quando terminam todos os providers).

---

## Frente 2 — Firebase Web SDK fora do boot do APK

**Problema.** `src/contexts/AuthContext.tsx` faz `import { requestPushPermissionAndRegister, onForegroundMessage } from "@/lib/firebase"` **síncrono no topo**. Isso puxa `firebase/app` + `firebase/messaging` (~120-180KB gz) para dentro do chunk crítico do boot — em Capacitor eles nunca são usados (push nativo é `@capacitor/push-notifications`).

**Ação.**
- Trocar por `import()` dinâmico dentro do `useEffect` que registra push, **e só executá-lo quando `!isCapacitorNative()`** (no APK Parceiro, Firebase Web nunca precisa carregar).
- Fazer o mesmo com `gonative` (só faz sentido em wrapper GoNative/Median, não em Capacitor).

**Ganho estimado:** -400ms a -800ms de parse+execute no bundle crítico.

---

## Frente 3 — Enxugar o `App.tsx` para o APK Parceiro

**Problema.** Antes de qualquer rota renderizar, o `App` monta em cadeia: `QueryClientProvider → TooltipProvider → ThemeProvider → AuthProvider → StoreProvider → CartProvider → Toaster → GlobalRealtimeSync → CapacitorPermissionsOnboarding → InstallPrompt → NotificationPrompt → DebugOverlay → BrowserRouter → PushNavigator → RecoveryRedirect → CapacitorRouteGuard → StoreAppGuard → TermsChecker → ClientPinChecker → DownloadAppPrompt → ErrorBoundary → Suspense → Routes`. No Parceiro, vários **não têm razão de existir**: `InstallPrompt` (PWA), `DownloadAppPrompt` (banner "baixe o app"), `StoreAppGuard` (guard de app cliente/loja) e `CartProvider` (carrinho de cliente).

**Ação.** Adicionar um único gate no `App` (`isPartnerNative`) e:
- Não montar `InstallPrompt`, `DownloadAppPrompt`, `NotificationPrompt` (web-only), nem `CartProvider` no Parceiro.
- Fazer `GlobalRealtimeSync`, `CapacitorPermissionsOnboarding`, `TermsChecker`, `ClientPinChecker`, `RecoveryRedirect` serem lazy via `React.lazy` + montados **depois** do primeiro paint (via `useEffect` com `requestIdleCallback` que troca um `showAncillary` de false → true).
- Manter apenas o essencial no caminho crítico: `Query → Theme → Auth → Router → Routes`.

**Ganho estimado:** -600ms a -1,2s (menos árvore para reconciliar no primeiro render).

---

## Frente 4 — Chunk específico do Parceiro + preload da rota inicial

**Problema.**
- O `manualChunks` do `vite.config.ts` agrupa vendors bem, mas o **chunk da rota inicial** (`PartnerLogin`) só começa a baixar depois que o `main.tsx` executa e o `Suspense` percebe a rota. Zero overlap com o boot.
- O APK carrega recharts/leaflet/lucide inteiros mesmo em telas do Parceiro que não usam.
- `lucide-react` como manualChunk único força o bundle inteiro dos ícones no boot; tree-shaking morre quando você usa manualChunks estático.

**Ação.**
- Emitir `<link rel="modulepreload">` para o chunk de `PartnerLogin` (e `DriverDashboardV2` / `AdminDashboardV2` conforme heurística de "última rota") direto no `index.html` gerado — via um plugin Vite pequeno que lê o `manifest.json` do build.
- Remover `icons: ["lucide-react"]` do `manualChunks` para permitir tree-shaking real. Reagrupar `charts: ["recharts"]` só como chunk async (já é usado só em telas admin).
- Adicionar variável `VITE_CAPACITOR_APP_MODE=parceiro` no workflow `build-android.yml` e usar um pequeno plugin de build que **remove imports** de rotas de cliente (`StoreDirectory`, `StorePage`, `CartPage`, `CheckoutPage`, `ClientHome`, `LandingPage`, `BlogIndex`, `BlogPost`, `VagaPromoPage`) do bundle Parceiro, deixando stubs que redirecionam. Isso corta ~30-40% do JS distribuído.

**Ganho estimado:** -1s a -2s no cold start real (menos bytes para baixar do storage local do webview, menos parse).

---

## Frente 5 — OTA verdadeiramente "background-only"

**Problema.** OTA já está bem configurado (`autoUpdate: true`, `directUpdate: true`, `getLatest` em `requestIdleCallback`). Porém `directUpdate: true` **aplica** o bundle assim que o download termina — se isso cai no meio da primeira sessão, o webview recarrega e o usuário vê "abriu de novo". E `notifyAppReady()` está dentro de `nativeBoot()` que roda **depois** do `requestIdleCallback` — em execuções muito lentas isso pode passar do watchdog de 10s do plugin e disparar rollback no próximo boot (falso "OTA não funciona").

**Ação.**
- Trocar `directUpdate: true` por `directUpdate: false` e aplicar somente no próximo `appStateChange` para `background` (já é o comportamento default do plugin) — evita reload no meio da sessão.
- Mover `CapacitorUpdater.notifyAppReady()` para **antes** de qualquer `requestIdleCallback`, logo depois do `initCapacitorNative()`. É uma chamada barata (<5ms) e é o que impede rollback.
- Manter `getLatest()` em idle callback (já está).

**Ganho estimado:** confiabilidade do OTA (zero rollbacks acidentais) + fim do reload no meio da sessão.

---

## Ordem de execução

1. Frente 1 (splash) + Frente 5 (OTA `notifyAppReady`) — 15 min, ganho imediato de percepção.
2. Frente 2 (Firebase lazy) — 20 min, ganho de bytes no chunk crítico.
3. Frente 3 (enxugar App.tsx para Parceiro) — 40 min, ganho de tempo de render.
4. Frente 4 (chunk do Parceiro + modulepreload) — 60 min, maior ganho de tempo de download/parse.

Cada frente é independente e pode ser validada isoladamente medindo o cold start com `adb shell am start -W` no APK.

---

## Detalhes técnicos

**Arquivos que mudam:**
- `capacitor.config.ts` — `launchShowDuration: 2000`, `directUpdate: false`.
- `src/main.tsx` — chamar `hideSplash()` logo após `createRoot(...).render(...)`, atrás de um `requestAnimationFrame` duplo.
- `src/App.tsx` — remover `hideSplash` do useEffect (já feito acima); introduzir `isPartnerNative` gate; envolver Providers cliente-only em condicional; `React.lazy` + montagem deferida para components ancillary.
- `src/contexts/AuthContext.tsx` — remover imports estáticos de `@/lib/firebase` e `@/lib/gonative`; usar `import()` dinâmico dentro dos `useEffect` guardado por `!isCapacitorNative()`.
- `src/lib/nativeBoot.ts` — mover `notifyAppReady()` para fora do `nativeBoot`, exposto como função separada chamada logo em `initCapacitorNative()`.
- `vite.config.ts` — remover `icons` de `manualChunks`; adicionar plugin `modulepreload` para rota inicial baseado em `VITE_CAPACITOR_APP_MODE`; opcionalmente plugin `virtual:client-stub` que substitui páginas de cliente por redirect no build Parceiro.
- `.github/workflows/build-android.yml` — passar `VITE_CAPACITOR_APP_MODE=parceiro` para o `vite build` do APK Parceiro.
- Bump de versão `1.11.41 → 1.11.42` + `versionCode 795 → 796`.

**Medição.** Antes/depois com:
```text
adb shell am start -W -n app.lovable.e8d28aded6334d74be2161c8dbe24765/.MainActivity
```
Métrica `TotalTime` no output. Meta: < 6000ms na Frente 4 concluída.

**Sem risco de regressão:** todas as alterações são aditivas ou removem código do caminho crítico. OTA continua funcional (na verdade fica mais estável), rotas de cliente continuam existindo no APK Cliente. Nenhuma mudança de esquema, backend ou segurança.
