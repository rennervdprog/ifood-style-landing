# Plano Profissional — Auto-Update em cada Commit + Correção do Realtime

Objetivo: garantir que **toda alteração publicada** force a aplicação (web + PWA + APK Capacitor) a atualizar sozinha, sem o usuário limpar cache, e restaurar o Realtime que parou de refletir mudanças em tempo real.

---

## Parte 1 — Auto-Update Determinístico por Commit

### 1.1 Fonte única de versão (build-time)
- Gerar `src/lib/buildInfo.ts` **automaticamente no `vite build`** via plugin, contendo:
  - `BUILD_ID` = hash curto do commit (`git rev-parse --short HEAD`) + timestamp.
  - `APP_VERSION` = valor de `src/lib/appVersion.ts` (já usado hoje).
- Expor `/version.json` estático (emitido pelo mesmo plugin) com `{ buildId, version, builtAt }`.
- Isso elimina a dependência de bump manual para detectar "nova versão".

### 1.2 Detector de nova versão em runtime (web + PWA)
- Novo hook `useVersionWatcher` que faz `fetch('/version.json', { cache: 'no-store' })`:
  - No load inicial e a cada **60s** com `visibilitychange` (só quando aba está visível).
  - Também dispara ao voltar de background e ao reconectar rede.
- Se `buildId` do servidor ≠ `buildId` embutido no bundle:
  1. Toast discreto "Nova versão disponível — atualizando…".
  2. Aguarda 1,5s, chama `swRegistration.waiting?.postMessage({type:'SKIP_WAITING'})`.
  3. `window.location.reload()` (com `location.replace` para não empilhar histórico).
- Em rotas críticas (checkout, PDV com venda aberta, motoboy em rota) **adia** o reload até ficar idle, mostrando badge "Atualização pronta".

### 1.3 Service Worker (PWA) coerente
- `vite-plugin-pwa` em `registerType: 'autoUpdate'` + `NetworkFirst` para navegação HTML (já é a política recomendada).
- Registrar `updateViaCache: 'none'` para o SW nunca ser servido do cache do browser.
- SW escuta `SKIP_WAITING` e faz `clients.claim()`.
- Manter os guards atuais (não registrar em preview/dev).

### 1.4 APK Capacitor
- Capacitor hoje aponta para URL da Lovable (hot-reload), então o auto-update já funciona quando o app é aberto online.
- Para o APK "empacotado" (produção), acrescentar checagem `useVersionWatcher` chamando `/version.json` do domínio de produção; se mudar, exibir modal "Atualização disponível" com botão que faz `window.location.reload()`.
- `versionCode`/`versionName` continuam sendo incrementados automaticamente a cada commit conforme regra já existente.

### 1.5 CI/Deploy
- GitHub Action já roda no push. Adicionar step que grava o commit SHA em `version.json` durante o build (o plugin do 1.1 cuida disso — a Action só garante `fetch-depth: 0`).
- Publicação da Lovable serve o novo `/version.json` no mesmo instante do deploy, então o watcher detecta em ≤ 60s.

### Resultado
Cada commit → novo `buildId` → todos os clientes abertos recarregam sozinhos em até 1 minuto, sem pedir para o usuário limpar cache.

---

## Parte 2 — Correção do Realtime

Sintoma relatado: mudanças no banco não refletem mais na UI em tempo real.

### 2.1 Diagnóstico (executar antes de codar)
1. Conferir no banco externo se as tabelas ainda estão na publicação:
   `SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime';`
   Esperado: `orders`, `order_items`, `store_balances`, `pdv_sessions`, `pdv_movements`, `notifications`.
2. Conferir `REPLICA IDENTITY FULL` nessas tabelas (necessário para receber `old` em updates/deletes).
3. Ver logs do Realtime no painel externo — sinal comum: "channel error" ou "closed" por RLS bloqueando `SELECT` do usuário logado no payload.
4. Confirmar que o token JWT está sendo passado: `supabase.realtime.setAuth(session.access_token)` após login.

### 2.2 Correções previstas
- Reaplicar `ALTER PUBLICATION supabase_realtime ADD TABLE ...` para qualquer tabela ausente.
- `ALTER TABLE ... REPLICA IDENTITY FULL` onde faltar.
- Centralizar toda subscription em `src/lib/realtime.ts` com:
  - `channel` único por escopo (loja / usuário), nome estável.
  - `setAuth` chamado no `onAuthStateChange` (SIGNED_IN, TOKEN_REFRESHED).
  - Reconexão exponencial + listener de `visibilitychange` que faz `channel.subscribe()` novamente se estado ≠ `joined`.
- Revisar RLS: políticas de `SELECT` precisam permitir a linha para o usuário — se não permitir, o Realtime silenciosamente não entrega.
- Watchdog visível: badge no header "🟢 Tempo real" / "🟡 Reconectando" para detectar regressão rápido.

### 2.3 Telas a revalidar depois do fix
- Pedidos do lojista (novo pedido, mudança de status).
- Painel do motoboy (atribuição, PIN autofill).
- Super Admin (mensalidades, saldos).
- PDV (movimentos da sessão aberta).

---

## Entregáveis

1. Plugin Vite + `version.json` + `buildInfo.ts`.
2. `useVersionWatcher` integrado no `App.tsx` (com proteção nas rotas críticas).
3. Ajuste do SW (`updateViaCache: 'none'` + `SKIP_WAITING`).
4. `src/lib/realtime.ts` centralizado + watchdog visível.
5. Migração no banco externo: publicação + `REPLICA IDENTITY FULL` + revisão das políticas de SELECT.
6. Bump de versão + versionCode conforme regra do projeto.

## Riscos / Cuidados
- Não recarregar durante checkout/pedido em rota — só após idle.
- Não expor SUPABASE_SERVICE_ROLE em nada disso.
- Preview Lovable continua **sem** SW (regra existente mantida).

Pode aprovar que eu já implemento na sequência (Parte 1 → Parte 2) e informo a nova versão ao final.
