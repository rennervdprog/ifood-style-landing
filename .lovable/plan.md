
# Manter conta logada no app cliente (Capacitor)

## Diagnóstico

A infra já está quase toda certa:

- `authStorage` usa `@capacitor/preferences` (sobrevive a limpeza de cache, update de APK).
- `persistSession: true` e `autoRefreshToken: true` no client Supabase.
- Refresh proativo a cada intervalo enquanto o app está visível.
- Refresh no `visibilitychange` quando volta do background.

Então por que o usuário está sendo deslogado?

**3 causas prováveis, em ordem de probabilidade:**

1. **`getSession()` erro transitório → `signOut({scope:"local"})`** (AuthContext.tsx:142-145).
   Se o boot acontece sem rede (celular abriu o app no metrô/avião), `getSession` pode retornar erro genérico → o código faz signOut local e apaga o token válido. Não deveria: `bad_jwt` sim, network error não.

2. **JWT expira no background e o refresh token expira antes do próximo `resume`.**
   Padrão Supabase: access token 1h, refresh token 30 dias com **rotação obrigatória**. Se o usuário fica >30 dias sem abrir, ou se o refresh falha (rede) e a próxima chamada tenta usar o token rotacionado errado, sessão morre.
   No Capacitor Android o `visibilitychange` **não dispara de forma confiável** quando o app vem do background — só `App.addListener('resume')` do plugin nativo.

3. **`Preferences.get` retorna null silenciosamente em cold-start no Android** enquanto o Supabase client já leu (race). Mitigar com pré-hidratação antes de `createClient` ler.

## Mudanças

### 1. `src/contexts/AuthContext.tsx`
- Remover o `signOut({scope:"local"})` no erro genérico do `getSession`. Só limpar se `error.message` contiver `bad_jwt` / `invalid_grant` / `refresh_token_not_found`. Erro de rede mantém a sessão como está.
- Adicionar listener `App.addListener('resume', ...)` do `@capacitor/app` chamando `refreshSession()` (o `visibilitychange` sozinho não cobre Android nativo).
- No `resume`, se `refreshSession` falhar com erro de rede, **não** deslogar — só logar warning e reagendar retry curto (5s, 15s, 45s).

### 2. `src/integrations/supabase/authStorage.ts`
- Pré-hidratar a chave `sb-<ref>-auth-token` do `Preferences` para `localStorage` **antes** do `createClient` rodar (executar em `main.tsx` antes do import do client), garantindo que a leitura síncrona inicial já veja o token no native.

### 3. Refresh token de longa duração
- Configurar no Supabase auth: `refresh_token_rotation_enabled=true` (já é default) mas subir `jwt_expiry` para 3600 (1h, já default) e garantir que `refresh_token_reuse_interval=10s` (evita corrida de refresh no boot do app quando várias queries disparam ao mesmo tempo).

### 4. `main.tsx`
- Boot: chamar `await hydrateAuthStorage()` antes de renderizar o `<App />`. Curto (~50ms no native), evita render com sessão "vazia".

## Detalhes técnicos

```text
Boot atual (bug):                Boot novo:
─────────────────                ──────────
createClient (lê storage sync)   hydrateAuthStorage() ─► copia Preferences→localStorage
  └─ localStorage vazio          createClient (lê localStorage já hidratado)
getSession() ─► erro rede        getSession() ─► sessão viva
  └─ signOut local ❌            App.on('resume') ─► refreshSession com retry
                                   └─ falha rede: mantém sessão, tenta de novo
```

Regras de "quando deslogar de verdade":
- `bad_jwt` / `invalid_grant` / `refresh_token_not_found` → sim, signOut local.
- Qualquer outro erro (network, timeout, 5xx) → **manter sessão**, tentar depois.

## Fora de escopo

- Biometria/PIN local (pode ser fase 2 se quiser reforço extra).
- Sign in with Apple / OAuth Google no nativo (fluxo separado, não afeta persistência).

## Resultado esperado

Usuário loga uma vez → app cliente mantém a conta por semanas/meses, mesmo com updates de APK, sem rede no boot, e com o app fechado por muitos dias (até o refresh token real expirar após inatividade prolongada).
