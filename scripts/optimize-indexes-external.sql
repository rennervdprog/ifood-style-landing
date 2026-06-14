-- ============================================================
-- Otimização: índices para o Supabase EXTERNO (qkjhguziuchqsbxzruea)
-- Rodar UMA vez no SQL Editor do projeto externo.
-- Todos usam IF NOT EXISTS — seguro re-executar.
-- CONCURRENTLY evita lock; rodar fora de transação (uma instrução por vez).
-- ============================================================

-- ORDERS: filtros mais comuns (loja + status + data) e por cliente
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_store_status_created
  ON public.orders (store_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_client_created
  ON public.orders (client_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_driver_status
  ON public.orders (driver_id, status)
  WHERE driver_id IS NOT NULL;

-- ORDER_ITEMS: lookup por pedido (JOIN principal)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order
  ON public.order_items (order_id);

-- PRODUCTS: listagem por loja + seção
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_store_section
  ON public.products (store_id, section_id)
  WHERE is_available = true;

-- DRIVER_LOCATIONS: última posição por motoboy
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_driver_locations_driver_created
  ON public.driver_locations (driver_id, created_at DESC);

-- FCM_TOKENS: lookup por user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fcm_tokens_user
  ON public.fcm_tokens (user_id);

-- ORDER_MESSAGES: chat por pedido
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_messages_order_created
  ON public.order_messages (order_id, created_at);

-- COUPON_USES: validação de uso por cliente
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coupon_uses_coupon_user
  ON public.coupon_uses (coupon_id, user_id);
