# Plano Profissional de Otimização — ItaSuper

**Stack atual:** Vercel (free) + GitHub + Supabase externo (free).
**Objetivo:** abrir a página da loja (`/:slug`) em < 1.5s no 4G, sem pagar nada a mais.

---

## Diagnóstico (onde o tempo se perde hoje)

1. **Bundle JS gigante** — PdvPage tem 1.588 linhas, muitos modais carregam junto, libs pesadas no main chunk.
2. **Cold start Supabase free** — a primeira query após inatividade leva 1–3s (instância free hiberna).
3. **Cascata de queries** na loja do cliente: `stores` → `products` → `addon_groups` → `pizza_borders` → `opening_hours` → `loyalty_config` (6 round-trips serializados).
4. **Imagens não otimizadas** — Unsplash full-res, sem `webp`, sem `loading=lazy`, sem dimensões.
5. **Sem CDN cache** nas respostas da API (toda request bate no Postgres).
6. **Fontes e CSS bloqueando render**.

---

## Fase 1 — Quick wins (1 dia, impacto enorme)

### 1.1 Code splitting agressivo
- Lazy load por rota já existe; estender para **modais pesados** (PizzaHalfHalf, Pastel, PDV builders, Charts do Admin).
- `manualChunks` no `vite.config.ts` separando: `react-vendor`, `supabase`, `radix-ui`, `recharts`, `capacitor`.
- Meta: main chunk < 200KB gzipped.

### 1.2 Preconnect e preload
No `index.html`:
```html
<link rel="preconnect" href="https://qkjhguziuchqsbxzruea.supabase.co" crossorigin>
<link rel="dns-prefetch" href="https://qkjhguziuchqsbxzruea.supabase.co">
```

### 1.3 Imagens
- Loader `<img loading="lazy" decoding="async" width height>` em ProductCard.
- Proxy Unsplash via `?w=400&fm=webp&q=75` (Unsplash já entrega webp gratuito).
- Logo da loja com `fetchpriority="high"`.

### 1.4 Fontes
- `font-display: swap` + preload só do peso usado no LCP.

---

## Fase 2 — Cache na borda da Vercel (1 dia, mata cold start)

A Vercel free dá **Edge Network ilimitada** e **ISR/Data Cache**. Vamos usar.

### 2.1 Edge Function `/api/store/[slug]`
Cria uma rota Vercel Edge que:
- Faz **uma** query agregada no Supabase (stores + products + addons + horários em um único RPC).
- Retorna com header `Cache-Control: public, s-maxage=60, stale-while-revalidate=600`.
- Resultado: 99% dos hits servidos pela CDN da Vercel em ~30ms, sem tocar no Postgres.

### 2.2 RPC agregada no Supabase
```sql
create function public.get_store_bootstrap(_slug text)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'store', (select row_to_json(s) from stores s where slug=_slug),
    'products', (select coalesce(jsonb_agg(p), '[]') from products p ...),
    'addons', ...,
    'hours', ...
  )
$$;
```
Uma única ida ao banco em vez de 6.

### 2.3 Invalidação
- Webhook do Supabase (insert/update em `products`, `stores`) → chama `/api/revalidate?slug=...` na Vercel.
- Sem webhook = TTL de 60s já resolve 95% dos casos.

---

## Fase 3 — Anti cold-start Supabase free (grátis)

O plano free hiberna após ~5min sem requests.

### 3.1 Cron de keep-alive
- Cron Vercel (free: 2 jobs) faz `SELECT 1` a cada 4min em horário comercial (10h–23h).
- Custo: 0. Mantém Postgres "morno".

### 3.2 Connection pooling
- Forçar uso do **pooler na porta 6543** (transaction mode) em todas as edge functions — já vem no Supabase, só conferir URL.

---

## Fase 4 — Índices e queries (meio dia)

Rodar `supabase--slow_queries` e criar índices nos campos mais filtrados:
- `products(store_id, is_available)` — composto
- `orders(store_id, created_at desc)` — para painel
- `stores(slug)` — único, já deve existir
- `opening_hours(store_id)`

Migration única com `CREATE INDEX IF NOT EXISTS`.

---

## Fase 5 — Service Worker leve (opcional, 1 dia)

PWA manifest-only **+** cache `NetworkFirst` apenas para `/api/store/*` e imagens de produto.
- 2ª visita do cliente abre **instantânea** (offline-first do cardápio).
- Não mexe em rotas autenticadas (PDV/Admin).

---

## Fase 6 — Monitoramento (contínuo)

- `analytics--read_project_analytics` semanal.
- `supabase--slow_queries` mensal.
- Web Vitals via Vercel Analytics (free tier: 2.5k events/mês).

---

## Cronograma sugerido

| Fase | Esforço | Ganho estimado no TTI |
|------|---------|------------------------|
| 1 — Quick wins | 1 dia | -40% |
| 2 — Edge cache | 1 dia | -60% no 2º hit |
| 3 — Keep-alive | 1h | elimina spikes de 2s |
| 4 — Índices | 0.5 dia | -30% nas queries lentas |
| 5 — SW cache | 1 dia | abertura quase instantânea |
| 6 — Monitor | contínuo | — |

**Total: ~4 dias de trabalho, custo R$ 0 (continua tudo free).**

---

## Por onde começar?

**Status:** Fase 1 ✅ (v1.10.276) e Fase 2+3 ✅ (v1.10.277 — `api/store/[slug].ts` com cache CDN 60s/SWR 10min + `api/keep-alive.ts` em cron a cada 5min 10h-23h).

Próximo: plugar `fetchStoreBootstrap()` (em `src/lib/storeBootstrap.ts`) no `StorePage.tsx` para consumir o cache da edge, depois Fase 5 (SW opcional).

**Pendência manual:** rodar `scripts/store-bootstrap-external.sql` no SQL editor do Supabase externo se ainda não foi feito (cria a RPC `store_bootstrap`).
