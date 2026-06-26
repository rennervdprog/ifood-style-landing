CREATE INDEX IF NOT EXISTS idx_drivers_online_active ON public.drivers(is_online, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_store_available ON public.products(store_id) WHERE is_available = true;
CREATE INDEX IF NOT EXISTS idx_admin_settings_key ON public.admin_settings(key);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_token ON public.fcm_tokens(user_id, token);