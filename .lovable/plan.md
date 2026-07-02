# Plano: OTA (Over-The-Air) 100% Funcional

## Diagnóstico atual

Hoje temos **dois sistemas de update rodando ao mesmo tempo** e brigando entre si:

1. `@capgo/capacitor-updater` (configurado em `capacitor.config.ts` com `autoUpdate: true`) — mas **nunca recebe um bundle novo** porque não há pipeline publicando ZIPs assinados no canal do Capgo.
2. `src/lib/capacitorAutoUpdate.ts` — faz fetch do `itasuper.com.br/`, compara hashes de `/assets/*.js` e chama `window.location.reload()`. Isso funciona **só quando o WebView aponta pra URL remota**, mas o `capacitor.config.ts` está com `hostname: 'itasuper.com.br'` + `androidScheme: 'https'` **sem `server.url`** — ou seja, o WebView carrega o bundle **local do APK**, e o reload não troca bundle nenhum, só recarrega o mesmo HTML empacotado.

Resultado: motoboy fecha e abre o app e continua na versão antiga porque **nada baixa bundle novo de lugar nenhum**.

## Objetivo

Toda vez que um commit for para produção, o APK instalado no celular do motoboy/lojista deve baixar o novo bundle JS/CSS em background e aplicá-lo no próximo cold start — **sem precisar publicar APK na Play Store**.

## Estratégia escolhida: Capgo self-hosted no Supabase Storage

Usar o `@capgo/capacitor-updater` (já instalado) apontando para um **canal self-hosted** hospedado no nosso bucket `app-releases` do Supabase externo. Zero custo, zero dependência do serviço pago do Capgo, e o plugin nativo cuida de download/verificação/rollback automático.

## Fases

### Fase 1 — Infra de release no bucket `app-releases`
- Garantir bucket público `app-releases` no Supabase externo (edge function `setup-app-releases-bucket` já existe — rodar 1×).
- Estrutura de pastas:
  ```text
  app-releases/
    bundles/1.10.404.zip
    bundles/1.10.405.zip
    manifest.json   ← { "version": "1.10.405", "url": ".../1.10.405.zip", "checksum": "sha256..." }
  ```

### Fase 2 — Script de publicação `scripts/publish-ota.mjs`
- Roda após `vite build`.
- Zipa `dist/` → `bundles/<versão>.zip`.
- Calcula SHA-256.
- Faz upload do ZIP + reescreve `manifest.json` no bucket via service role key.
- Bump automático de patch em `src/lib/appVersion.ts` (mantém sincronia com regra do projeto).

### Fase 3 — GitHub Action `ota-release.yml`
- Trigger: `push` na `main` que altere `src/**`, `public/**`, `index.html`, `vite.config.ts`.
- Passos: `npm ci` → `npm run build` → `node scripts/publish-ota.mjs`.
- Roda em paralelo ao `build-android.yml` — o APK continua sendo gerado só quando muda código nativo (Java/Gradle/plugins).

### Fase 4 — Configurar canal no `capacitor.config.ts`
- Adicionar em `CapacitorUpdater`:
  ```ts
  updateUrl: 'https://<supabase>/storage/v1/object/public/app-releases/manifest.json',
  statsUrl: '',            // desabilita telemetria do Capgo
  channelUrl: '',
  publicKey: '',           // sem assinatura (checksum SHA-256 já valida)
  ```
- Manter `autoUpdate: true`, `directUpdate: false`, `resetWhenUpdate: true`.

### Fase 5 — Remover o sistema paralelo que hoje atrapalha
- Deletar `src/lib/capacitorAutoUpdate.ts` e sua chamada em `App.tsx` — o plugin nativo passa a ser fonte única.
- Manter `src/lib/versionWatcher.ts` **só para a Web (PWA)**, guardado por `!isCapacitorNative()`.
- Limpar o hack de `MainActivity.java` que apaga cache do WebView a cada mudança de versão nativa — não precisa mais.

### Fase 6 — UX no app
- Em `nativeBoot.ts`, além do `notifyAppReady()`, escutar os eventos do plugin:
  - `updateAvailable` → toast discreto "Atualização baixada, será aplicada ao reabrir".
  - `downloadComplete` → log.
  - `updateFailed` → Sentry.
- Botão "Buscar atualização agora" na tela de Perfil chamando `CapacitorUpdater.getLatest()` + `set()` + `App.exitApp()` guiado.

### Fase 7 — Validação
- Build APK v1.10.404 → instalar no celular.
- Fazer 1 commit trivial → aguardar GitHub Action publicar → fechar/abrir app → confirmar via Perfil que versão exibida virou v1.10.405 sem passar por Play Store.
- Testar cenário offline (rollback automático se ZIP corrompido).

## Detalhes técnicos

- **Segurança:** ZIP validado por SHA-256 no manifest; service role key só vive no GitHub Secrets, nunca no APK.
- **Tamanho:** bundle atual ~2MB gzip → download em segundos no 4G.
- **Rollback:** `autoDeleteFailed: true` + `notifyAppReady()` garantem que bundle quebrado é descartado no próximo boot.
- **Restrição Play Store:** OTA de **JS/CSS/HTML** é permitido; código nativo (Java/plugins novos) continua exigindo APK novo — o workflow atual `build-android.yml` cobre isso.

## O que NÃO muda

- Nada no fluxo web/PWA (continua com `versionWatcher` + Service Worker).
- Nada em edge functions, banco, RLS, ou UI de motoboy/lojista/cliente.
- `versionCode`/`versionName` do `build.gradle` continuam sendo bumpados apenas quando sai APK novo.
