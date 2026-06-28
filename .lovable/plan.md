# Fechamento Fase 2 — App Parceiro Nativo (Entregador)

Objetivo: deixar o APK do Entregador 100% nativo e confiável, fechando os 4 itens que faltam, sem afetar a versão web nem o APK Cliente.

Princípios:
- Tudo gated por `useRuntime().isPartnerNative` (web e cliente seguem inalterados).
- Falhas de plugin nativo nunca quebram o boot — sempre try/catch + log.
- Permissões pedidas no momento certo (não no boot), com fallback educado.

---

## 1. OTA do Capgo (atualizações instantâneas sem Play Store)

**Por que:** corrigir bug ou subir feature sem nova publicação na Play; entregador sempre na versão mais recente.

**O que fazer:**
- Em `src/lib/nativeBoot.ts`, após o app montar e a primeira tela renderizar:
  - `await CapacitorUpdater.notifyAppReady()` — confirma que o bundle baixado funcionou (sem isso, Capgo dá rollback).
  - Disparar `CapacitorUpdater.download({ url, version })` apontando para o canal do Parceiro, ou usar Auto Update do Capgo Cloud.
  - Em `appStateChange` (volta do background), checar update novo e aplicar com `set()` quando seguro.
- Tela mínima de "Atualizando…" se o download estiver em progresso ao abrir.
- Versão do bundle exibida no Perfil (já existe `APP_VERSION`; somar `getVersionInfo()` do Capgo).

**Decisões pendentes:**
- Usar **Capgo Cloud** (mais simples, plano free até 1k MAU) ou **bundle self-hosted** num bucket Supabase Storage?
- Canal: um único `production-partner` ou separar `beta`/`stable`?

---

## 2. Splash & Status Bar nativos

**Por que:** hoje o app abre com flash branco; status bar fica com cor errada sobre o header.

**O que fazer:**
- Instalar `@capacitor/splash-screen` e `@capacitor/status-bar`.
- `capacitor.config.ts`:
  - `SplashScreen`: `launchAutoHide: false`, `backgroundColor: "#0F172A"` (ou cor do tema do Parceiro), `androidScaleType: CENTER_CROP`.
  - `StatusBar`: `style: DARK`, `backgroundColor` sincronizado com o header.
- Em `nativeBoot`:
  - `StatusBar.setStyle()` + `setBackgroundColor()` lendo o tema atual.
  - `SplashScreen.hide({ fadeOutDuration: 200 })` somente após `notifyAppReady` + primeira query crítica (`store-driver-links`) resolver, com timeout de segurança de 3s.
- Gerar assets do splash com `@capacitor/assets` (logo Parceiro 1024×1024 + ícone adaptativo Android).

---

## 3. Push Notifications (novo pedido / convite / suporte)

**Por que:** entregador precisa receber ping mesmo com o app em background — hoje só vê quando abre.

**Arquitetura:**
- Plugin: `@capacitor/push-notifications` (FCM no Android; APNs no iOS quando for a vez).
- Provedor: **Firebase Cloud Messaging** (gratuito, padrão do Capacitor).
- Backend: Edge Function `notify-driver` no Supabase recebe `{ user_id, type, payload }` e dispara via API HTTP v1 do FCM.

**O que fazer:**
- Tabela nova `public.device_tokens` (user_id, token, platform, app_mode, last_seen_at) com RLS (`user_id = auth.uid()`) e `GRANT` apropriado.
- Em `nativeBoot` (somente `isPartnerNative`):
  - `PushNotifications.requestPermissions()` — pedir só após login.
  - `register()` → handler `registration` salva token no Supabase via upsert.
  - Handler `pushNotificationReceived` (app aberto): toast + haptic + invalidate de `v2-store-driver-links` / pedidos.
  - Handler `pushNotificationActionPerformed`: deep-link para `/entregador?orderId=...`.
- Trigger SQL em `orders` (status novo / atribuição) → chama `notify-driver` via `pg_net` ou Edge Function watcher.
- Secret: `FCM_SERVER_KEY` (ou Service Account JSON v1) via `add_secret`.

**Segurança:**
- RLS de `device_tokens` impede leitura cruzada.
- Edge Function valida que `user_id` alvo existe e é entregador antes de enviar.
- Não logar token completo (mascarado).

**Decisões pendentes:**
- Quem cria o projeto Firebase: você (compartilha `google-services.json`) ou eu deixo o lugar marcado para você colar?
- Sons customizados (ex.: "bip de pedido") ou só som padrão do sistema?

---

## 4. GPS em background (rastreio do entregador)

**Por que:** quando o app vai pro background, o GPS para. Cliente perde o rastreio em tempo real e a otimização de rota OSRM fica defasada.

**Plugin escolhido:** `@capacitor-community/background-geolocation` (MIT, gratuito, mantido) — alternativa ao Transistorsoft que é pago.

**O que fazer:**
- Instalar plugin + permissões no `AndroidManifest.xml`:
  - `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE_LOCATION`.
- Foreground service obrigatório no Android 14+ com notificação persistente "Entregando — toque para abrir".
- Novo módulo `src/lib/driver/backgroundGps.ts`:
  - `start()` chamado ao ficar online + ter entrega ativa.
  - `stop()` ao deslogar / ficar offline / finalizar entrega.
  - Throttle: envia para Supabase a cada 15s ou 50m, o que vier primeiro (economiza bateria e linha).
  - Buffer offline: se sem rede, guarda em `localStorage` e descarrega quando voltar (já existe pattern em `nativeBoot`).
- Persistência no Supabase: usar tabela `driver_locations` existente (verificar campos) ou criar `driver_pings (user_id, lat, lng, accuracy, captured_at, battery)` com RLS + GRANT.
- UI: badge "📍 Rastreando" no header quando o serviço está ativo; toggle em Perfil para desligar manualmente.

**Política de bateria:**
- Em Android, instruir o usuário a "Desativar otimização de bateria" para o app (modal one-time + link `requestIgnoreBatteryOptimizations`).
- Parar serviço se entregador ficou 10min parado no mesmo ponto (provavelmente em casa).

---

## Ordem sugerida de execução

```text
Etapa A — Splash + Status Bar      (rápido, ganho visual imediato)
Etapa B — OTA Capgo                (destrava deploys, evita reinstalar APK)
Etapa C — Push Notifications       (depende de Firebase)
Etapa D — GPS Background           (mais sensível: bateria/permissão/manifesto)
```

Cada etapa fecha com:
1. Bump de versão (`APP_VERSION` + `versionName`/`versionCode`).
2. Build local + `bunx vitest run` (manter 117 verde, adicionar testes de boot quando aplicável).
3. Checklist de fumaça no `docs/smoke-checklist.md`.

---

## Detalhes técnicos (resumo de arquivos tocados)

- `capacitor.config.ts` — SplashScreen, StatusBar, CapacitorUpdater channel.
- `src/lib/nativeBoot.ts` — orquestra ordem: StatusBar → SplashScreen.hide → CapacitorUpdater.notifyAppReady → PushNotifications.register.
- `src/lib/driver/backgroundGps.ts` (novo).
- `src/lib/push/registerDeviceToken.ts` (novo).
- `supabase/functions/notify-driver/index.ts` (nova Edge Function).
- Migrations: `device_tokens` (+ RLS + GRANT), `driver_pings` (se necessário), trigger em `orders`.
- `android/app/src/main/AndroidManifest.xml` — permissões + foreground service.
- `src/pages/DriverDashboardV2.tsx` — badge "Rastreando", toggle no Perfil.

---

## Decisões que preciso de você antes de codar

1. **Por onde começar?** Etapa A (splash) → B → C → D, ou pular direto pra C (push)?
2. **OTA:** Capgo Cloud (grátis até 1k MAU) ou self-host no Supabase Storage?
3. **Firebase/FCM:** você cria o projeto e me passa `google-services.json`, ou eu deixo o stub e você plugga depois?
4. **GPS background:** liberar pedir permissão `ACCESS_BACKGROUND_LOCATION` (Google Play exige justificativa na revisão da loja) — confirma que tudo bem incluir no manifesto?
