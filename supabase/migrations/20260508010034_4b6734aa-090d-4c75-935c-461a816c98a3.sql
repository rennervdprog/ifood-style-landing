
-- Orders: filtros mais comuns
CREATE INDEX IF NOT EXISTS idx_orders_store_id_created_at ON public.orders (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON public.orders (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_client_id_created_at ON public.orders (client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_driver_id ON public.orders (driver_id) WHERE driver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_assigned_driver_id ON public.orders (assigned_driver_id) WHERE assigned_driver_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);

-- Stores
CREATE INDEX IF NOT EXISTS idx_stores_status ON public.stores (status);
CREATE INDEX IF NOT EXISTS idx_stores_owner_id ON public.stores (owner_id);
CREATE INDEX IF NOT EXISTS idx_stores_address_city ON public.stores (address_city);

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);

-- Driver earnings
CREATE INDEX IF NOT EXISTS idx_store_driver_earnings_store_status ON public.store_driver_earnings (store_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_driver_earnings_driver ON public.store_driver_earnings (driver_user_id, status);
CREATE INDEX IF NOT EXISTS idx_driver_earnings_driver_status ON public.driver_earnings (driver_user_id, status);
CREATE INDEX IF NOT EXISTS idx_driver_earnings_order ON public.driver_earnings (order_id);

-- Order items / messages / ratings
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_order_id_created ON public.order_messages (order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_order_ratings_store_id ON public.order_ratings (store_id);

-- Products
CREATE INDEX IF NOT EXISTS idx_products_store_id ON public.products (store_id);

-- Store balances / plans
CREATE INDEX IF NOT EXISTS idx_store_plans_store_active ON public.store_plans (store_id, is_active);

-- Financial transactions
CREATE INDEX IF NOT EXISTS idx_financial_transactions_store_created ON public.financial_transactions (store_id, created_at DESC);

ANALYZE public.orders;
ANALYZE public.stores;
ANALYZE public.profiles;
ANALYZE public.store_driver_earnings;
ANALYZE public.driver_earnings;
