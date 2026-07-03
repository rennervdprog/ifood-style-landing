# Plano: Sentry completo no Capacitor (ItaSuper)

Objetivo: capturar **erros JS do webview** + **crashes nativos Android** (Java/Kotlin/NDK) + **ANRs** com stack trace, versão do app e device, sem quebrar nada do que já funciona.

## O que muda

1. Trocar `@sentry/react` por `@sentry/capacitor` + `@sentry/react` (o Capacitor SDK envelopa o React SDK e adiciona a camada nativa).
2. Inicializar o Sentry uma única vez em `src/main.tsx` (hoje a init está espalhada / só no botão de teste).
3. Configurar o plugin nativo no Android para symbolication e crashes nativos.
4. Enviar `release` = versão do app (`APP_VERSION`) pra casar com o que aparece hoje no Sentry.
5. Atualizar o botão "Testar Sentry" no `PerfilPage` pra usar o cliente global já iniciado (sem `import()` dinâmico).
6. Bump de versão (1.10.413 → 1.10.414) em `appVersion.ts` e `build.gradle` conforme regra do projeto.

## Passos

### 1. Dependências
```bash
npm i @sentry/capacitor @sentry/react
```
(mantém `@sentry/react` — o `@sentry/capacitor` depende dele.)

### 2. Init única — `src/main.tsx`
```ts
import * as Sentry from "@sentry/capacitor";
import * as SentryReact from "@sentry/react";
import { APP_VERSION } from "@/lib/appVersion";

Sentry.init(
  {
    dsn: "<DSN_ATUAL_DO_PROJETO>",
    release: `itasuper@${APP_VERSION}`,
    dist: String(<versionCode>),
    environment: import.meta.env.PROD ? "production" : "development",
    tracesSampleRate: 0.1,
  },
  SentryReact.init,
);
```
DSN: reuso do que já está no código hoje. Não precisa de secret (DSN é público).

### 3. Android nativo
- `android/app/build.gradle`: aplicar plugin `io.sentry.android.gradle` (upload automático de ProGuard/mapping e símbolos nativos).
- `android/build.gradle`: adicionar classpath do plugin.
- `sentry.properties` em `android/` com `auth.token` (secret) — só necessário se quisermos upload automático de mapping. Se o usuário não quiser lidar com token agora, pulamos e crashes nativos ainda chegam, só ficam sem símbolos bonitos.

### 4. Botão "Testar Sentry" (`PerfilPage.tsx`)
Simplificar: usar `Sentry.captureException(new Error(...))` do cliente já iniciado, sem `import()` dinâmico nem `getClient()` check. Manter `Sentry.flush(2000)` e toast.

### 5. Sync Capacitor
Após merge, o usuário roda localmente:
```bash
git pull
npm install
npx cap sync android
npx cap run android
```

### 6. Versão
- `src/lib/appVersion.ts`: `1.10.414`
- `android/app/build.gradle`: `versionName "1.10.414"`, `versionCode 743`

## O que passa a ser capturado

| Tipo de erro | Antes (só @sentry/react) | Depois (@sentry/capacitor) |
|---|---|---|
| Erro JS / React | Sim | Sim |
| Promise rejeitada | Sim | Sim |
| Crash nativo Android (Java/Kotlin) | Não | **Sim** |
| Crash NDK (C/C++) | Não | **Sim** |
| ANR (app travado) | Não | **Sim** |
| Offline (envia quando voltar net) | Parcial | **Sim, fila nativa** |

## Segurança
- DSN é público por design, ok no bundle.
- Nenhum PII enviado (sem `sendDefaultPii`).
- `auth.token` do Sentry (upload de mapping) vai como secret, nunca no repo.

## Fora de escopo (não faço agora)
- iOS (não há pasta `ios/` no projeto).
- Source maps do bundle web (posso adicionar depois se quiser stack JS desofuscada).
- Performance/tracing detalhado (fica em 10% de amostra).

Confirma que posso executar?
