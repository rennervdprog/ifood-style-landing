# Performance Quick Wins — Sprint SRE

**Objetivo:** reduzir CPU do Postgres em ~70% e TTFB do storefront em ~40% através de 4 ações cirúrgicas, sem downtime e 100% reversíveis.

**SLO alvo (pós-deploy):**
- TTFB `/api/store/*` p95 ≤ 600ms (hoje 2.7s no MISS)
- `get_delivery_contacts` p95 ≤ 30ms (hoje 156ms)
- WAL replication CPU ≤ 1.5M ms/dia (hoje 6.4M)

---

## Action 1 — Índice parcial `drivers(is_online)`

**Problema:** seq scan em ~4k execuções/dia (`WHERE is_online = true`), 166s acumulados.
**Fix:**
```sql
CREATE INDEX idx_drivers_online_partial
  ON public.drivers (is_online)
  WHERE is_online = true;
```
**Impacto esperado:** -90% latência da query, -95% CPU.
**Rollback:** `DROP INDEX idx_drivers_online_partial;` (instantâneo).
**Risco:** zero — índice parcial pequeno (poucas linhas).

---

## Action 2 — Índice composto para `get_delivery_contacts`

**Problema:** RPC roda 3.9k/dia somando 613s. Filtra por `is_online` + `status`.
**Fix:**
```sql
CREATE INDEX idx_drivers_online_status
  ON public.drivers (is_online, status)
  WHERE is_online = true;
```
**Impacto esperado:** 156ms → ~20ms (p95).
**Validação:** `EXPLAIN (ANALYZE, BUFFERS)` antes/depois, anexar no PR.
**Rollback:** `DROP INDEX` (instantâneo).

---

## Action 3 — Sanear publicação Realtime

**Problema:** 9 tabelas no `supabase_realtime` geram 6.4M ms/dia de WAL polling — maior gargalo do banco. `products` e `profiles` não têm subscribers no frontend.
**Fix:**
```sql
ALTER PUBLICATION supabase_realtime DROP TABLE public.products;
ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;
```
**Pré-checagem:** `rg "channel.*products|channel.*profiles" src/` — confirmar ausência de `.on('postgres_changes', ..., { table: 'products' })`.
**Impacto esperado:** -60% CPU de WAL, headroom para escalar lojistas.
**Rollback:** `ALTER PUBLICATION supabase_realtime ADD TABLE ...` (instantâneo).

---

## Action 4 — `Cache-Control` agressivo na Edge `/api/store/*`

**Problema:** revalidação a cada 60s força MISS desnecessário; cardápio muda raramente.
**Fix:** em `api/store.ts` substituir header por:
```
Cache-Control: public, s-maxage=600, stale-while-revalidate=86400
```
- **600s** servidos do edge sem hit no Supabase
- **24h** de SWR: usuário sempre recebe resposta instantânea; revalidação em background

**Invalidação:** quando lojista edita produto/seção, disparar `fetch('/api/store/<slug>', { method: 'PURGE' })` ou usar tag-based revalidate. (Fora do escopo deste sprint — backlog.)
**Impacto esperado:** MISS rate cai de ~40% para ~5%; TTFB p50 ≤ 80ms.
**Rollback:** reverter commit (1 linha).

---

## Ordem de execução e gates

```text
T+0   Action 1  (migration)          → medir 1h
T+1h  Action 2  (migration)          → medir 1h
T+2h  Action 3  (migration realtime) → medir 2h (gate crítico)
T+4h  Action 4  (deploy Vercel)      → medir 24h
```

Cada gate: confirmar métricas no `pg_stat_statements` e nos logs da Vercel antes do próximo.

## Observabilidade pós-deploy

- Snapshot `pg_stat_statements` antes e 24h depois (delta em PR).
- Dashboard: `supabase--slow_queries` + Vercel Analytics (cache HIT %).
- Alerta informal: se WAL voltar > 3M ms/dia em 48h, reverter Action 3 e investigar subscriber órfão.

## Entregáveis

1. 3 migrations Supabase (Actions 1, 2, 3).
2. 1 PR Vercel alterando `api/store.ts` (Action 4) + bump de versão.
3. Relatório curto com antes/depois das 3 métricas SLO.

**Aprovar para eu iniciar pela Action 1?**