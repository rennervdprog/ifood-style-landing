# Plano: acelerar cold start do APK (Supabase Free + Vercel Free)

Hoje o APK abre, mostra splash → tela branca com spinner por ~10s → entra. O gargalo não é infra paga: é **o que o bundle JS carrega antes do primeiro render**. Dá pra cair para 2-3s sem gastar nada.

## Causas prováveis (a validar)

1. **Bundle inicial gordo** — `App.tsx` importa muitas páginas/contextos direto em vez de `React.lazy`.
2. **Trabalho síncrono no boot** — Sentry, Analytics, Firebase, Realtime, Auth restore, versionWatcher, storeBootstrap rodando antes do primeiro paint.
3. **Cold start do Supabase Free** — projeto pausa após inatividade; primeira query demora 3-5s (o `AuthContext` bloqueia UI esperando `getSession`).
4. **Splash escondendo cedo demais** — sai antes do React montar, revelando tela branca do WebView.
5. **Realtime + push listeners** competindo com o primeiro render.

## O que vou fazer

### 1. Bundle splitting agressivo (maior ganho)
- Converter rotas em `React.lazy` no `App.tsx` (ClientHome, AdminDashboardV2, DriverDashboardV2, PdvPage, KdsPage, todas as landing/blog).
- Só a rota inicial (`/` ou store) entra no bundle principal.
- Adicionar `<Suspense>` com o mesmo spinner já usado.

### 2. Adiar tudo que não é crítico para o primeiro paint
- Mover para `requestIdleCallback` / depois do mount: Firebase init, Realtime watchdog, versionWatcher, storeBootstrap, analytics extras.
- `AuthContext`: renderizar filhos imediatamente com `loading=true` em vez de bloquear a árvore inteira esperando `getSession()` (hoje trava se Supabase estiver frio).

### 3. Splash Capacitor controlado
- Configurar `SplashScreen` com `autoHide: false` no `capacitor.config.ts`.
- Chamar `hideSplash()` só depois do **primeiro render real** (dentro de `useEffect` do App root, não no `main.tsx`).
- Resultado: usuário vê splash laranja da marca até o app estar pronto, sem flash branco.

### 4. Manter Supabase Free "quente" (grátis)
- Já existe `api/keep-alive.ts` na Vercel. Confirmar que está no `vercel.json` como cron a cada 5 min (Vercel Free permite 2 crons diários — usar GitHub Actions cron a cada 5min chamando a rota, que é grátis).
- Isso elimina o cold start de 3-5s do primeiro `getSession`.

### 5. Pré-carregar assets críticos
- `<link rel="preload">` no `index.html` para a fonte principal e o logo.
- Remover imports de fontes não usadas no primeiro render.

### 6. Vite build tuning
- `build.target: 'es2020'` (Android WebView moderno) → menos polyfills.
- `manualChunks` para separar `supabase`, `firebase`, `react-vendor`.
- Confirmar `minify: 'esbuild'` e `cssCodeSplit: true`.

## Como vou medir

Antes/depois em log no console nativo:
```
[Boot] mainStart → firstPaint = Xms
[Boot] firstPaint → appReady = Yms
```
Meta: firstPaint <800ms, appReady <2.5s no APK release.

## Fora de escopo (não vou fazer agora)

- Trocar Supabase/Vercel de plano (usuário pediu grátis).
- Reescrever para SSR/Next.
- Otimizações de imagem no catálogo (não afeta cold start).

## Detalhes técnicos

- Arquivos: `src/App.tsx`, `src/main.tsx`, `src/contexts/AuthContext.tsx`, `src/lib/capacitorNative.ts`, `capacitor.config.ts`, `vite.config.ts`, `index.html`, `.github/workflows/keep-alive.yml` (novo).
- Sem mudança de backend, sem migrations, sem novas dependências.
- Vou versionar (patch bump) e sincronizar `PerfilPage` + `build.gradle` (versionName + versionCode) ao final.
