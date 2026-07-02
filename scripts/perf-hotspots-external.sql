-- ============================================================
-- Perf hotspots: índices para reduzir custo das queries mais chamadas
-- Rodar UMA vez no SQL Editor do Supabase EXTERNO (qkjhguziuchqsbxzruea).
-- Seguro re-executar (IF NOT EXISTS). Usa CONCURRENTLY — uma statement por vez.
-- ============================================================

-- drivers.is_online / is_active: consultado a cada abertura de painel de loja
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_drivers_online_active
  ON public.drivers (is_online, is_active)
  WHERE is_online = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_drivers_user
  ON public.drivers (user_id);

-- store_drivers: lookup por loja e por motoboy (JOIN em painel do lojista)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_store_drivers_store
  ON public.store_drivers (store_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_store_drivers_driver
  ON public.store_drivers (driver_user_id);

-- fcm_tokens: upsert frequente por (user_id, token) — evita seq scan
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fcm_tokens_user_token
  ON public.fcm_tokens (user_id, token);

-- profiles: lookups por role/aprovação no super-admin
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_role_approved
  ON public.profiles (role, is_approved);

-- store_balances: painel financeiro do lojista
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_store_balances_store
  ON public.store_balances (store_id);

-- financial_transactions: extrato por loja/data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_financial_transactions_store_created
  ON public.financial_transactions (store_id, created_at DESC);

-- ANALYZE para o planner pegar as novas estatísticas
ANALYZE public.drivers;
ANALYZE public.store_drivers;
ANALYZE public.fcm_tokens;
ANALYZE public.profiles;
ANALYZE public.store_balances;
ANALYZE public.financial_transactions;