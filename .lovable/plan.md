# Plano de Performance — ItaSuper

Inspirado em práticas públicas de Google (Web Vitals, PRPL), Meta/Facebook (BigPipe, Hermes), TikTok (skeleton + prefetch agressivo), iFood (catálogo edge-cached), Rappi (lista virtualizada) e Uber (mapa diferido, offline-first).

## Fase 1 — Medir antes de otimizar (baseline)
- Rodar `browser--performance_profile` na home, `/cliente`, `/loja/:slug`, `/admin` (Orders), `/entregador`.
- Registrar LCP, INP, CLS, TTI, JS heap, nº de DOM nodes e tamanho dos chunks (`dist/assets/*`).
- Salvar baseline em `docs/perf-baseline.md` para comparar depois.

## Fase 2 — Bundle & carregamento (Google PRPL + Vite)
- Auditar `dist` com `rollup-plugin-visualizer`. Alvo: cada chunk de rota < 150 KB gzip.
- Lazy-load tabs pesadas do `AdminDashboard` (Menu, Reports, Finance, Subscription) — hoje todas vêm no chunk de `/admin`.
- Dividir `SuperAdminDashboard` por tab (CidadesTab, SaquesTab, etc.) com `lazy()`.
- Remover libs duplicadas: rodar `bun pm ls` e consolidar (ex: ícones, date-fns vs dayjs se houver).
- Tree-shake `lucide-react` garantindo import nomeado (já ok) — nunca `import * as`.
- Pre-bundle de rotas críticas via `<link rel="modulepreload">` no `index.html` para `/cliente` e `/loja`.
- Imagens: plugin `vite-imagetools` + `?format=webp;avif` para banners de loja e logos; `loading="lazy"` + `width/height` explícitos (corta CLS — padrão Google).

## Fase 3 — Render & runtime (Meta/TikTok)
- Virtualizar listas longas com `@tanstack/react-virtual`: pedidos no `/admin/orders`, catálogo em `StorePage`, lista de lojas em `StoreDirectory`.
- `React.memo` + `useMemo`/`useCallback` em `AdminOrderCard`, `ProductCard`, `StoreCard` (re-renderizam a cada tick de realtime hoje).
- Skeletons em vez de spinners nas rotas lazy (percepção TikTok: tela nunca "vazia").
- Debounce de buscas (300 ms) em StoreDirectory e MenuTab.
- `useTransition` ao trocar tabs do admin para manter INP < 200 ms.

## Fase 4 — Dados & rede (iFood/Rappi)
- Auditar todos os `supabase.from(...).select('*')` e trocar por colunas específicas. Alvo: −40% payload.
- Adicionar índices faltantes: `orders(store_id, status, created_at)`, `orders(client_id, created_at)`, `products(store_id, is_active)`, `store_drivers(driver_user_id)`. Verificar com `supabase--linter`.
- Cache de catálogo público via edge function `public-store-catalog` com `Cache-Control: s-maxage=60, stale-while-revalidate=300` (modelo iFood).
- React Query: subir `staleTime` de catálogo para 5 min; manter 30 s só para pedidos ativos.
- Consolidar canais Realtime: hoje cada componente abre o seu — centralizar em 1 canal por store/driver.

## Fase 5 — Mobile / Capacitor (Uber)
- Splash nativo até React montar (já existe shell — validar timing).
- Pré-fetch de `/pedidos`, `/loja`, `/carrinho` em idle (já existe — confirmar que roda).
- Background geolocation do entregador: reduzir frequência quando velocidade < 2 km/h (economia bateria modelo Uber).
- WebView: habilitar `WebView.setWebContentsDebuggingEnabled(false)` em release; `android:hardwareAccelerated="true"` (conferir).
- Habilitar Hermes-like: garantir `minifyEnabled true` + R8 no `build.gradle` release.

## Fase 6 — Observabilidade contínua
- Enviar Web Vitals (CLS/LCP/INP) para Sentry via `web-vitals` lib.
- Dashboard simples no SuperAdmin com p75 de LCP/INP por rota (últimos 7 dias).
- Budget no CI: falhar build se chunk principal > 200 KB gzip.

## Detalhes técnicos
- Ferramentas: `rollup-plugin-visualizer`, `@tanstack/react-virtual`, `vite-imagetools`, `web-vitals`.
- Migrations só para índices (Fase 4) — sem mudança de schema.
- Sem mudança de UI/funcionalidade — apenas estrutura, cache e medições.
- Versão a incrementar ao concluir cada fase (regra do projeto).

## Ordem sugerida de execução
1 → 2 → 4 (índices) → 3 → 5 → 6. Fase 1 obrigatória antes de qualquer otimização para evitar "otimizar no escuro".
