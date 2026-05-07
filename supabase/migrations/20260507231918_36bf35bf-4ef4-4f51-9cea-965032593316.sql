
-- Índices críticos para performance dos fluxos de pedidos (lojista e motoboy)
CREATE INDEX IF NOT EXISTS idx_orders_client_created ON public.orders (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_store_created ON public.orders (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_driver_status ON public.orders (driver_id, status) WHERE driver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status_ready ON public.orders (status, created_at) WHERE status = 'pronto_para_entrega' AND driver_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status_store ON public.orders (store_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_visible_client ON public.orders (client_id, visible_to_client) WHERE visible_to_client = true;

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items (product_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_order_created ON public.order_messages (order_id, created_at);

CREATE INDEX IF NOT EXISTS idx_driver_earnings_driver_created ON public.driver_earnings (driver_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_earnings_order ON public.driver_earnings (order_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_driver_created ON public.withdrawal_requests (driver_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_transactions_register_created ON public.cash_transactions (cash_register_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_registers_store_status ON public.cash_registers (store_id, status);

CREATE INDEX IF NOT EXISTS idx_order_ratings_user ON public.order_ratings (user_id);
CREATE INDEX IF NOT EXISTS idx_order_ratings_store_created ON public.order_ratings (store_id, created_at DESC);
